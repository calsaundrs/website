const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('debug-events: Starting debug function');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Airtable configuration' }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        // Get all events to see what status values exist
        console.log('debug-events: Fetching all events to check status values...');
        
        const allEvents = await base('Events').select({
            fields: ['Event Name', 'Status', 'Date']
        }).all();

        console.log(`debug-events: Found ${allEvents.length} total events`);

        // Count status values
        const statusCounts = {};
        const sampleEvents = [];

        allEvents.forEach(record => {
            const status = record.fields.Status || 'No Status';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            // Keep first 5 events of each status for samples
            if (!sampleEvents.find(e => e.status === status) || sampleEvents.filter(e => e.status === status).length < 5) {
                sampleEvents.push({
                    id: record.id,
                    name: record.fields['Event Name'] || 'Unnamed',
                    status: status,
                    date: record.fields.Date
                });
            }
        });

        // Get pending events specifically
        console.log('debug-events: Fetching pending events...');
        const pendingEvents = await base('Events').select({
            filterByFormula: "{Status} = 'Pending Review'",
            fields: ['Event Name', 'Status', 'Date']
        }).all();

        console.log(`debug-events: Found ${pendingEvents.length} pending events`);

        const result = {
            totalEvents: allEvents.length,
            statusCounts: statusCounts,
            pendingEventsCount: pendingEvents.length,
            sampleEvents: sampleEvents,
            availableStatuses: Object.keys(statusCounts),
            pendingEvents: pendingEvents.map(record => ({
                id: record.id,
                name: record.fields['Event Name'] || 'Unnamed',
                status: record.fields.Status,
                date: record.fields.Date
            }))
        };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(result),
        };
    } catch (error) {
        console.error("debug-events: Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to debug events', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};