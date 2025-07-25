const EventService = require('./services/event-service');

const eventService = new EventService();

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('get-recurring-events: Starting function execution');

    try {
        // Use EventService to get all events (admin mode)
        console.log('get-recurring-events: Fetching all events from EventService...');
        
        const allEvents = await eventService.getEvents({}, { admin: true });
        
        console.log(`get-recurring-events: Found ${allEvents.length} total events`);

        // Filter for recurring events
        const recurringEvents = allEvents.filter(event => 
            event.recurringInfo || event.series
        );
        
        console.log(`get-recurring-events: Found ${recurringEvents.length} recurring events`);

        // Group by series
        const seriesMap = new Map();
        const standaloneRecurring = [];

        recurringEvents.forEach(event => {
            if (event.series && event.series.id) {
                // Part of a series
                if (!seriesMap.has(event.series.id)) {
                    seriesMap.set(event.series.id, []);
                }
                seriesMap.get(event.series.id).push(event);
            } else if (event.recurringInfo) {
                // Standalone recurring event
                standaloneRecurring.push(event);
            }
        });

        console.log(`get-recurring-events: Found ${seriesMap.size} recurring series and ${standaloneRecurring.length} standalone recurring events`);

        // Process each series
        const recurringSeries = [];
        
        seriesMap.forEach((instances, seriesId) => {
            // Sort instances by date
            instances.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Get the parent event (first instance or one with Recurring Info)
            const parentEvent = instances.find(instance => instance.recurringInfo) || instances[0];
            
            // Get future instances
            const now = new Date();
            const futureInstances = instances.filter(instance => {
                const eventDate = new Date(instance.date);
                return eventDate > now;
            });
            
            // Get past instances
            const pastInstances = instances.filter(instance => {
                const eventDate = new Date(instance.date);
                return eventDate <= now;
            });
            
            // Determine if series is active
            const isActive = futureInstances.length > 0;
            
            // Get the next upcoming instance
            const nextInstance = futureInstances[0];
            
            // Get the last instance
            const lastInstance = instances[instances.length - 1];
            
            const seriesData = {
                seriesId: seriesId,
                name: parentEvent.name,
                description: parentEvent.description,
                recurringInfo: parentEvent.recurringInfo,
                venue: parentEvent.venue?.name || 'TBC',
                category: parentEvent.category || [],
                status: parentEvent.status,
                image: parentEvent.image?.url || null,
                isActive: isActive,
                totalInstances: instances.length,
                futureInstances: futureInstances.length,
                pastInstances: pastInstances.length,
                nextInstance: nextInstance ? {
                    id: nextInstance.id,
                    date: nextInstance.date,
                    status: nextInstance.status
                } : null,
                lastInstance: lastInstance ? {
                    id: lastInstance.id,
                    date: lastInstance.date,
                    status: lastInstance.status
                } : null,
                instances: instances.map(instance => ({
                    id: instance.id,
                    date: instance.date,
                    status: instance.status,
                    isPast: new Date(instance.date) <= now
                }))
            };
            
            recurringSeries.push(seriesData);
        });

        // Process standalone recurring events
        const standaloneRecurringEvents = standaloneRecurring.map(event => {
            const eventDate = new Date(event.date);
            const now = new Date();
            
            return {
                id: event.id,
                name: event.name,
                description: event.description,
                recurringInfo: event.recurringInfo,
                venue: event.venue?.name || 'TBC',
                category: event.category || [],
                status: event.status,
                date: event.date,
                image: event.image?.url || null,
                isActive: eventDate > now,
                isPast: eventDate <= now,
                totalInstances: 1,
                futureInstances: eventDate > now ? 1 : 0,
                pastInstances: eventDate <= now ? 1 : 0
            };
        });

        // Combine and sort
        const allRecurringEvents = [
            ...recurringSeries,
            ...standaloneRecurringEvents
        ];

        // Sort by next instance date (active events first, then by date)
        allRecurringEvents.sort((a, b) => {
            // Active events first
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            
            // Then by next instance date
            const dateA = a.nextInstance ? new Date(a.nextInstance.date) : new Date(a.date);
            const dateB = b.nextInstance ? new Date(b.nextInstance.date) : new Date(b.date);
            return dateA - dateB;
        });

        console.log(`get-recurring-events: Returning ${allRecurringEvents.length} recurring events`);

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recurringEvents: allRecurringEvents,
                totalSeries: seriesMap.size,
                totalStandalone: standaloneRecurring.length,
                activeEvents: allRecurringEvents.filter(event => event.isActive).length
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