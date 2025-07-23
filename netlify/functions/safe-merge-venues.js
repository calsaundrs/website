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
        console.log('Safe Merge Venues: Starting safe merge process...');
        
        if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        // Parse the request body to get the specific merge operations
        const requestBody = JSON.parse(event.body);
        const { mergeOperations } = requestBody;

        if (!mergeOperations || !Array.isArray(mergeOperations)) {
            throw new Error('Missing or invalid mergeOperations array');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get all events to see venue usage
        console.log('Safe Merge Venues: Fetching all events...');
        const eventRecords = await base('Events').select({
            fields: ['Event Name', 'Venue', 'Venue Name', 'VenueText']
        }).all();

        const results = [];
        const errors = [];

        for (const operation of mergeOperations) {
            try {
                const { primaryVenueId, secondaryVenueIds, reason } = operation;
                
                if (!primaryVenueId || !secondaryVenueIds || !Array.isArray(secondaryVenueIds)) {
                    errors.push({
                        operation: reason || 'Unknown operation',
                        error: 'Invalid operation data - missing primaryVenueId or secondaryVenueIds'
                    });
                    continue;
                }

                console.log(`Safe Merge Venues: Processing merge - ${reason}`);
                console.log(`Primary venue: ${primaryVenueId}`);
                console.log(`Secondary venues: ${secondaryVenueIds.join(', ')}`);

                // Find events that need to be updated
                const eventsToUpdate = [];
                eventRecords.forEach(event => {
                    const venueId = event.fields['Venue'] && event.fields['Venue'][0];
                    if (venueId && secondaryVenueIds.includes(venueId)) {
                        eventsToUpdate.push({
                            eventId: event.id,
                            eventName: event.fields['Event Name'] || 'Unnamed Event',
                            oldVenueId: venueId
                        });
                    }
                });

                console.log(`Safe Merge Venues: Found ${eventsToUpdate.length} events to update`);

                // Update events to point to primary venue
                if (eventsToUpdate.length > 0) {
                    const eventUpdates = eventsToUpdate.map(event => ({
                        id: event.eventId,
                        fields: {
                            'Venue': [primaryVenueId]
                        }
                    }));

                    await base('Events').update(eventUpdates);
                    console.log(`Safe Merge Venues: Updated ${eventUpdates.length} events`);
                }

                // Delete secondary venues
                await base('Venues').destroy(secondaryVenueIds);
                console.log(`Safe Merge Venues: Deleted ${secondaryVenueIds.length} duplicate venues`);

                results.push({
                    primaryVenueId,
                    secondaryVenueIds,
                    eventsUpdated: eventsToUpdate.length,
                    venuesDeleted: secondaryVenueIds.length,
                    reason
                });

            } catch (error) {
                console.error(`Safe Merge Venues: Error processing merge operation:`, error);
                errors.push({
                    operation: operation.reason || 'Unknown operation',
                    error: error.message
                });
            }
        }

        console.log(`Safe Merge Venues: Completed. ${results.length} merges successful, ${errors.length} errors`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Safe venue merge process completed',
                summary: {
                    totalOperations: mergeOperations.length,
                    successfulMerges: results.length,
                    errors: errors.length,
                    totalEventsUpdated: results.reduce((sum, r) => sum + r.eventsUpdated, 0),
                    totalVenuesDeleted: results.reduce((sum, r) => sum + r.venuesDeleted, 0)
                },
                results,
                errors,
                recommendations: [
                    'Run venue data validation to confirm all issues are resolved',
                    'Review the merged venues to ensure they have complete information'
                ]
            })
        };

    } catch (error) {
        console.error('Safe Merge Venues: Error during merge process:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to merge venues',
                details: error.message
            })
        };
    }
};