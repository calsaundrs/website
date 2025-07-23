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
                'Status',
                'End Date',
                'Is Active',
                'Created Time'
            ]
        }).all();

        console.log(`get-recurring-events: Found ${allRecords.length} total events`);

        // Group events by series
        const seriesMap = new Map();
        const standaloneRecurring = [];

        allRecords.forEach(record => {
            const fields = record.fields;
            
            // If it has Series ID, it's part of a series
            if (fields['Series ID']) {
                const seriesId = fields['Series ID'];
                if (!seriesMap.has(seriesId)) {
                    seriesMap.set(seriesId, []);
                }
                seriesMap.get(seriesId).push(record);
            } 
            // If it has Recurring Info but no Series ID, it's a standalone recurring event
            else if (fields['Recurring Info']) {
                standaloneRecurring.push(record);
            }
        });

        console.log(`get-recurring-events: Found ${seriesMap.size} recurring series and ${standaloneRecurring.length} standalone recurring events`);

        // Process each series
        const recurringSeries = [];
        
        seriesMap.forEach((instances, seriesId) => {
            // Sort instances by date
            instances.sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));
            
            // Get the parent event (first instance or one with Recurring Info)
            const parentEvent = instances.find(instance => instance.fields['Recurring Info']) || instances[0];
            
            // Get future instances
            const now = new Date();
            const futureInstances = instances.filter(instance => {
                const eventDate = new Date(instance.fields.Date);
                return eventDate > now;
            });
            
            // Get past instances
            const pastInstances = instances.filter(instance => {
                const eventDate = new Date(instance.fields.Date);
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
                name: parentEvent.fields['Event Name'],
                description: parentEvent.fields['Description'],
                recurringInfo: parentEvent.fields['Recurring Info'],
                venue: parentEvent.fields['VenueText'] || (parentEvent.fields['Venue Name'] ? parentEvent.fields['Venue Name'][0] : 'TBC'),
                category: parentEvent.fields['Category'] || [],
                status: parentEvent.fields['Status'],
                isActive: isActive,
                totalInstances: instances.length,
                futureInstances: futureInstances.length,
                pastInstances: pastInstances.length,
                nextInstance: nextInstance ? {
                    id: nextInstance.id,
                    date: nextInstance.fields['Date'],
                    status: nextInstance.fields['Status']
                } : null,
                lastInstance: lastInstance ? {
                    id: lastInstance.id,
                    date: lastInstance.fields['Date'],
                    status: lastInstance.fields['Status']
                } : null,
                instances: instances.map(instance => ({
                    id: instance.id,
                    date: instance.fields['Date'],
                    status: instance.fields['Status'],
                    isPast: new Date(instance.fields['Date']) <= now
                }))
            };
            
            recurringSeries.push(seriesData);
        });

        // Process standalone recurring events
        const standaloneRecurringEvents = standaloneRecurring.map(record => {
            const fields = record.fields;
            const eventDate = new Date(fields['Date']);
            const now = new Date();
            
            return {
                id: record.id,
                name: fields['Event Name'],
                description: fields['Description'],
                recurringInfo: fields['Recurring Info'],
                venue: fields['VenueText'] || (fields['Venue Name'] ? fields['Venue Name'][0] : 'TBC'),
                category: fields['Category'] || [],
                status: fields['Status'],
                date: fields['Date'],
                isActive: eventDate > now,
                isPast: eventDate <= now
            };
        });

        // Combine and sort
        const allRecurringEvents = [
            ...recurringSeries,
            ...standaloneRecurringEvents
        ];

        // Sort by next instance date (active series first, then by date)
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