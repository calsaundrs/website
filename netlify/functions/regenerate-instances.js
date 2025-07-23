const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('regenerate-instances: Starting function execution');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('regenerate-instances: Missing required environment variables');
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
        // Parse the request body
        const requestBody = JSON.parse(event.body);
        console.log('regenerate-instances: Request body:', requestBody);

        const { seriesId } = requestBody;

        if (!seriesId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Missing seriesId',
                    details: 'Series ID is required for regenerating instances'
                }),
            };
        }

        console.log(`regenerate-instances: Processing series ${seriesId}`);

        // First, try to find records by Series ID
        console.log(`regenerate-instances: Looking for series with ID: ${seriesId}`);
        let seriesRecords = await base('Events').select({
            filterByFormula: `{Series ID} = '${seriesId}'`
        }).all();

        console.log(`regenerate-instances: Found ${seriesRecords.length} events in series ${seriesId}`);
        
        // If no records found by Series ID, try to find by event ID
        if (seriesRecords.length === 0) {
            console.log('regenerate-instances: No records found by Series ID, trying to find by event ID...');
            try {
                const eventRecord = await base('Events').find(seriesId);
                console.log(`regenerate-instances: Found event by ID: ${eventRecord.fields['Event Name']}`);
                
                if (eventRecord.fields['Series ID']) {
                    console.log(`regenerate-instances: Event has Series ID: ${eventRecord.fields['Series ID']}`);
                    seriesRecords = await base('Events').select({
                        filterByFormula: `{Series ID} = '${eventRecord.fields['Series ID']}'`
                    }).all();
                    seriesId = eventRecord.fields['Series ID'];
                    console.log(`regenerate-instances: Found ${seriesRecords.length} events in series ${seriesId}`);
                } else {
                    console.log('regenerate-instances: Event has no Series ID, treating as standalone');
                    seriesRecords = [eventRecord];
                }
            } catch (findError) {
                console.log('regenerate-instances: Could not find event by ID either');
            }
        }

        if (seriesRecords.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ 
                    error: 'Series not found',
                    details: `No events found with series ID: ${seriesId}`
                }),
            };
        }

        // Find the parent record (one with recurring info)
        let parentRecord = seriesRecords.find(record => 
            record.fields['Recurring Info'] || record.fields['recurringInfo']
        ) || seriesRecords[0];

        console.log(`regenerate-instances: Using parent record: ${parentRecord.id}`);

        // Parse recurring info
        const recurringInfo = parentRecord.fields['Recurring Info'] || parentRecord.fields['recurringInfo'];
        if (!recurringInfo) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'No recurring info found',
                    details: 'Parent record has no recurring information'
                }),
            };
        }

        let recurringInfoObj;
        try {
            if (typeof recurringInfo === 'string') {
                // Try to parse as JSON first
                if (recurringInfo.startsWith('{') || recurringInfo.startsWith('[')) {
                    recurringInfoObj = JSON.parse(recurringInfo);
                } else {
                    // Handle plain text descriptions
                    console.log('regenerate-instances: Converting text description to JSON format:', recurringInfo);
                    recurringInfoObj = convertTextToRecurringInfo(recurringInfo);
                }
            } else {
                recurringInfoObj = recurringInfo;
            }
        } catch (e) {
            console.error('regenerate-instances: Error parsing recurring info:', e);
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Invalid recurring info',
                    details: 'Could not parse recurring information'
                }),
            };
        }

        // Delete existing future instances
        const today = new Date().toISOString().split('T')[0];
        console.log(`regenerate-instances: Looking for existing instances with Series ID: ${seriesId}`);
        const existingInstances = await base('Events').select({
            filterByFormula: `AND({Series ID} = '${seriesId}', {Date} >= '${today}')`
        }).all();

        console.log(`regenerate-instances: Found ${existingInstances.length} existing future instances`);
        if (existingInstances.length > 0) {
            const deleteIds = existingInstances.map(record => record.id);
            await base('Events').destroy(deleteIds);
            console.log(`regenerate-instances: Deleted ${deleteIds.length} existing future instances`);
        }

        // Generate new instances
        const instancesAhead = recurringInfoObj.instancesAhead || 12;
        const endDate = recurringInfoObj.endDate;
        
        const newInstances = generateInstances(recurringInfoObj, instancesAhead, endDate);
        console.log(`regenerate-instances: Generated ${newInstances.length} new instances`);
        
        const instanceRecords = newInstances.map(date => ({
            fields: {
                'Event Name': parentRecord.fields['Event Name'],
                'Description': parentRecord.fields['Description'],
                'Date': date,
                'Time': parentRecord.fields['Time'],
                'Venue': parentRecord.fields['Venue'],
                'Category': parentRecord.fields['Category'],
                'Series ID': seriesId,
                'Status': 'Approved'
            }
        }));

        if (instanceRecords.length > 0) {
            // Create instances in batches of 10 (Airtable limit)
            const batchSize = 10;
            let totalCreated = 0;
            
            for (let i = 0; i < instanceRecords.length; i += batchSize) {
                const batch = instanceRecords.slice(i, i + batchSize);
                await base('Events').create(batch);
                totalCreated += batch.length;
                console.log(`regenerate-instances: Created batch ${Math.floor(i/batchSize) + 1} with ${batch.length} instances`);
            }
            
            console.log(`regenerate-instances: Created ${totalCreated} total new instances`);
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: JSON.stringify({
                success: true,
                message: `Successfully regenerated ${instanceRecords.length} instances for series ${seriesId}`,
                instancesCreated: instanceRecords.length,
                seriesId: seriesId,
                timestamp: new Date().toISOString()
            }),
        };

    } catch (error) {
        console.error("regenerate-instances: Critical error:", error);
        console.error("regenerate-instances: Error stack:", error.stack);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to regenerate instances', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};

function generateInstances(recurrenceRules, instancesAhead, endDate) {
    const instances = [];
    const today = new Date();
    
    // Handle "none" recurrence type - don't generate any instances
    if (!recurrenceRules || !recurrenceRules.type || recurrenceRules.type === 'none') {
        console.log('generateInstances: No recurrence type specified, not generating instances');
        return instances;
    }
    
    let currentDate = new Date(today);
    
    // Set end date if specified
    const maxDate = endDate ? new Date(endDate) : new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    
    while (instances.length < instancesAhead && currentDate <= maxDate) {
        let shouldAdd = false;
        
        if (recurrenceRules.type === 'weekly' && recurrenceRules.days) {
            const dayOfWeek = currentDate.getDay();
            shouldAdd = recurrenceRules.days.includes(dayOfWeek);
        } else if (recurrenceRules.type === 'monthly') {
            if (recurrenceRules.monthlyType === 'date') {
                shouldAdd = currentDate.getDate() === recurrenceRules.dayOfMonth;
            } else if (recurrenceRules.monthlyType === 'day') {
                const week = recurrenceRules.week;
                const targetDay = recurrenceRules.dayOfWeek;
                const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const dayOfWeek = firstDayOfMonth.getDay();
                const offset = (targetDay - dayOfWeek + 7) % 7;
                const targetDate = week === -1 ? 
                    new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0) :
                    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1 + offset + (week - 1) * 7);
                
                if (week === -1) {
                    // Last occurrence of the month
                    while (targetDate.getDay() !== targetDay) {
                        targetDate.setDate(targetDate.getDate() - 1);
                    }
                }
                
                shouldAdd = currentDate.getDate() === targetDate.getDate();
            }
        }
        
        if (shouldAdd && currentDate >= today) {
            instances.push(currentDate.toISOString().split('T')[0]);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`generateInstances: Generated ${instances.length} instances for type: ${recurrenceRules.type}`);
    return instances;
}

