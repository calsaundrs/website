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
            'AIRTABLE_PERSONAL_ACCESS_TOKEN': AIRTABLE_PERSONAL_ACCESS_TOKEN ? 'Set' : 'Not set',
            'AIRTABLE_BASE_ID': AIRTABLE_BASE_ID ? 'Set' : 'Not set',
            'GOOGLE_CALENDAR_API_KEY': process.env.GOOGLE_CALENDAR_API_KEY ? 'Set' : 'Not set',
            'GEMINI_API_KEY': process.env.GEMINI_API_KEY ? 'Set' : 'Not set',
            'CLOUDINARY_CLOUD_NAME': process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Not set',
            'CLOUDINARY_API_KEY': process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
            'CLOUDINARY_API_SECRET': process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set',
            'RECURRING_INSTANCES_TO_APPROVE': process.env.RECURRING_INSTANCES_TO_APPROVE || '3',
            'RECURRING_INSTANCES_TO_SHOW': process.env.RECURRING_INSTANCES_TO_SHOW || '6'
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