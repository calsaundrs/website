const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function (event, context) {
    try {
        const slug = event.queryStringParameters?.slug || 'mash-up-mondays';
        console.log('test-with-venue: Looking for slug:', slug);
        
        // Use the exact same fields as get-event-details.js
        const escapedSlug = slug.replace(/"/g, '"');
        const eventRecords = await base('Events').select({
            maxRecords: 10,
            filterByFormula: `{Slug} = "${escapedSlug}"`,
            fields: ['Event Name', 'Slug', 'Series ID', 'Date', 'Venue', 'Venue Name', 'Category', 'Description', 'Status']
        }).firstPage();
        
        console.log('test-with-venue: Found', eventRecords.length, 'events');
        
        if (eventRecords.length === 0) {
            return { statusCode: 404, body: 'No events found' };
        }
        
        const eventRecord = eventRecords[0];
        const fields = eventRecord.fields;
        
        // Test venue lookup
        const venueId = fields['Venue'] ? fields['Venue'][0] : null;
        console.log('test-with-venue: Venue ID:', venueId);
        
        let venueInfo = null;
        if (venueId) {
            try {
                console.log('test-with-venue: Attempting to fetch venue record');
                const venueRecord = await base('Venues').find(venueId);
                venueInfo = {
                    name: venueRecord.get('Name'),
                    status: venueRecord.get('Listing Status'),
                    slug: venueRecord.get('Slug')
                };
                console.log('test-with-venue: Venue record found:', venueInfo.name);
            } catch (venueError) {
                console.error('test-with-venue: Venue error:', venueError);
                return { 
                    statusCode: 500, 
                    body: JSON.stringify({ error: 'Venue lookup failed', details: venueError.message })
                };
            }
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                eventName: fields['Event Name'],
                slug: fields['Slug'],
                totalFound: eventRecords.length,
                venueId: venueId,
                venueInfo: venueInfo
            })
        };
        
    } catch (error) {
        console.error('test-with-venue: Error:', error);
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