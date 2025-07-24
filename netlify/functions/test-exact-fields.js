const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function (event, context) {
    try {
        const slug = event.queryStringParameters?.slug || 'mash-up-mondays';
        console.log('test-exact-fields: Looking for slug:', slug);
        
        // Use the exact same fields as get-event-details.js
        const escapedSlug = slug.replace(/"/g, '"');
        const eventRecords = await base('Events').select({
            maxRecords: 10,
            filterByFormula: `{Slug} = "${escapedSlug}"`,
            fields: ['Event Name', 'Slug', 'Series ID', 'Date', 'Venue', 'Venue Name', 'Category', 'Description', 'Status']
        }).firstPage();
        
        console.log('test-exact-fields: Found', eventRecords.length, 'events');
        
        if (eventRecords.length === 0) {
            return { statusCode: 404, body: 'No events found' };
        }
        
        const eventRecord = eventRecords[0];
        const fields = eventRecord.fields;
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                eventName: fields['Event Name'],
                slug: fields['Slug'],
                totalFound: eventRecords.length,
                availableFields: Object.keys(fields)
            })
        };
        
    } catch (error) {
        console.error('test-exact-fields: Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Test failed',
                details: error.message
            })
        };
    }
};