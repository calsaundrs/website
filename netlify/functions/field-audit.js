const Airtable = require('airtable');

exports.handler = async function (event, context) {
    console.log('Starting field audit...');
    
    try {
        // Check environment variables
        const required = [
            'AIRTABLE_PERSONAL_ACCESS_TOKEN',
            'AIRTABLE_BASE_ID'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }
        
        // Initialize Airtable
        const base = new Airtable({ 
            apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
        }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get a sample record to see the field structure
        const events = await base('Events').select({
            fields: ['Event Name'],
            maxRecords: 1
        }).all();
        
        if (events.length === 0) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'No events found in table',
                    fields: []
                })
            };
        }
        
        const sampleEvent = events[0];
        const fields = Object.keys(sampleEvent.fields);
        
        // Try to access each field to see which ones are computed
        const fieldAnalysis = {};
        
        for (const fieldName of fields) {
            try {
                const value = sampleEvent.get(fieldName);
                fieldAnalysis[fieldName] = {
                    accessible: true,
                    value: value,
                    type: typeof value,
                    isArray: Array.isArray(value)
                };
            } catch (error) {
                fieldAnalysis[fieldName] = {
                    accessible: false,
                    error: error.message,
                    type: 'computed'
                };
            }
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Field audit completed',
                totalFields: fields.length,
                fields: fieldAnalysis,
                sampleRecordId: sampleEvent.id
            })
        };
        
    } catch (error) {
        console.error('Field audit failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Field audit failed',
                message: error.message,
                stack: error.stack
            })
        };
    }
};