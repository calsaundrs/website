const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('test-recurring-detection: Starting function execution');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('test-recurring-detection: Missing required environment variables');
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
        console.log('test-recurring-detection: Fetching all events...');
        
        // Get all events without field restrictions
        const allRecords = await base('Events').select({
            maxRecords: 10
        }).all();

        console.log(`test-recurring-detection: Found ${allRecords.length} total events`);

        // Helper function to safely get field values
        const getField = (fields, fieldName, defaultValue = null) => {
            return fields.hasOwnProperty(fieldName) ? fields[fieldName] : defaultValue;
        };

        // Check each record for recurring fields
        const recurringEvents = [];
        const fieldAnalysis = [];

        allRecords.forEach((record, index) => {
            const fields = record.fields;
            const availableFields = Object.keys(fields);
            
            // Check for recurring-related fields
            const hasRecurringInfo = getField(fields, 'Recurring Info');
            const hasSeriesId = getField(fields, 'Series ID') || getField(fields, 'seriesId');
            const hasRecurring = getField(fields, 'Recurring');
            const hasSeries = getField(fields, 'Series');
            const hasRepeat = getField(fields, 'Repeat');
            const hasRecurrence = getField(fields, 'Recurrence');
            const hasRecurringPattern = getField(fields, 'Recurring Pattern');
            const hasFrequency = getField(fields, 'Frequency');
            const hasRepeatEvery = getField(fields, 'Repeat Every');
            const hasWeekly = getField(fields, 'Weekly');
            const hasMonthly = getField(fields, 'Monthly');
            const hasYearly = getField(fields, 'Yearly');
            
            const isRecurring = hasRecurringInfo || hasSeriesId || hasRecurring || hasSeries || hasRepeat || 
                               hasRecurrence || hasRecurringPattern || hasFrequency || hasRepeatEvery ||
                               hasWeekly || hasMonthly || hasYearly;

            // Record analysis for each event
            fieldAnalysis.push({
                recordIndex: index,
                id: record.id,
                name: getField(fields, 'Event Name'),
                availableFields: availableFields,
                hasRecurringInfo: !!hasRecurringInfo,
                hasSeriesId: !!hasSeriesId,
                seriesIdValue: hasSeriesId,
                hasRecurring: !!hasRecurring,
                hasSeries: !!hasSeries,
                hasRepeat: !!hasRepeat,
                hasRecurrence: !!hasRecurrence,
                hasRecurringPattern: !!hasRecurringPattern,
                hasFrequency: !!hasFrequency,
                hasRepeatEvery: !!hasRepeatEvery,
                hasWeekly: !!hasWeekly,
                hasMonthly: !!hasMonthly,
                hasYearly: !!hasYearly,
                isRecurring: isRecurring,
                allFields: fields
            });

            if (isRecurring) {
                recurringEvents.push({
                    id: record.id,
                    name: getField(fields, 'Event Name'),
                    recurringInfo: hasRecurringInfo,
                    seriesId: hasSeriesId,
                    seriesIdField: getField(fields, 'Series ID'),
                    seriesIdCamel: getField(fields, 'seriesId'),
                    recurring: hasRecurring,
                    series: hasSeries,
                    repeat: hasRepeat,
                    recurrence: hasRecurrence,
                    recurringPattern: hasRecurringPattern,
                    frequency: hasFrequency,
                    repeatEvery: hasRepeatEvery,
                    weekly: hasWeekly,
                    monthly: hasMonthly,
                    yearly: hasYearly
                });
            }
        });

        console.log(`test-recurring-detection: Found ${recurringEvents.length} recurring events`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: JSON.stringify({
                message: 'Recurring events detection test',
                totalRecords: allRecords.length,
                recurringEventsFound: recurringEvents.length,
                recurringEvents: recurringEvents,
                fieldAnalysis: fieldAnalysis,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error("test-recurring-detection: Critical error:", error);
        console.error("test-recurring-detection: Error stack:", error.stack);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to test recurring detection', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};