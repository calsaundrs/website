const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('debug-airtable-fields: Starting function execution');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('debug-airtable-fields: Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Missing Airtable configuration',
                details: 'Environment variables not properly configured'
            }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        console.log('debug-airtable-fields: Fetching sample records from Events table...');
        
        // Get a few sample records to analyze the structure
        const sampleRecords = await base('Events').select({
            maxRecords: 5,
            fields: ['Event Name', 'Date'] // Just get basic fields first
        }).all();

        console.log(`debug-airtable-fields: Found ${sampleRecords.length} sample records`);

        if (sampleRecords.length === 0) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'No events found in the table',
                    availableFields: [],
                    sampleRecords: []
                })
            };
        }

        // Analyze the first record to get all available fields
        const firstRecord = sampleRecords[0];
        const availableFields = Object.keys(firstRecord.fields);
        
        console.log('debug-airtable-fields: Available fields:', availableFields);

        // Check for recurring-related fields
        const recurringFields = availableFields.filter(field => 
            field.toLowerCase().includes('recurring') || 
            field.toLowerCase().includes('series') ||
            field.toLowerCase().includes('repeat')
        );

        // Check for image-related fields
        const imageFields = availableFields.filter(field => 
            field.toLowerCase().includes('image') || 
            field.toLowerCase().includes('photo') ||
            field.toLowerCase().includes('picture')
        );

        // Get a sample of records with recurring info
        const recurringRecords = sampleRecords.filter(record => {
            const fields = record.fields;
            return fields['Recurring Info'] || fields['Series ID'] || 
                   fields['Recurring'] || fields['Series'] ||
                   fields['Repeat'];
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Airtable fields analysis',
                totalRecords: sampleRecords.length,
                availableFields: availableFields,
                recurringFields: recurringFields,
                imageFields: imageFields,
                recurringRecordsFound: recurringRecords.length,
                sampleRecord: {
                    id: firstRecord.id,
                    fields: firstRecord.fields
                },
                recurringRecords: recurringRecords.map(record => ({
                    id: record.id,
                    name: record.fields['Event Name'],
                    recurringInfo: record.fields['Recurring Info'] || record.fields['Recurring'] || record.fields['Series'] || record.fields['Repeat'],
                    seriesId: record.fields['Series ID'] || record.fields['Series'],
                    date: record.fields['Date']
                }))
            })
        };
    } catch (error) {
        console.error("debug-airtable-fields: Critical error:", error);
        console.error("debug-airtable-fields: Error stack:", error.stack);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to analyze Airtable fields', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};