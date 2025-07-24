const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function (event, context) {
    try {
        const slug = 'mash-up-mondays';
        console.log('test-event-details: Starting test for slug:', slug);
        
        // Step 1: Find events with the slug
        const escapedSlug = slug.replace(/"/g, '"');
        const eventRecords = await base('Events').select({
            maxRecords: 10,
            filterByFormula: `{Slug} = "${escapedSlug}"`,
            fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date', 'Venue', 'Venue Name', 'VenueText', 'Category', 'Description', 'Address', 'Price', 'Age Restriction', 'Link', 'Parent Event Name']
        }).firstPage();
        
        console.log('test-event-details: Found', eventRecords.length, 'events');
        
        if (eventRecords.length === 0) {
            return { statusCode: 404, body: 'No events found' };
        }
        
        // Step 2: Get the first event
        const eventRecord = eventRecords[0];
        const fields = eventRecord.fields;
        
        console.log('test-event-details: Event name:', fields['Event Name']);
        console.log('test-event-details: Venue field:', fields['Venue']);
        console.log('test-event-details: Venue Name field:', fields['Venue Name']);
        
        // Step 3: Try to access venue information
        const venueId = fields['Venue'] ? fields['Venue'][0] : null;
        console.log('test-event-details: Venue ID:', venueId);
        
        if (venueId) {
            try {
                console.log('test-event-details: Attempting to fetch venue record');
                const venueRecord = await base('Venues').find(venueId);
                console.log('test-event-details: Venue record found:', venueRecord.get('Name'));
            } catch (venueError) {
                console.error('test-event-details: Venue error:', venueError);
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
                venueId: venueId,
                venueName: fields['Venue Name']
            })
        };
        
    } catch (error) {
        console.error('test-event-details: Error:', error);
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