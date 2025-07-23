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
        console.log('Venue List: Starting function');
        console.log('Venue List: API Key exists:', !!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN);
        console.log('Venue List: Base ID exists:', !!process.env.AIRTABLE_BASE_ID);
        
        if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        console.log('Venue List: Fetching venues from Airtable');
        const records = await base('Venues').select({
            sort: [{ field: 'Name', direction: 'asc' }]
        }).all();

        console.log(`Venue List: Found ${records.length} venues`);

        const venues = records.map(record => ({
            id: record.id,
            name: record.get('Name') || 'Unnamed Venue',
            address: record.get('Address') || '',
            description: record.get('Description') || '',
            website: record.get('Website') || '',
            phone: record.get('Phone') || ''
        }));

        console.log('Venue List: Returning venues successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(venues)
        };

    } catch (error) {
        console.error('Venue List: Error fetching venues:', error);
        console.error('Venue List: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch venues',
                details: error.message,
                stack: error.stack
            })
        };
    }
};
