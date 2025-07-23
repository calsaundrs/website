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
        console.log('Merge Duplicate Venues: Starting automated merge process...');
        
        if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get all venues
        console.log('Merge Duplicate Venues: Fetching all venues...');
        const venueRecords = await base('Venues').select({
            fields: ['Name', 'Address', 'Description']
        }).all();

        // Get all events to see venue usage
        console.log('Merge Duplicate Venues: Fetching all events...');
        const eventRecords = await base('Events').select({
            fields: ['Event Name', 'Venue', 'Venue Name', 'VenueText']
        }).all();

        // Analyze venues for duplicates
        const venueGroups = new Map();
        const venueUsage = new Map();
        const venueMap = new Map();

        // Group venues by normalized name
        venueRecords.forEach(venue => {
            const name = venue.fields.Name;
            if (!name) return;
            
            const normalizedName = name.toLowerCase().trim();
            if (!venueGroups.has(normalizedName)) {
                venueGroups.set(normalizedName, []);
            }
            venueGroups.get(normalizedName).push(venue);
            venueMap.set(venue.id, venue.fields);
        });

        // Count venue usage
        eventRecords.forEach(event => {
            const venueId = event.fields['Venue'] && event.fields['Venue'][0];
            if (venueId) {
                venueUsage.set(venueId, (venueUsage.get(venueId) || 0) + 1);
            }
        });

        // Find exact duplicates and containment duplicates
        const mergeOperations = [];
        const processedVenues = new Set();

        // Process exact duplicates first
        for (const [normalizedName, venues] of venueGroups) {
            if (venues.length > 1 && !processedVenues.has(normalizedName)) {
                // Sort by usage (most used first) and name length (longer names preferred)
                const sortedVenues = venues.sort((a, b) => {
                    const usageA = venueUsage.get(a.id) || 0;
                    const usageB = venueUsage.get(b.id) || 0;
                    if (usageA !== usageB) return usageB - usageA;
                    return b.fields.Name.length - a.fields.Name.length;
                });

                const primary = sortedVenues[0];
                const secondary = sortedVenues.slice(1);

                mergeOperations.push({
                    type: 'exact_duplicate',
                    primaryVenue: primary,
                    secondaryVenues: secondary,
                    reason: `Multiple venues with same name "${primary.fields.Name}"`,
                    eventsToUpdate: []
                });

                processedVenues.add(normalizedName);
            }
        }

        // Find containment duplicates
        const venueNames = Array.from(venueGroups.keys());
        for (let i = 0; i < venueNames.length; i++) {
            for (let j = i + 1; j < venueNames.length; j++) {
                const name1 = venueNames[i];
                const name2 = venueNames[j];
                
                // Skip if either has been processed
                if (processedVenues.has(name1) || processedVenues.has(name2)) continue;
                
                // Check if one name contains the other
                if (name1.includes(name2) || name2.includes(name1)) {
                    const venues1 = venueGroups.get(name1);
                    const venues2 = venueGroups.get(name2);
                    
                    if (venues1 && venues2) {
                        // Determine which is the primary (longer name, more usage)
                        const longerName = name1.length > name2.length ? name1 : name2;
                        const shorterName = name1.length > name2.length ? name2 : name1;
                        
                        const longerVenues = name1.length > name2.length ? venues1 : venues2;
                        const shorterVenues = name1.length > name2.length ? venues2 : venues1;
                        
                        const totalUsageLonger = longerVenues.reduce((sum, v) => sum + (venueUsage.get(v.id) || 0), 0);
                        const totalUsageShorter = shorterVenues.reduce((sum, v) => sum + (venueUsage.get(v.id) || 0), 0);
                        
                        // Choose primary based on usage, then name length
                        let primaryVenues, secondaryVenues;
                        if (totalUsageLonger > totalUsageShorter || 
                            (totalUsageLonger === totalUsageShorter && longerName.length > shorterName.length)) {
                            primaryVenues = longerVenues;
                            secondaryVenues = shorterVenues;
                        } else {
                            primaryVenues = shorterVenues;
                            secondaryVenues = longerVenues;
                        }
                        
                        // Sort primary venues by usage
                        primaryVenues.sort((a, b) => (venueUsage.get(b.id) || 0) - (venueUsage.get(a.id) || 0));
                        const primary = primaryVenues[0];
                        const secondary = [...primaryVenues.slice(1), ...secondaryVenues];
                        
                        mergeOperations.push({
                            type: 'containment',
                            primaryVenue: primary,
                            secondaryVenues: secondary,
                            reason: `"${longerName}" contains "${shorterName}"`,
                            eventsToUpdate: []
                        });
                        
                        processedVenues.add(name1);
                        processedVenues.add(name2);
                    }
                }
            }
        }

        // Find events that need to be updated
        console.log('Merge Duplicate Venues: Finding events to update...');
        for (const operation of mergeOperations) {
            const secondaryVenueIds = operation.secondaryVenues.map(v => v.id);
            
            eventRecords.forEach(event => {
                const venueId = event.fields['Venue'] && event.fields['Venue'][0];
                if (venueId && secondaryVenueIds.includes(venueId)) {
                    operation.eventsToUpdate.push({
                        eventId: event.id,
                        eventName: event.fields['Event Name'] || 'Unnamed Event',
                        oldVenueId: venueId,
                        oldVenueName: venueMap.get(venueId)?.Name || 'Unknown'
                    });
                }
            });
        }

        // Perform the merges
        console.log(`Merge Duplicate Venues: Performing ${mergeOperations.length} merge operations...`);
        const results = [];
        const errors = [];

        for (const operation of mergeOperations) {
            try {
                console.log(`Merge Duplicate Venues: Processing ${operation.type} - ${operation.reason}`);
                
                // Update events to point to primary venue
                if (operation.eventsToUpdate.length > 0) {
                    const eventUpdates = operation.eventsToUpdate.map(event => ({
                        id: event.eventId,
                        fields: {
                            'Venue': [operation.primaryVenue.id],
                            'Venue Name': [operation.primaryVenue.fields.Name]
                        }
                    }));

                    await base('Events').update(eventUpdates);
                    console.log(`Merge Duplicate Venues: Updated ${eventUpdates.length} events`);
                }

                // Delete secondary venues
                const secondaryVenueIds = operation.secondaryVenues.map(v => v.id);
                await base('Venues').destroy(secondaryVenueIds);
                console.log(`Merge Duplicate Venues: Deleted ${secondaryVenueIds.length} duplicate venues`);

                results.push({
                    type: operation.type,
                    primaryVenue: {
                        id: operation.primaryVenue.id,
                        name: operation.primaryVenue.fields.Name,
                        usage: venueUsage.get(operation.primaryVenue.id) || 0
                    },
                    secondaryVenues: operation.secondaryVenues.map(v => ({
                        id: v.id,
                        name: v.fields.Name,
                        usage: venueUsage.get(v.id) || 0
                    })),
                    eventsUpdated: operation.eventsToUpdate.length,
                    reason: operation.reason
                });

            } catch (error) {
                console.error(`Merge Duplicate Venues: Error processing merge operation:`, error);
                errors.push({
                    operation: operation.reason,
                    error: error.message
                });
            }
        }

        console.log(`Merge Duplicate Venues: Completed. ${results.length} merges successful, ${errors.length} errors`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Duplicate venue merge process completed',
                summary: {
                    totalMergeOperations: mergeOperations.length,
                    successfulMerges: results.length,
                    errors: errors.length,
                    totalEventsUpdated: results.reduce((sum, r) => sum + r.eventsUpdated, 0),
                    totalVenuesDeleted: results.reduce((sum, r) => sum + r.secondaryVenues.length, 0)
                },
                results,
                errors,
                recommendations: [
                    'Run venue data validation to confirm all issues are resolved',
                    'Review the merged venues to ensure they have complete information',
                    'Consider implementing data validation rules to prevent future duplicates'
                ]
            })
        };

    } catch (error) {
        console.error('Merge Duplicate Venues: Error during merge process:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to merge duplicate venues',
                details: error.message
            })
        };
    }
};