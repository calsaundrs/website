const Airtable = require('airtable');

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
        console.log('Event-Venue Data Validation: Starting validation process');
        
        if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get all events
        console.log('Event-Venue Data Validation: Fetching all events');
        const eventRecords = await base('Events').select({
            fields: ['Event Name', 'Venue', 'Venue Name', 'VenueText', 'Status']
        }).all();

        // Get all venues
        console.log('Event-Venue Data Validation: Fetching all venues');
        const venueRecords = await base('Venues').select({
            fields: ['Name', 'Address']
        }).all();

        const venueMap = new Map();
        venueRecords.forEach(venue => {
            venueMap.set(venue.id, venue.fields);
            venueMap.set(venue.fields.Name?.toLowerCase(), venue.fields);
        });

        const issues = [];
        const fixes = [];
        let processedCount = 0;

        console.log(`Event-Venue Data Validation: Processing ${eventRecords.length} events`);

        for (const eventRecord of eventRecords) {
            const fields = eventRecord.fields;
            const eventName = fields['Event Name'] || 'Unnamed Event';
            let hasIssue = false;
            let issueDescription = '';

            // Check venue data consistency
            const venueRecord = fields['Venue'] && fields['Venue'][0];
            const venueName = fields['Venue Name'] && fields['Venue Name'][0];
            const venueText = fields['VenueText'];

            // Issue 1: Missing venue data entirely
            if (!venueRecord && !venueName && !venueText) {
                hasIssue = true;
                issueDescription = 'No venue data found';
                issues.push({
                    eventId: eventRecord.id,
                    eventName,
                    issue: 'Missing venue data',
                    severity: 'high'
                });
            }

            // Issue 2: Inconsistent venue data
            if (venueRecord && venueName && venueRecord !== venueName) {
                hasIssue = true;
                issueDescription = 'Venue record and venue name mismatch';
                issues.push({
                    eventId: eventRecord.id,
                    eventName,
                    issue: 'Venue record and venue name mismatch',
                    severity: 'medium',
                    details: {
                        venueRecord,
                        venueName
                    }
                });
            }

            // Issue 3: Venue record exists but venue not found
            if (venueRecord && !venueMap.has(venueRecord)) {
                hasIssue = true;
                issueDescription = 'Venue record references non-existent venue';
                issues.push({
                    eventId: eventRecord.id,
                    eventName,
                    issue: 'Venue record references non-existent venue',
                    severity: 'high',
                    details: {
                        venueRecord
                    }
                });
            }

            // Issue 4: Venue text exists but no corresponding venue record
            if (venueText && !venueRecord) {
                // Check if we can find a matching venue by name
                const matchingVenue = venueMap.get(venueText.toLowerCase());
                if (matchingVenue) {
                    hasIssue = true;
                    issueDescription = 'Venue text exists but no venue record linked';
                    issues.push({
                        eventId: eventRecord.id,
                        eventName,
                        issue: 'Venue text exists but no venue record linked',
                        severity: 'medium',
                        details: {
                            venueText,
                            suggestedVenueId: venueMap.get(venueText.toLowerCase())?.id
                        }
                    });
                }
            }

            processedCount++;
            if (processedCount % 50 === 0) {
                console.log(`Event-Venue Data Validation: Processed ${processedCount}/${eventRecords.length} events`);
            }
        }

        console.log(`Event-Venue Data Validation: Found ${issues.length} issues`);

        // Generate summary
        const summary = {
            totalEvents: eventRecords.length,
            totalVenues: venueRecords.length,
            issuesFound: issues.length,
            issuesBySeverity: {
                high: issues.filter(i => i.severity === 'high').length,
                medium: issues.filter(i => i.severity === 'medium').length,
                low: issues.filter(i => i.severity === 'low').length
            },
            issuesByType: {}
        };

        issues.forEach(issue => {
            const type = issue.issue;
            if (!summary.issuesByType[type]) {
                summary.issuesByType[type] = 0;
            }
            summary.issuesByType[type]++;
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                summary,
                issues,
                recommendations: [
                    'Events with missing venue data should be reviewed and updated',
                    'Venue record mismatches should be resolved by linking to correct venues',
                    'Consider implementing data validation rules in the submission process',
                    'Regular data audits should be performed to maintain data integrity'
                ]
            })
        };

    } catch (error) {
        console.error('Event-Venue Data Validation: Error during validation:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to validate event-venue data',
                details: error.message
            })
        };
    }
};