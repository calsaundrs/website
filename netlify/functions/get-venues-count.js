const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Get total count of all venues
        const allVenues = await base('Venues').select({
            fields: ['Name']
        }).all();
        
        // Get count of approved venues
        const approvedVenues = await base('Venues').select({
            filterByFormula: "{Status} = 'Approved'",
            fields: ['Name']
        }).all();
        
        // Get count of pending venues
        const pendingVenues = await base('Venues').select({
            filterByFormula: "{Status} = 'Pending Review'",
            fields: ['Name']
        }).all();

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                count: allVenues.length,
                approved: approvedVenues.length,
                pending: pendingVenues.length
            }),
        };
    } catch (error) {
        console.error("Error in get-venues-count handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch venues count', details: error.toString() }),
        };
    }
};