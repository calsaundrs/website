// netlify/functions/get-pending-items.js
const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('get-pending-items: Starting function execution');
    console.log('get-pending-items: AIRTABLE_BASE_ID:', AIRTABLE_BASE_ID ? 'Set' : 'Not set');
    console.log('get-pending-items: AIRTABLE_PERSONAL_ACCESS_TOKEN:', AIRTABLE_PERSONAL_ACCESS_TOKEN ? 'Set' : 'Not set');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('get-pending-items: Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Airtable configuration' }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        console.log('get-pending-items: Fetching pending events from Airtable...');
        
        // Try different possible status values
        const possibleStatuses = ['Pending Review', 'Pending', 'Review', 'Submitted'];
        let eventRecords = [];
        
        for (const status of possibleStatuses) {
            console.log(`get-pending-items: Trying status: "${status}"`);
            try {
                const records = await base('Events').select({
                    filterByFormula: `{Status} = '${status}'`,
                    fields: [
                        'Event Name', 
                        'Description', 
                        'VenueText', 
                        'Venue', 
                        'Submitter Email', 
                        'Date',
                        'Link', 
                        'Recurring Info', 
                        'Category', 
                        'Promo Image', 
                        'Parent Event Name',
                        'Status'
                    ]
                }).all();
                
                if (records.length > 0) {
                    console.log(`get-pending-items: Found ${records.length} events with status "${status}"`);
                    eventRecords = records;
                    break;
                }
            } catch (error) {
                console.log(`get-pending-items: Status "${status}" failed:`, error.message);
            }
        }
        
        // If no events found with specific statuses, try getting all events and filter by status
        if (eventRecords.length === 0) {
            console.log('get-pending-items: No events found with specific statuses, trying to get all events...');
            try {
                const allEvents = await base('Events').select({
                    fields: [
                        'Event Name', 
                        'Description', 
                        'VenueText', 
                        'Venue', 
                        'Submitter Email', 
                        'Date',
                        'Link', 
                        'Recurring Info', 
                        'Category', 
                        'Promo Image', 
                        'Parent Event Name',
                        'Status'
                    ]
                }).all();
                
                // Filter for pending-like statuses
                eventRecords = allEvents.filter(record => {
                    const status = record.fields.Status || '';
                    return status.toLowerCase().includes('pending') || 
                           status.toLowerCase().includes('review') || 
                           status.toLowerCase().includes('submitted');
                });
                
                console.log(`get-pending-items: Found ${eventRecords.length} events after filtering all events`);
            } catch (error) {
                console.error('get-pending-items: Error getting all events:', error);
            }
        }

        console.log(`get-pending-items: Final count: ${eventRecords.length} pending events`);

        // Process events
        const formattedEvents = eventRecords.map(record => {
            const fields = record.fields;
            console.log(`get-pending-items: Processing event: ${fields['Event Name'] || 'Unnamed'} (Status: ${fields.Status || 'No Status'})`);
            
            const newFields = { ...fields };

            // Handle venue information
            if (newFields.Venue && newFields.Venue.length > 0) {
                newFields['Venue Name'] = ['Venue ID: ' + newFields.Venue[0]]; // Simplified for now
            } else if (newFields.VenueText) {
                newFields['Venue Name'] = [newFields.VenueText];
            }

            // Remap email field
            if (newFields['Submitter Email']) {
                newFields['Contact Email'] = newFields['Submitter Email'];
                delete newFields['Submitter Email'];
            }
            
            // Add type field
            newFields.Type = 'Event'; 

            return {
                id: record.id,
                fields: newFields
            };
        });

        console.log(`get-pending-items: Successfully formatted ${formattedEvents.length} events`);

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formattedEvents),
        };
    } catch (error) {
        console.error("get-pending-items: Critical error:", error);
        console.error("get-pending-items: Error stack:", error.stack);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to fetch pending items', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};
