const Airtable = require('airtable');

exports.handler = async function (event, context) {
    console.log('Starting comprehensive field audit...');
    
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
        
        // Get multiple records to see more fields
        const events = await base('Events').select({
            maxRecords: 5
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
        
        // Collect all unique fields from all records
        const allFields = new Set();
        events.forEach(event => {
            Object.keys(event.fields).forEach(field => allFields.add(field));
        });
        
        const fieldNames = Array.from(allFields).sort();
        console.log('Found fields:', fieldNames);
        
        // Analyze each field
        const fieldAnalysis = {};
        const sampleEvent = events[0];
        
        for (const fieldName of fieldNames) {
            try {
                // Try to get the field value
                const value = sampleEvent.get(fieldName);
                fieldAnalysis[fieldName] = {
                    accessible: true,
                    value: value,
                    type: typeof value,
                    isArray: Array.isArray(value),
                    isNull: value === null,
                    isUndefined: value === undefined,
                    stringLength: typeof value === 'string' ? value.length : null
                };
            } catch (error) {
                fieldAnalysis[fieldName] = {
                    accessible: false,
                    error: error.message,
                    type: 'computed',
                    errorType: error.constructor.name
                };
            }
        }
        
        // Also try to get table metadata
        let tableInfo = null;
        try {
            // Try to get table information
            const table = base('Events');
            tableInfo = {
                name: 'Events',
                recordCount: events.length
            };
        } catch (error) {
            tableInfo = {
                error: error.message
            };
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Comprehensive field audit completed',
                totalFields: fieldNames.length,
                fields: fieldAnalysis,
                fieldNames: fieldNames,
                sampleRecordId: sampleEvent.id,
                tableInfo: tableInfo,
                recordsAnalyzed: events.length,
                rawFields: events[0].fields // Include raw fields for debugging
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
                stack: error.stack,
                type: error.constructor.name
            })
        };
    }
};