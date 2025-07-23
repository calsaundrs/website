const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('get-recurring-events: Starting function execution');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('get-recurring-events: Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Airtable configuration' }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        // Get all events that have recurring information
        console.log('get-recurring-events: Fetching recurring events from Airtable...');
        
        // First, let's get ALL events to see what fields are available
        console.log('get-recurring-events: Getting all events to check available fields...');
        const testQuery = await base('Events').select({
            maxRecords: 1,
            fields: ['Event Name']
        }).all();
        
        if (testQuery.length > 0) {
            console.log('get-recurring-events: Sample record fields:', Object.keys(testQuery[0].fields));
        }
        
        // Simple query to get all events with basic fields
        const allRecords = await base('Events').select({
            fields: [
                'Event Name', 
                'Description', 
                'Date',
                'VenueText', 
                'Venue', 
                'Venue Name',
                'Category', 
                'Recurring Info', 
                'Series ID',
                'Status'
            ]
        }).all();

        console.log(`get-recurring-events: Found ${allRecords.length} total events`);

        // Check if we have any recurring events
        const recurringEvents = allRecords.filter(record => {
            const fields = record.fields;
            return fields['Recurring Info'] || fields['Series ID'];
        });
        
        console.log(`get-recurring-events: Found ${recurringEvents.length} events with recurring info`);

        // For now, just return the basic recurring events data
        const simpleRecurringEvents = recurringEvents.map(record => {
            const fields = record.fields;
            return {
                id: record.id,
                name: fields['Event Name'],
                description: fields['Description'],
                date: fields['Date'],
                venue: fields['VenueText'] || (fields['Venue Name'] ? fields['Venue Name'][0] : 'TBC'),
                recurringInfo: fields['Recurring Info'],
                seriesId: fields['Series ID'],
                status: fields['Status'],
                category: fields['Category'] || []
            };
        });

        console.log(`get-recurring-events: Returning ${simpleRecurringEvents.length} recurring events`);

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recurringEvents: simpleRecurringEvents,
                totalEvents: allRecords.length,
                recurringCount: recurringEvents.length
            }),
        };
    } catch (error) {
        console.error("get-recurring-events: Critical error:", error);
        console.error("get-recurring-events: Error stack:", error.stack);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to fetch recurring events', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};