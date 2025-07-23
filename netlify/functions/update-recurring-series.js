const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('update-recurring-series: Starting function execution');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('update-recurring-series: Missing required environment variables');
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
        console.log('update-recurring-series: Request body:', requestBody);
        console.log('update-recurring-series: Request body keys:', Object.keys(requestBody));

        const { 
            seriesId, 
            name,
            description,
            venueId,
            newVenue,
            recurringInfo,
            instancesAhead,
            endDate,
            categories,
            type
        } = requestBody;

        if (!seriesId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Missing seriesId',
                    details: 'Series ID is required for updating recurring series'
                }),
            };
        }

        console.log(`update-recurring-series: Processing series ${seriesId}`);

        // Get the series record (parent record with recurring info)
        const seriesRecords = await base('Events').select({
            filterByFormula: `{Series ID} = '${seriesId}'`
        }).all();

        console.log(`update-recurring-series: Found ${seriesRecords.length} events in series ${seriesId}`);

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

        console.log(`update-recurring-series: Using parent record: ${parentRecord.id}`);
        
        // If no Series ID exists, create one
        if (!parentRecord.fields['Series ID']) {
            console.log('update-recurring-series: No Series ID found, creating new one');
            const newSeriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Update the parent record with the new Series ID
            await base('Events').update(parentRecord.id, {
                'Series ID': newSeriesId
            });
            
            // Update the seriesId variable
            seriesId = newSeriesId;
            
            // Refresh the parent record
            parentRecord = await base('Events').find(parentRecord.id);
            console.log(`update-recurring-series: Created new Series ID: ${newSeriesId}`);
        }

        // Prepare update fields
        const updateFields = {};

        // Update basic information
        if (name) updateFields['Event Name'] = name;
        if (description) updateFields['Description'] = description;
        // Note: instancesAhead and endDate are stored in the recurringInfo JSON, not as separate fields
        if (categories && Array.isArray(categories)) updateFields['Category'] = categories;

        // Handle recurring info
        if (recurringInfo) {
            // Convert recurring info to string format and add instancesAhead/endDate
            let recurringInfoObj = recurringInfo;
            if (typeof recurringInfo === 'string') {
                try {
                    recurringInfoObj = JSON.parse(recurringInfo);
                } catch (e) {
                    recurringInfoObj = { description: recurringInfo };
                }
            }
            
            // Add instancesAhead and endDate to the recurring info
            if (instancesAhead) {
                recurringInfoObj.instancesAhead = parseInt(instancesAhead);
            }
            if (endDate) {
                recurringInfoObj.endDate = endDate;
            }
            
            updateFields['Recurring Info'] = JSON.stringify(recurringInfoObj);
        }

        // Handle venue
        if (newVenue && newVenue.name && newVenue.address) {
            // Create new venue
            const venueFields = {
                'Name': newVenue.name,
                'Address': newVenue.address
            };
            
            // Add optional fields if provided
            if (newVenue.postcode) venueFields['Postcode'] = newVenue.postcode;
            if (newVenue.website) venueFields['Website'] = newVenue.website;
            
            const venueRecord = await base('Venues').create([{
                fields: venueFields
            }]);
            updateFields['Venue'] = [venueRecord[0].id];
        } else if (venueId) {
            updateFields['Venue'] = [venueId];
        }

        // Update the parent record
        try {
            await base('Events').update(parentRecord.id, updateFields);
            console.log(`update-recurring-series: Updated parent record with fields:`, Object.keys(updateFields));
            
            // Verify the Series ID is still there after update
            const updatedRecord = await base('Events').find(parentRecord.id);
            console.log(`update-recurring-series: Parent record Series ID after update:`, updatedRecord.fields['Series ID']);
            
        } catch (updateError) {
            console.error('update-recurring-series: Error updating parent record:', updateError);
            throw new Error(`Failed to update parent record: ${updateError.message}`);
        }

        // If recurrence rules changed, regenerate instances
        if (recurringInfo && instancesAhead) {
            try {
                        // Check if this is now a "none" recurrence type
        if (recurringInfo.type === 'none') {
            console.log('update-recurring-series: Converting series to standalone event (no recurrence)');
            
            // Remove Series ID from parent record to make it standalone
            await base('Events').update(parentRecord.id, {
                'Series ID': null
            });
            
            // Delete all other instances in the series
            const allSeriesInstances = await base('Events').select({
                filterByFormula: `{Series ID} = '${seriesId}'`
            }).all();
            
            if (allSeriesInstances.length > 1) {
                const deleteIds = allSeriesInstances.map(record => record.id);
                await base('Events').destroy(deleteIds);
                console.log(`update-recurring-series: Deleted ${deleteIds.length} series instances (converting to standalone)`);
            }
        } else {
            console.log(`update-recurring-series: Regenerating instances for series ${seriesId} with type: ${recurringInfo.type}`);
                                // Delete existing future instances
            const today = new Date().toISOString().split('T')[0];
            console.log(`update-recurring-series: Looking for existing instances with Series ID: ${seriesId}`);
            const existingInstances = await base('Events').select({
                filterByFormula: `AND({Series ID} = '${seriesId}', {Date} >= '${today}')`
            }).all();

            console.log(`update-recurring-series: Found ${existingInstances.length} existing future instances`);
            if (existingInstances.length > 0) {
                const deleteIds = existingInstances.map(record => record.id);
                await base('Events').destroy(deleteIds);
                console.log(`update-recurring-series: Deleted ${deleteIds.length} existing future instances`);
            }

                    // Generate new instances
                    const newInstances = generateInstances(recurringInfo, parseInt(instancesAhead) || 12, endDate);
                    console.log(`update-recurring-series: Generated ${newInstances.length} new instances`);
                    
                    const instanceRecords = newInstances.map(date => ({
                        fields: {
                            'Event Name': name || parentRecord.fields['Event Name'],
                            'Description': description || parentRecord.fields['Description'],
                            'Date': date,
                            'Time': parentRecord.fields['Time'],
                            'Venue': updateFields['Venue'] || parentRecord.fields['Venue'],
                            'Category': categories || parentRecord.fields['Category'],
                            'Series ID': seriesId,
                            'Status': 'Pending Review'
                        }
                    }));

                    if (instanceRecords.length > 0) {
                        await base('Events').create(instanceRecords);
                        console.log(`update-recurring-series: Created ${instanceRecords.length} new instances`);
                    }
                }
            } catch (instanceError) {
                console.error('update-recurring-series: Error regenerating instances:', instanceError);
                // Don't throw here - the parent record was already updated successfully
                console.log('update-recurring-series: Continuing without regenerating instances');
            }
        }

        const updatedCount = 1; // We updated the parent record

        console.log(`update-recurring-series: Successfully processed ${updatedCount} records for series ${seriesId}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: JSON.stringify({
                success: true,
                message: `Successfully updated series ${seriesId}`,
                updatedCount: updatedCount,
                seriesId: seriesId,
                timestamp: new Date().toISOString()
            }),
        };

    } catch (error) {
        console.error("update-recurring-series: Critical error:", error);
        console.error("update-recurring-series: Error stack:", error.stack);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to update recurring series', 
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