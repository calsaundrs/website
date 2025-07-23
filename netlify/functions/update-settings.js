const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const settings = JSON.parse(event.body);
        
        // For now, just log the settings (since we can't modify environment variables at runtime)
        // In a real implementation, you might store these in Airtable or another database
        console.log('Settings update requested:', Object.keys(settings));
        
        // You could store settings in Airtable like this:
        // const settingsTable = base('Settings');
        // await settingsTable.create([{ fields: settings }]);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                success: true, 
                message: 'Settings updated successfully (logged to console)' 
            }),
        };
    } catch (error) {
        console.error("Error in update-settings handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update settings', details: error.toString() }),
        };
    }
};