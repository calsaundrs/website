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
        
        // First, let's get ALL events to see what statuses exist
        console.log('get-pending-items: Getting all events to check status values...');
        const allEventsCheck = await base('Events').select({
            fields: ['Event Name', 'Status', 'Created Time']
        }).all();
        
        console.log(`get-pending-items: Total events in database: ${allEventsCheck.length}`);
        
        // Count status values
        const statusCounts = {};
        allEventsCheck.forEach(record => {
            const status = record.fields.Status || 'No Status';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        console.log('get-pending-items: Status counts:', statusCounts);
        
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
                        'Series ID',
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
                        'Series ID',
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

        // Filter out individual recurring event instances
        // Only show parent recurring events or standalone events
        const filteredEvents = formattedEvents.filter(event => {
            const fields = event.fields;
            
            // If it has a Series ID that's different from its own ID, it's an individual instance - exclude it
            if (fields['Series ID'] && fields['Series ID'] !== event.id) {
                console.log(`get-pending-items: Excluding recurring instance: ${fields['Event Name']} (Series ID: ${fields['Series ID']}, Event ID: ${event.id})`);
                return false;
            }
            
            // If it has Recurring Info but no Series ID (or Series ID equals its own ID), it's a parent recurring event - include it
            if (fields['Recurring Info']) {
                console.log(`get-pending-items: Including parent recurring event: ${fields['Event Name']}`);
                return true;
            }
            
            // If it has no recurring info, it's a standalone event - include it
            console.log(`get-pending-items: Including standalone event: ${fields['Event Name']}`);
            return true;
        });

        console.log(`get-pending-items: After filtering recurring instances: ${filteredEvents.length} events (removed ${formattedEvents.length - filteredEvents.length} instances)`);

        console.log(`get-pending-items: Successfully formatted ${filteredEvents.length} events`);

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filteredEvents),
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
