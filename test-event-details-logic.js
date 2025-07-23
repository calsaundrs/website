// Test script to verify event details lookup logic
// This simulates the logic from get-event-details.js

// Mock data structure similar to what Airtable would return
const mockEvents = [
    {
        id: 'rec_parent_123',
        fields: {
            'Event Name': 'Weekly Drag Show',
            'Slug': 'weekly-drag-show',
            'Recurring Info': 'Every Friday at 8pm',
            'Series ID': 'rec_parent_123',
            'Date': '2024-01-05T20:00:00.000Z'
        }
    },
    {
        id: 'rec_child_1',
        fields: {
            'Event Name': 'Weekly Drag Show',
            'Slug': 'weekly-drag-show', // Now using parent's slug
            'Recurring Info': '',
            'Series ID': 'rec_parent_123',
            'Date': '2024-01-12T20:00:00.000Z'
        }
    },
    {
        id: 'rec_child_2',
        fields: {
            'Event Name': 'Weekly Drag Show',
            'Slug': 'weekly-drag-show', // Now using parent's slug
            'Recurring Info': '',
            'Series ID': 'rec_parent_123',
            'Date': '2024-01-19T20:00:00.000Z'
        }
    }
];

// Simulate the event details lookup logic
function findEventBySlug(slug, events) {
    console.log(`Looking for event with slug: ${slug}`);
    
    // First, try to find any event with this slug (parent or child)
    const matchingEvents = events.filter(event => event.fields['Slug'] === slug);
    
    if (matchingEvents.length > 0) {
        console.log(`Found ${matchingEvents.length} events with slug: ${slug}`);
        
        // If we found events, check if any is a parent (has Recurring Info)
        const parentEvent = matchingEvents.find(record => record.fields['Recurring Info']);
        
        if (parentEvent) {
            // Use the parent event
            console.log("✅ Found parent recurring event:", parentEvent.fields['Event Name']);
            return parentEvent;
        } else {
            // Check if any of the found events is a child with a Series ID
            const childEvent = matchingEvents.find(record => record.fields['Series ID']);
            
            if (childEvent) {
                const seriesId = childEvent.fields['Series ID'];
                console.log("Found child event with Series ID:", seriesId);
                
                // Find the parent event for this series
                const parentEvent = events.find(record => 
                    record.fields['Series ID'] === seriesId && 
                    record.fields['Recurring Info']
                );
                
                if (parentEvent) {
                    console.log("✅ Found parent event:", parentEvent.fields['Event Name']);
                    return parentEvent;
                } else {
                    console.log("⚠️ No parent event found for Series ID:", seriesId);
                    // Use the first child event as fallback
                    return childEvent;
                }
            } else {
                // Use the first event found (standalone event)
                console.log("✅ Using standalone event:", matchingEvents[0].fields['Event Name']);
                return matchingEvents[0];
            }
        }
    } else {
        console.log("❌ No event found with slug:", slug);
        return null;
    }
}

// Test the logic
console.log('Testing event details lookup logic...\n');

// Test 1: Looking for parent event
console.log('=== Test 1: Looking for parent event ===');
const parentResult = findEventBySlug('weekly-drag-show', mockEvents);
console.log('Result:', parentResult ? parentResult.fields['Event Name'] : 'Not found');
console.log('Is Parent:', parentResult ? !!parentResult.fields['Recurring Info'] : 'N/A');
console.log('');

// Test 2: Looking for child event (should find parent)
console.log('=== Test 2: Looking for child event ===');
const childResult = findEventBySlug('weekly-drag-show', mockEvents);
console.log('Result:', childResult ? childResult.fields['Event Name'] : 'Not found');
console.log('Is Parent:', childResult ? !!childResult.fields['Recurring Info'] : 'N/A');
console.log('');

// Test 3: Test recurring event instance lookup
console.log('=== Test 3: Testing recurring event instance lookup ===');
if (parentResult && parentResult.fields['Recurring Info']) {
    const seriesId = parentResult.fields['Series ID'];
    console.log(`Looking for instances with Series ID: ${seriesId}`);
    
    const instances = mockEvents.filter(event => 
        event.fields['Series ID'] === seriesId && 
        event.fields['Date'] > new Date().toISOString()
    );
    
    console.log(`Found ${instances.length} future instances:`);
    instances.forEach((instance, index) => {
        console.log(`  ${index + 1}. ${instance.fields['Event Name']} - ${instance.fields['Date']}`);
    });
}

console.log('\n🎉 Event details lookup logic test completed!');