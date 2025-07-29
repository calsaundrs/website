const EventService = require('./services/event-service');

exports.handler = async function (event, context) {
    console.log('Getting events from Airtable with image data');
    
    try {
        const eventService = new EventService();
        
        // Get query parameters
        const queryParams = new URLSearchParams(event.queryStringParameters || '');
        const limit = parseInt(queryParams.get('limit')) || 50;
        const view = queryParams.get('view');
        const venues = queryParams.getAll('venues'); // Get venue filters
        
        console.log(`Getting events from Airtable. Limit: ${limit}, View: ${view}, Venues: ${venues.join(', ')}`);
        
        // If view=venues, return venues instead of events
        if (view === 'venues') {
            console.log('Returning venues list from Airtable');
            const venues = await eventService.getApprovedVenues();
            
            // Only include venues with Cloudinary images
            const venuesWithImages = venues.filter(venue => venue.image && venue.image.url);
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
                },
                body: JSON.stringify({
                    success: true,
                    venues: venuesWithImages
                })
            };
        }
        
        // Build filters for events
        const filters = {
            status: 'approved',
            limit: limit
        };
        
        // Add venue filters if specified
        if (venues && venues.length > 0) {
            filters.venues = venues;
        }
        
        // Get events from Airtable
        const events = await eventService.getEvents(filters);
        
        // Process events for the listing page
        const processedEvents = events.map(event => ({
            id: event.id,
            name: event.name,
            slug: event.slug,
            description: event.description,
            date: event.date,
            venueName: event.venue ? event.venue.name : '',
            venueSlug: event.venue ? event.venue.slug : '',
            category: event.category || [],
            price: event.details ? event.details.price : '',
            link: event.details ? event.details.link : '',
            image: event.image, // This will include the Cloudinary URL
            promotion: event.promotion || {},
            recurringInfo: event.recurringInfo,
            isRecurring: !!event.recurringInfo,
            series: event.series
        }));
        
        console.log(`Retrieved ${processedEvents.length} events from Airtable`);
        
        // Log first event to see image data
        if (processedEvents.length > 0) {
            console.log('First event image data:', processedEvents[0].image);
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                events: processedEvents,
                total: processedEvents.length,
                limit: limit,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Error getting events from Airtable:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to fetch events',
                message: error.message
            })
        };
    }
}; 