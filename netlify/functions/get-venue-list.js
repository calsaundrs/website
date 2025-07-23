const Airtable = require('airtable');

exports.handler = async function(event, context) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        
        const records = await base('Venues').select({
            sort: [{ field: 'Name', direction: 'asc' }]
        }).all();

        const venues = records.map(record => ({
            id: record.id,
            name: record.get('Name') || 'Unnamed Venue',
            address: record.get('Address') || '',
            description: record.get('Description') || '',
            website: record.get('Website') || '',
            phone: record.get('Phone') || ''
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(venues)
        };

    } catch (error) {
        console.error('Error fetching venues:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch venues',
                details: error.message 
            })
        };
    }
};
