const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function (event, context) {
    try {
        // Test 1: Find a recurring parent event
        console.log("Test 1: Finding recurring parent events...");
        const parentEvents = await base('Events').select({
            maxRecords: 5,
            filterByFormula: "{Recurring Info} != ''",
            fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date']
        }).firstPage();
        
        console.log(`Found ${parentEvents.length} parent events:`);
        parentEvents.forEach((record, index) => {
            console.log(`${index + 1}. ${record.fields['Event Name']} - Slug: ${record.fields['Slug']} - Series ID: ${record.fields['Series ID']}`);
        });
        
        // Test 2: Find child events
        if (parentEvents.length > 0) {
            const firstParent = parentEvents[0];
            const seriesId = firstParent.fields['Series ID'];
            
            console.log(`\nTest 2: Finding child events for Series ID: ${seriesId}`);
            const childEvents = await base('Events').select({
                maxRecords: 10,
                filterByFormula: `AND({Series ID} = "${seriesId}", {Recurring Info} = '')`,
                fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date']
            }).firstPage();
            
            console.log(`Found ${childEvents.length} child events:`);
            childEvents.forEach((record, index) => {
                console.log(`${index + 1}. ${record.fields['Event Name']} - Slug: ${record.fields['Slug']} - Date: ${record.fields['Date']}`);
            });
            
            // Test 3: Test the lookup logic from get-event-details.js
            if (childEvents.length > 0) {
                const childSlug = childEvents[0].fields['Slug'];
                console.log(`\nTest 3: Testing lookup for child slug: ${childSlug}`);
                
                // Simulate the lookup logic
                const childEventRecords = await base('Events').select({ 
                    maxRecords: 1, 
                    filterByFormula: `{Slug} = "${childSlug}"`,
                    fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date']
                }).firstPage();
                
                if (childEventRecords && childEventRecords.length > 0) {
                    const childEvent = childEventRecords[0];
                    const childSeriesId = childEvent.fields['Series ID'];
                    
                    if (childSeriesId) {
                        console.log(`Found child event with Series ID: ${childSeriesId}`);
                        // Find the parent event
                        const parentRecords = await base('Events').select({ 
                            maxRecords: 1, 
                            filterByFormula: `AND({Series ID} = "${childSeriesId}", {Recurring Info} != '')`,
                            fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date']
                        }).firstPage();
                        
                        if (parentRecords && parentRecords.length > 0) {
                            console.log(`SUCCESS: Found parent event: ${parentRecords[0].fields['Event Name']}`);
                        } else {
                            console.log(`ERROR: No parent event found for Series ID: ${childSeriesId}`);
                        }
                    } else {
                        console.log("ERROR: Child event has no Series ID");
                    }
                } else {
                    console.log("ERROR: Child event not found");
                }
            }
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Recurring event lookup test completed',
                parentEventsCount: parentEvents.length,
                childEventsCount: childEvents ? childEvents.length : 0
            })
        };
        
    } catch (error) {
        console.error('Error in test-recurring-lookup:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Test failed',
                message: error.message
            })
        };
    }
};