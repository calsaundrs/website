const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Get settings from Airtable (if you have a Settings table)
        // For now, return environment variables as settings
        const settings = {
            geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
            googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
            cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
            cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
            cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
            airtablePersonalAccessToken: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN ? '***HIDDEN***' : '',
            airtableBaseId: process.env.AIRTABLE_BASE_ID || ''
        };

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings),
        };
    } catch (error) {
        console.error("Error in get-settings handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch settings', details: error.toString() }),
        };
    }
};