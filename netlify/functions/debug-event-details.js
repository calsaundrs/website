const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function (event, context) {
    try {
        const slug = event.queryStringParameters?.slug || 'mash-up-mondays';
        console.log('debug-event-details: Looking for slug:', slug);
        
        // Get all events with this slug
        const escapedSlug = slug.replace(/"/g, '"');
        const eventRecords = await base('Events').select({
            maxRecords: 20,
            filterByFormula: `{Slug} = "${escapedSlug}"`,
            fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date', 'Venue Name', 'VenueText', 'Category']
        }).all();
        
        console.log(`debug-event-details: Found ${eventRecords.length} events with slug "${slug}"`);
        
        const events = eventRecords.map(record => ({
            id: record.id,
            name: record.fields['Event Name'],
            slug: record.fields['Slug'],
            recurringInfo: record.fields['Recurring Info'],
            seriesId: record.fields['Series ID'],
            date: record.fields['Date'],
            venueName: record.fields['Venue Name'],
            venueText: record.fields['VenueText'],
            category: record.fields['Category']
        }));
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                slug: slug,
                totalEvents: events.length,
                events: events
            }, null, 2)
        };
        
    } catch (error) {
        console.error('debug-event-details: Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to debug event details',
                details: error.message
            })
        };
    }
};