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
        console.log('Update Recurring Series: Starting function');
        console.log('Update Recurring Series: API Key exists:', !!process.env.AIRTABLE_API_KEY);
        console.log('Update Recurring Series: Base ID exists:', !!process.env.AIRTABLE_BASE_ID);
        
        if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        
        // Parse the request body - handle both JSON and form data
        let data;
        if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
            data = JSON.parse(event.body);
            console.log('Update Recurring Series: Parsed JSON data');
        } else {
            // For form data, we'll use a simpler approach
            const formData = new URLSearchParams(event.body);
            data = Object.fromEntries(formData);
            console.log('Update Recurring Series: Parsed form data');
            
            // Parse JSON fields
            if (data.recurringInfo) {
                try {
                    data.recurringInfo = JSON.parse(data.recurringInfo);
                } catch (e) {
                    data.recurringInfo = {};
                }
            }
            if (data.categories) {
                try {
                    data.categories = JSON.parse(data.categories);
                } catch (e) {
                    data.categories = [];
                }
            }
            if (data.newVenue) {
                try {
                    data.newVenue = JSON.parse(data.newVenue);
                } catch (e) {
                    data.newVenue = null;
                }
            }
        }
        
        const { seriesId, name, description, venueId, newVenue, recurringInfo, instancesAhead, endDate, categories } = data;
        
        console.log('Update Recurring Series: Series ID:', seriesId);
        console.log('Update Recurring Series: Data received:', { name, description, venueId, instancesAhead, endDate });
        
        if (!seriesId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Series ID is required' })
            };
        }

        // Get the series record
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
        const updateFields = {};

        // Update basic information
        if (name) updateFields['Event Name'] = name;
        if (description) updateFields['Description'] = description;
        if (instancesAhead) updateFields['Instances Ahead'] = parseInt(instancesAhead);
        if (endDate) updateFields['End Date'] = endDate;
        if (categories && Array.isArray(categories)) updateFields['Category'] = categories;
        if (recurringInfo) updateFields['Recurring Info'] = JSON.stringify(recurringInfo);

        // Handle venue
        if (newVenue && newVenue.name && newVenue.address) {
            // Create new venue
            const venueRecord = await base('Venues').create([{
                fields: {
                    'Name': newVenue.name,
                    'Address': newVenue.address
                }
            }]);
            updateFields['Venue'] = [venueRecord[0].id];
        } else if (venueId) {
            updateFields['Venue'] = [venueId];
        }

        // Update the series record
        await base('Events').update([{
            id: seriesRecord.id,
            fields: updateFields
        }]);

        // If recurrence rules changed, regenerate instances
        if (recurringInfo) {
            // Delete existing future instances
            const today = new Date().toISOString().split('T')[0];
            const existingInstances = await base('Events').select({
                filterByFormula: `AND({Series ID} = '${seriesId}', {Date} >= '${today}')`
            }).all();

            if (existingInstances.length > 0) {
                const deleteIds = existingInstances.map(record => record.id);
                await base('Events').destroy(deleteIds);
            }

            // Generate new instances
            const newInstances = generateInstances(recurringInfo, parseInt(instancesAhead) || 12, endDate);
            const instanceRecords = newInstances.map(date => ({
                fields: {
                    'Event Name': name || seriesRecord.get('Event Name'),
                    'Description': description || seriesRecord.get('Description'),
                    'Date': date,
                    'Time': seriesRecord.get('Time'),
                    'Venue': updateFields['Venue'] || seriesRecord.get('Venue'),
                    'Category': categories || seriesRecord.get('Category'),
                    'Series ID': seriesId,
                    'Status': 'Pending Review',
                    'Is Instance': true
                }
            }));

            if (instanceRecords.length > 0) {
                await base('Events').create(instanceRecords);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'Recurring series updated successfully' 
            })
        };

    } catch (error) {
        console.error('Error updating recurring series:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to update recurring series',
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