// netlify/functions/archive-event.js
const Airtable = require('airtable');

// Initialize Airtable
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ success: false, message: 'Method Not Allowed' }),
        };
    }

    try {
        const { id, type, deleteSeries } = JSON.parse(event.body); // 'type' is included but 'id' is primary

        if (!id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, message: 'Record ID is required for archiving.' }),
            };
        }

        if (deleteSeries) {
            // Delete entire series
            const currentEvent = await base('Events').find(id);
            const parentEventName = currentEvent.fields['Parent Event Name'];
            
            if (parentEventName) {
                // Find all events in the series
                const seriesEvents = await base('Events').select({
                    filterByFormula: `{Parent Event Name} = "${parentEventName.replace(/"/g, '\"')}"`
                }).all();
                
                // Archive all events in the series
                const batchUpdates = seriesEvents.map(event => ({
                    id: event.id,
                    fields: { "Status": "Archived" }
                }));
                
                // Update in batches of 10
                const batchSize = 10;
                for (let i = 0; i < batchUpdates.length; i += batchSize) {
                    const batch = batchUpdates.slice(i, i + batchSize);
                    await base('Events').update(batch);
                }
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: `Series with ${batchUpdates.length} events archived successfully!` }),
                };
            }
        }

        // Single event archive
        await base('Events').update([
            {
                id: id,
                fields: {
                    "Status": "Archived" // Set the status to 'Archived'
                    // Or, if you have a boolean 'IsActive' field: "IsActive": false
                },
            },
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: `Event ${id} archived successfully!` }),
        };
    } catch (error) {
        console.error('Error archiving event:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: `Failed to archive event: ${error.message}` }),
        };
    }
};
