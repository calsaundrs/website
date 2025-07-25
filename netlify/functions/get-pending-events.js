const EventService = require('./services/event-service');

const eventService = new EventService();

exports.handler = async function (event, context) {
    try {
        console.log('Getting pending events...');
        
        // Use EventService to get pending events
        const pendingEvents = await eventService.getEvents({}, { 
            admin: true, 
            status: 'Pending Review' 
        });

        // Transform to match expected format
        const transformedEvents = pendingEvents.map(event => ({
            id: event.id,
            type: 'Event',
            fields: {
                'Event Name': event.name,
                'Description': event.description,
                'VenueText': event.venue?.name || 'TBC',
                'Contact Email': event.submitterEmail || 'No email provided',
                'Date': event.date,
                'Link': event.details?.link || '',
                'Recurring Info': event.recurringInfo || '',
                'Category': event.category || [],
                'Promo Image': event.image ? [event.image] : [],
                'Parent Event Name': event.series?.parentName || '',
                'Status': event.status || 'Pending Review'
            }
        }));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify(transformedEvents),
        };

    } catch (error) {
        console.error("Critical error in get-pending-events handler:", error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Failed to fetch pending events', details: error.toString() }),
        };
    }
};
