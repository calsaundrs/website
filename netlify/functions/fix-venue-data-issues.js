const Airtable = require('airtable');

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Fix Venue Data: Starting automated fix process...');
        
        if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get all events
        console.log('Fix Venue Data: Fetching all events...');
        const eventRecords = await base('Events').select({
            fields: ['Event Name', 'Venue', 'Venue Name', 'VenueText', 'Status']
        }).all();

        // Get all venues
        console.log('Fix Venue Data: Fetching all venues...');
        const venueRecords = await base('Venues').select({
            fields: ['Name', 'Address']
        }).all();

        // Create venue lookup maps
        const venueMap = new Map();
        const venueNameMap = new Map();
        
        venueRecords.forEach(venue => {
            venueMap.set(venue.id, venue.fields);
            venueNameMap.set(venue.fields.Name?.toLowerCase().trim(), venue.id);
        });

        const fixes = [];
        const errors = [];
        let processedCount = 0;

        console.log(`Fix Venue Data: Processing ${eventRecords.length} events`);

        for (const eventRecord of eventRecords) {
            const fields = eventRecord.fields;
            const eventName = fields['Event Name'] || 'Unnamed Event';
            let needsUpdate = false;
            let updateFields = {};

            // Check venue data consistency
            const venueRecord = fields['Venue'] && fields['Venue'][0];
            const venueName = fields['Venue Name'] && fields['Venue Name'][0];
            const venueText = fields['VenueText'];

            // Fix 1: Missing venue data entirely
            if (!venueRecord && !venueName && !venueText) {
                console.log(`Fix Venue Data: Event "${eventName}" has no venue data - marking for manual review`);
                errors.push({
                    eventId: eventRecord.id,
                    eventName,
                    issue: 'Missing venue data',
                    action: 'Manual review required'
                });
                continue;
            }

            // Fix 2: Venue text exists but no venue record linked
            if (venueText && !venueRecord) {
                const normalizedVenueText = venueText.toLowerCase().trim();
                const matchingVenueId = venueNameMap.get(normalizedVenueText);
                
                if (matchingVenueId) {
                    // Found matching venue - link it
                    updateFields['Venue'] = [matchingVenueId];
                    updateFields['Venue Name'] = [venueText]; // Keep the original text
                    needsUpdate = true;
                    
                    fixes.push({
                        eventId: eventRecord.id,
                        eventName,
                        issue: 'Venue text exists but no venue record linked',
                        action: `Linked to venue: ${venueText}`,
                        venueId: matchingVenueId
                    });
                } else {
                    // No matching venue found - create a new one
                    try {
                        console.log(`Fix Venue Data: Creating new venue for "${venueText}"`);
                        const newVenue = await base('Venues').create([
                            {
                                fields: {
                                    'Name': venueText,
                                    'Address': 'Address to be added',
                                    'Description': `Auto-created venue for event: ${eventName}`
                                }
                            }
                        ]);
                        
                        const newVenueId = newVenue[0].id;
                        updateFields['Venue'] = [newVenueId];
                        updateFields['Venue Name'] = [venueText];
                        needsUpdate = true;
                        
                        fixes.push({
                            eventId: eventRecord.id,
                            eventName,
                            issue: 'Venue text exists but no venue record linked',
                            action: `Created new venue: ${venueText}`,
                            venueId: newVenueId
                        });
                    } catch (error) {
                        console.error(`Fix Venue Data: Failed to create venue for "${venueText}":`, error);
                        errors.push({
                            eventId: eventRecord.id,
                            eventName,
                            issue: 'Failed to create venue',
                            action: 'Manual review required',
                            error: error.message
                        });
                    }
                }
            }

            // Fix 3: Venue record and venue name mismatch
            if (venueRecord && venueName && venueRecord !== venueName) {
                // Check if the venue record exists
                const venueExists = venueMap.has(venueRecord);
                const venueNameMatches = venueNameMap.get(venueName.toLowerCase().trim()) === venueRecord;
                
                if (!venueExists) {
                    // Venue record doesn't exist - try to find matching venue by name
                    const matchingVenueId = venueNameMap.get(venueName.toLowerCase().trim());
                    if (matchingVenueId) {
                        updateFields['Venue'] = [matchingVenueId];
                        needsUpdate = true;
                        
                        fixes.push({
                            eventId: eventRecord.id,
                            eventName,
                            issue: 'Venue record references non-existent venue',
                            action: `Updated to existing venue: ${venueName}`,
                            venueId: matchingVenueId
                        });
                    } else {
                        errors.push({
                            eventId: eventRecord.id,
                            eventName,
                            issue: 'Venue record references non-existent venue',
                            action: 'Manual review required',
                            details: { venueRecord, venueName }
                        });
                    }
                } else if (!venueNameMatches) {
                    // Venue record exists but name doesn't match - update name to match record
                    const actualVenueName = venueMap.get(venueRecord)?.Name;
                    if (actualVenueName) {
                        updateFields['Venue Name'] = [actualVenueName];
                        needsUpdate = true;
                        
                        fixes.push({
                            eventId: eventRecord.id,
                            eventName,
                            issue: 'Venue record and venue name mismatch',
                            action: `Updated venue name to: ${actualVenueName}`,
                            venueId: venueRecord
                        });
                    }
                }
            }

            // Apply updates if needed
            if (needsUpdate && Object.keys(updateFields).length > 0) {
                try {
                    await base('Events').update([
                        {
                            id: eventRecord.id,
                            fields: updateFields
                        }
                    ]);
                    
                    console.log(`Fix Venue Data: Updated event "${eventName}"`);
                } catch (error) {
                    console.error(`Fix Venue Data: Failed to update event "${eventName}":`, error);
                    errors.push({
                        eventId: eventRecord.id,
                        eventName,
                        issue: 'Failed to apply update',
                        action: 'Manual review required',
                        error: error.message,
                        attemptedUpdate: updateFields
                    });
                }
            }

            processedCount++;
            if (processedCount % 50 === 0) {
                console.log(`Fix Venue Data: Processed ${processedCount}/${eventRecords.length} events`);
            }
        }

        console.log(`Fix Venue Data: Completed processing. ${fixes.length} fixes applied, ${errors.length} errors`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Venue data fix process completed',
                summary: {
                    totalEvents: eventRecords.length,
                    fixesApplied: fixes.length,
                    errorsFound: errors.length,
                    newVenuesCreated: fixes.filter(f => f.action.includes('Created new venue')).length
                },
                fixes,
                errors,
                recommendations: [
                    'Review any events marked for manual review',
                    'Verify newly created venues have proper addresses',
                    'Run validation again to confirm fixes',
                    'Consider implementing data validation rules in the submission process'
                ]
            })
        };

    } catch (error) {
        console.error('Fix Venue Data: Error during fix process:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fix venue data issues',
                details: error.message
            })
        };
    }
};