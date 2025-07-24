const EventService = require('./services/event-service');

const eventService = new EventService();

console.log('AIRTABLE_PERSONAL_ACCESS_TOKEN:', process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN ? 'Loaded' : 'Not Loaded');
console.log('AIRTABLE_BASE_ID:', process.env.AIRTABLE_BASE_ID ? 'Loaded' : 'Not Loaded');

exports.handler = async (event, context) => {
    try {
        const { view } = event.queryStringParameters;
        
        if (view === 'admin') {
            // Admin view - return raw data
            const events = await eventService.getEvents({}, { admin: true });
            return { 
                statusCode: 200, 
                body: JSON.stringify({ events: events }) 
            };
        }

        // Public view - get query parameters
        const queryParams = event.queryStringParameters || {};
        const filters = {
            dateRange: queryParams.dateRange ? JSON.parse(queryParams.dateRange) : { type: 'all' },
            categories: queryParams.categories ? queryParams.categories.split(',') : [],
            venues: queryParams.venues ? queryParams.venues.split(',') : [],
            search: queryParams.search || '',
            sfwMode: queryParams.sfwMode !== 'false',
            limit: parseInt(queryParams.limit) || 50,
            offset: parseInt(queryParams.offset) || 0,
            sortBy: queryParams.sortBy || 'date',
            sortOrder: queryParams.sortOrder || 'asc'
        };

        // Get events using the service
        const events = await eventService.getEvents(filters);
        
        // Get unique venues for filtering
        const venues = await eventService.getVenues();

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                events: events, 
                venues: venues,
                total: events.length
            }),
            headers: { 
                'Content-Type': 'application/json', 
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
        };

    } catch (error) {
        console.error("Error in get-events function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch events and venues', details: error.message }),
        };
    }
};
