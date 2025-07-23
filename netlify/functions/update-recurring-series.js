const Airtable = require('airtable');
const FormData = require('form-data');

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
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        
        // Parse multipart form data
        const formData = new FormData();
        const boundary = event.headers['content-type'].split('boundary=')[1];
        const parts = event.body.split('--' + boundary);
        
        let seriesId, name, description, venueId, newVenue, imageFile, recurringInfo, instancesAhead, endDate, categories;
        
        for (const part of parts) {
            if (part.includes('Content-Disposition: form-data')) {
                const lines = part.split('\r\n');
                let fieldName = null;
                let fieldValue = null;
                
                for (const line of lines) {
                    if (line.startsWith('Content-Disposition: form-data; name=')) {
                        const match = line.match(/name="([^"]+)"/);
                        if (match) fieldName = match[1];
                    } else if (line.startsWith('Content-Disposition: form-data; filename=')) {
                        const match = line.match(/filename="([^"]+)"/);
                        if (match) {
                            fieldName = 'image';
                            // Extract file content
                            const fileContent = part.split('\r\n\r\n')[1];
                            fieldValue = fileContent;
                        }
                    } else if (line.trim() && !line.startsWith('Content-')) {
                        fieldValue = line.trim();
                    }
                }
                
                if (fieldName && fieldValue !== null) {
                    switch (fieldName) {
                        case 'seriesId':
                            seriesId = fieldValue;
                            break;
                        case 'name':
                            name = fieldValue;
                            break;
                        case 'description':
                            description = fieldValue;
                            break;
                        case 'venueId':
                            venueId = fieldValue;
                            break;
                        case 'newVenue':
                            newVenue = JSON.parse(fieldValue);
                            break;
                        case 'image':
                            imageFile = fieldValue;
                            break;
                        case 'recurringInfo':
                            recurringInfo = JSON.parse(fieldValue);
                            break;
                        case 'instancesAhead':
                            instancesAhead = parseInt(fieldValue);
                            break;
                        case 'endDate':
                            endDate = fieldValue;
                            break;
                        case 'categories':
                            categories = JSON.parse(fieldValue);
                            break;
                    }
                }
            }
        }
        
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
        if (instancesAhead) updateFields['Instances Ahead'] = instancesAhead;
        if (endDate) updateFields['End Date'] = endDate;
        if (categories) updateFields['Category'] = categories;
        if (recurringInfo) updateFields['Recurring Info'] = JSON.stringify(recurringInfo);

        // Handle venue
        if (newVenue) {
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

        // Handle image upload (if provided)
        if (imageFile) {
            // For now, we'll store the image data as a base64 string
            // In a real implementation, you'd upload to a service like Cloudinary
            updateFields['Promo Image'] = [{
                url: `data:image/jpeg;base64,${Buffer.from(imageFile).toString('base64')}`
            }];
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
            const newInstances = generateInstances(recurringInfo, instancesAhead || 12, endDate);
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