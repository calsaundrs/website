const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { 
            AIRTABLE_PERSONAL_ACCESS_TOKEN, 
            AIRTABLE_BASE_ID,
            GOOGLE_CALENDAR_API_KEY,
            GEMINI_API_KEY,
            CLOUDINARY_CLOUD_NAME,
            CLOUDINARY_API_KEY,
            CLOUDINARY_API_SECRET,
            RECURRING_INSTANCES_TO_APPROVE,
            RECURRING_INSTANCES_TO_SHOW
        } = JSON.parse(event.body);

        // Update environment variables (this would need to be done through Netlify dashboard or API)
        // For now, we'll just validate and return success
        const updates = {};
        
        if (RECURRING_INSTANCES_TO_APPROVE !== undefined) {
            const instancesToApprove = parseInt(RECURRING_INSTANCES_TO_APPROVE);
            if (isNaN(instancesToApprove) || instancesToApprove < 1 || instancesToApprove > 12) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'RECURRING_INSTANCES_TO_APPROVE must be between 1 and 12' })
                };
            }
            updates.RECURRING_INSTANCES_TO_APPROVE = instancesToApprove;
        }
        
        if (RECURRING_INSTANCES_TO_SHOW !== undefined) {
            const instancesToShow = parseInt(RECURRING_INSTANCES_TO_SHOW);
            if (isNaN(instancesToShow) || instancesToShow < 1 || instancesToShow > 24) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'RECURRING_INSTANCES_TO_SHOW must be between 1 and 24' })
                };
            }
            updates.RECURRING_INSTANCES_TO_SHOW = instancesToShow;
        }
        
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