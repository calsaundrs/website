const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('debug-venues: Starting debug function');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Airtable configuration' }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        // Get all venues to see what status values exist
        console.log('debug-venues: Fetching all venues to check status values...');
        
        const allVenues = await base('Venues').select({
            fields: ['Name', 'Status', 'Created Time']
        }).all();

        console.log(`debug-venues: Found ${allVenues.length} total venues`);

        // Count status values
        const statusCounts = {};
        const sampleVenues = [];

        allVenues.forEach(record => {
            const status = record.fields.Status || 'No Status';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            // Keep first 5 venues of each status for samples
            if (!sampleVenues.find(v => v.status === status) || sampleVenues.filter(v => v.status === status).length < 5) {
                sampleVenues.push({
                    id: record.id,
                    name: record.fields.Name || 'Unnamed',
                    status: status,
                    createdTime: record.fields['Created Time']
                });
            }
        });

        // Get pending venues specifically
        console.log('debug-venues: Fetching pending venues...');
        const pendingVenues = await base('Venues').select({
            filterByFormula: "{Status} = 'Pending Review'",
            fields: ['Name', 'Status', 'Created Time']
        }).all();

        console.log(`debug-venues: Found ${pendingVenues.length} pending venues`);

        const result = {
            totalVenues: allVenues.length,
            statusCounts: statusCounts,
            pendingVenuesCount: pendingVenues.length,
            sampleVenues: sampleVenues,
            availableStatuses: Object.keys(statusCounts),
            pendingVenues: pendingVenues.map(record => ({
                id: record.id,
                name: record.fields.Name || 'Unnamed',
                status: record.fields.Status,
                createdTime: record.fields['Created Time']
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
        console.error("debug-venues: Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to debug venues', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};