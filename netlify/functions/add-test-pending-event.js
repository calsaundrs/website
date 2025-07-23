const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('add-test-pending-event: Starting function execution');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('add-test-pending-event: Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Airtable configuration' }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        // Create a test pending event
        const testEvent = {
            'Event Name': 'Test Pending Event - ' + new Date().toISOString(),
            'Description': 'This is a test event for debugging the pending items function',
            'Date': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            'Status': 'Pending Review',
            'Submitter Email': 'test@example.com',
            'Category': ['Test'],
            'VenueText': 'Test Venue'
        };

        console.log('add-test-pending-event: Creating test event:', testEvent);

        const record = await base('Events').create([
            {
                fields: testEvent
            }
        ]);

        console.log('add-test-pending-event: Test event created successfully:', record[0].id);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                success: true, 
                message: 'Test pending event created',
                eventId: record[0].id,
                eventName: testEvent['Event Name']
            }),
        };
    } catch (error) {
        console.error("add-test-pending-event: Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to create test event', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};