function convertTextToRecurringInfo(text) {
    if (!text || typeof text !== 'string') {
        return { type: 'weekly', days: [], maxInstances: 10, instancesAhead: 12 };
    }
    
    const lowerText = text.toLowerCase();
    
    // Default values
    let type = 'weekly';
    let days = [];
    let maxInstances = 10;
    let instancesAhead = 12;
    
    // Detect type
    if (lowerText.includes('monthly')) {
        type = 'monthly';
        // Try to extract monthly details
        if (lowerText.includes('first')) {
            return {
                type: 'monthly',
                monthlyType: 'day',
                week: 1,
                dayOfWeek: getDayOfWeekFromText(text),
                maxInstances: maxInstances,
                instancesAhead: instancesAhead
            };
        } else if (lowerText.includes('last')) {
            return {
                type: 'monthly',
                monthlyType: 'day',
                week: -1,
                dayOfWeek: getDayOfWeekFromText(text),
                maxInstances: maxInstances,
                instancesAhead: instancesAhead
            };
        } else {
            return {
                type: 'monthly',
                monthlyType: 'date',
                dayOfMonth: 1, // Default to 1st of month
                maxInstances: maxInstances,
                instancesAhead: instancesAhead
            };
        }
    } else if (lowerText.includes('weekly') || getDayOfWeekFromText(text) !== null) {
        // If it contains "weekly" or any day of the week, it's weekly
        type = 'weekly';
        const dayOfWeek = getDayOfWeekFromText(text);
        if (dayOfWeek !== null) {
            days = [dayOfWeek];
        }
    }
    
    return {
        type: type,
        days: days,
        maxInstances: maxInstances,
        instancesAhead: instancesAhead
    };
}

function getDayOfWeekFromText(text) {
    const lowerText = text.toLowerCase();
    const dayMap = {
        'monday': 1, 'mon': 1,
        'tuesday': 2, 'tue': 2,
        'wednesday': 3, 'wed': 3,
        'thursday': 4, 'thu': 4,
        'friday': 5, 'fri': 5,
        'saturday': 6, 'sat': 6,
        'sunday': 0, 'sun': 0
    };
    
    for (const [day, value] of Object.entries(dayMap)) {
        if (lowerText.includes(day)) {
            return value;
        }
    }
    
    return null;
}