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
        console.error('get-recurring-events: AIRTABLE_PERSONAL_ACCESS_TOKEN:', !!AIRTABLE_PERSONAL_ACCESS_TOKEN);
        console.error('get-recurring-events: AIRTABLE_BASE_ID:', !!AIRTABLE_BASE_ID);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Missing Airtable configuration',
                details: 'Environment variables not properly configured'
            }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        // Get all events that have recurring information
        console.log('get-recurring-events: Fetching recurring events from Airtable...');
        
        // First, let's get ALL events to see what fields are available
        console.log('get-recurring-events: Getting all events to check available fields...');
        const testQuery = await base('Events').select({
            maxRecords: 1,
            fields: ['Event Name']
        }).all();
        
        if (testQuery.length > 0) {
            console.log('get-recurring-events: Sample record fields:', Object.keys(testQuery[0].fields));
        }
        
        // Define the fields we want to try to access
        const desiredFields = [
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
            'Promo Image'
        ];
        
        // Filter to only include fields that exist
        const availableFields = desiredFields.filter(field => {
            if (testQuery.length > 0) {
                return testQuery[0].fields.hasOwnProperty(field);
            }
            return true; // If we can't check, assume all fields exist
        });
        
        console.log('get-recurring-events: Available fields:', availableFields);
        
        // Simple query to get all events with basic fields
        const allRecords = await base('Events').select({
            fields: availableFields
        }).all();

        console.log(`get-recurring-events: Found ${allRecords.length} total events`);

        // Helper function to safely get field values
        const getField = (fields, fieldName, defaultValue = null) => {
            return fields.hasOwnProperty(fieldName) ? fields[fieldName] : defaultValue;
        };

        // Check if we have any recurring events
        const recurringEvents = allRecords.filter(record => {
            const fields = record.fields;
            const hasRecurringInfo = getField(fields, 'Recurring Info');
            const hasSeriesId = getField(fields, 'Series ID');
            const hasRecurring = getField(fields, 'Recurring');
            const hasSeries = getField(fields, 'Series');
            const hasRepeat = getField(fields, 'Repeat');
            const hasRecurrence = getField(fields, 'Recurrence');
            const hasRecurringPattern = getField(fields, 'Recurring Pattern');
            const hasFrequency = getField(fields, 'Frequency');
            const hasRepeatEvery = getField(fields, 'Repeat Every');
            const hasWeekly = getField(fields, 'Weekly');
            const hasMonthly = getField(fields, 'Monthly');
            const hasYearly = getField(fields, 'Yearly');
            
            const isRecurring = hasRecurringInfo || hasSeriesId || hasRecurring || hasSeries || hasRepeat || 
                               hasRecurrence || hasRecurringPattern || hasFrequency || hasRepeatEvery ||
                               hasWeekly || hasMonthly || hasYearly;
            
            if (isRecurring) {
                console.log('get-recurring-events: Found recurring event:', {
                    id: record.id,
                    name: getField(fields, 'Event Name'),
                    recurringInfo: hasRecurringInfo,
                    seriesId: hasSeriesId,
                    recurring: hasRecurring,
                    series: hasSeries,
                    repeat: hasRepeat,
                    recurrence: hasRecurrence,
                    recurringPattern: hasRecurringPattern,
                    frequency: hasFrequency,
                    repeatEvery: hasRepeatEvery,
                    weekly: hasWeekly,
                    monthly: hasMonthly,
                    yearly: hasYearly
                });
            }
            
            return isRecurring;
        });
        
        console.log(`get-recurring-events: Found ${recurringEvents.length} events with recurring info`);
        
        // Log sample of all records to see what fields are available
        if (allRecords.length > 0) {
            console.log('get-recurring-events: Sample record fields:', Object.keys(allRecords[0].fields));
            console.log('get-recurring-events: Sample record data:', {
                id: allRecords[0].id,
                name: getField(allRecords[0].fields, 'Event Name'),
                date: getField(allRecords[0].fields, 'Date'),
                status: getField(allRecords[0].fields, 'Status'),
                allFields: allRecords[0].fields
            });
        }

        // Group events by series
        const seriesMap = new Map();
        const standaloneRecurring = [];

        try {
            allRecords.forEach(record => {
                const fields = record.fields;
                
                // If it has Series ID, it's part of a series
                if (getField(fields, 'Series ID')) {
                    const seriesId = getField(fields, 'Series ID');
                    if (!seriesMap.has(seriesId)) {
                        seriesMap.set(seriesId, []);
                    }
                    seriesMap.get(seriesId).push(record);
                } 
                // If it has Recurring Info but no Series ID, it's a standalone recurring event
                else if (getField(fields, 'Recurring Info')) {
                    standaloneRecurring.push(record);
                }
            });

            console.log(`get-recurring-events: Found ${seriesMap.size} recurring series and ${standaloneRecurring.length} standalone recurring events`);
        } catch (error) {
            console.error('get-recurring-events: Error during grouping:', error);
            throw error;
        }

        // Process each series
        const recurringSeries = [];
        
        seriesMap.forEach((instances, seriesId) => {
            // Sort instances by date
            instances.sort((a, b) => new Date(getField(a.fields, 'Date')) - new Date(getField(b.fields, 'Date')));
            
            // Get the parent event (first instance or one with Recurring Info)
            const parentEvent = instances.find(instance => getField(instance.fields, 'Recurring Info')) || instances[0];
            
            // Get future instances
            const now = new Date();
            const futureInstances = instances.filter(instance => {
                const eventDate = new Date(getField(instance.fields, 'Date'));
                return eventDate > now;
            });
            
            // Get past instances
            const pastInstances = instances.filter(instance => {
                const eventDate = new Date(getField(instance.fields, 'Date'));
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
                name: getField(parentEvent.fields, 'Event Name'),
                description: getField(parentEvent.fields, 'Description'),
                recurringInfo: getField(parentEvent.fields, 'Recurring Info'),
                venue: getField(parentEvent.fields, 'VenueText') || (getField(parentEvent.fields, 'Venue Name') ? getField(parentEvent.fields, 'Venue Name')[0] : 'TBC'),
                category: getField(parentEvent.fields, 'Category') || [],
                status: getField(parentEvent.fields, 'Status'),
                image: getField(parentEvent.fields, 'Promo Image'),
                isActive: isActive,
                totalInstances: instances.length,
                futureInstances: futureInstances.length,
                pastInstances: pastInstances.length,
                nextInstance: nextInstance ? {
                    id: nextInstance.id,
                    date: getField(nextInstance.fields, 'Date'),
                    status: getField(nextInstance.fields, 'Status')
                } : null,
                lastInstance: lastInstance ? {
                    id: lastInstance.id,
                    date: getField(lastInstance.fields, 'Date'),
                    status: getField(lastInstance.fields, 'Status')
                } : null,
                instances: instances.map(instance => ({
                    id: instance.id,
                    date: getField(instance.fields, 'Date'),
                    status: getField(instance.fields, 'Status'),
                    isPast: new Date(getField(instance.fields, 'Date')) <= now
                }))
            };
            
            recurringSeries.push(seriesData);
        });

        // Process standalone recurring events
        const standaloneRecurringEvents = standaloneRecurring.map(record => {
            const fields = record.fields;
            const eventDate = new Date(getField(fields, 'Date'));
            const now = new Date();
            
            return {
                id: record.id,
                name: getField(fields, 'Event Name'),
                description: getField(fields, 'Description'),
                recurringInfo: getField(fields, 'Recurring Info'),
                venue: getField(fields, 'VenueText') || (getField(fields, 'Venue Name') ? getField(fields, 'Venue Name')[0] : 'TBC'),
                category: getField(fields, 'Category') || [],
                status: getField(fields, 'Status'),
                date: getField(fields, 'Date'),
                image: getField(fields, 'Promo Image'),
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