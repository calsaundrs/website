const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function (event, context) {
    try {
        console.log('check-fields: Starting field check...');
        
        // Get one record to see what fields are available
        const records = await base('Events').select({
            maxRecords: 1
            // Don't specify fields to get all available fields
        }).firstPage();
        
        if (records.length === 0) {
            return { statusCode: 404, body: 'No events found' };
        }
        
        const record = records[0];
        const availableFields = Object.keys(record.fields);
        
        console.log('check-fields: Available fields:', availableFields);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                availableFields: availableFields,
                totalFields: availableFields.length
            }, null, 2)
        };
        
    } catch (error) {
        console.error('check-fields: Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to check fields',
                details: error.message
            })
        };
    }
};