const Airtable = require('airtable');

exports.handler = async function(event, context) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { seriesId } = JSON.parse(event.body);
        
        if (!seriesId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Series ID is required' })
            };
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get the series template record
        const seriesRecords = await base('Events').select({
            filterByFormula: `{Series ID} = '${seriesId}'`,
            maxRecords: 1
        }).all();

        if (seriesRecords.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Series not found' })
            };
        }

        const seriesRecord = seriesRecords[0];
        const recurringInfo = seriesRecord.get('Recurring Info');
        let recurrenceRules = {};
        
        try {
            recurrenceRules = JSON.parse(recurringInfo);
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid recurrence rules' })
            };
        }

        // Delete existing future instances
        const today = new Date().toISOString().split('T')[0];
        const existingInstances = await base('Events').select({
            filterByFormula: `AND({Series ID} = '${seriesId}', {Date} >= '${today}')`
        }).all();

        if (existingInstances.length > 0) {
            const deleteIds = existingInstances.map(record => record.id);
            // Delete in batches of 10
            const batchSize = 10;
            for (let i = 0; i < deleteIds.length; i += batchSize) {
                const batch = deleteIds.slice(i, i + batchSize);
                await base('Events').destroy(batch);
            }
        }

        // Generate new instances based on recurrence rules
        const instancesAhead = seriesRecord.get('Instances Ahead') || 12;
        const endDate = seriesRecord.get('End Date');
        const newInstances = generateInstances(recurrenceRules, instancesAhead, endDate);

        // Create new instances
        const instanceRecords = newInstances.map(date => ({
            fields: {
                'Event Name': seriesRecord.get('Event Name'),
                'Description': seriesRecord.get('Description'),
                'Date': date,
                'Time': seriesRecord.get('Time'),
                'Venue': seriesRecord.get('Venue'),
                'Category': seriesRecord.get('Category'),
                'Series ID': seriesId,
                'Status': 'Pending Review',
                'Is Instance': true
            }
        }));

        if (instanceRecords.length > 0) {
            // Create in batches of 10
            const batchSize = 10;
            for (let i = 0; i < instanceRecords.length; i += batchSize) {
                const batch = instanceRecords.slice(i, i + batchSize);
                await base('Events').create(batch);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: `Successfully regenerated ${instanceRecords.length} instances` 
            })
        };

    } catch (error) {
        console.error('Error regenerating instances:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to regenerate instances',
                details: error.message 
            })
        };
    }
};

function generateInstances(recurrenceRules, instancesAhead, endDate) {
    const instances = [];
    const today = new Date();
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
    
    return instances;
}