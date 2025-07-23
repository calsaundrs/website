// Test script to verify recurring event slug logic
// This simulates the logic from get-events.js

// Mock data structure similar to what Airtable would return
const mockRecurringEvents = [
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
            'Slug': 'weekly-drag-show-2024-01-12',
            'Recurring Info': '',
            'Series ID': 'rec_parent_123',
            'Date': '2024-01-12T20:00:00.000Z'
        }
    },
    {
        id: 'rec_child_2',
        fields: {
            'Event Name': 'Weekly Drag Show',
            'Slug': 'weekly-drag-show-2024-01-19',
            'Recurring Info': '',
            'Series ID': 'rec_parent_123',
            'Date': '2024-01-19T20:00:00.000Z'
        }
    }
];

// Simulate the logic from get-events.js
function processRecurringEvents(records) {
    const events = [];
    const recurringSeries = new Map();
    
    // Group by Series ID
    records.forEach(record => {
        const seriesId = record.fields['Series ID'];
        if (seriesId) {
            if (!recurringSeries.has(seriesId)) {
                recurringSeries.set(seriesId, []);
            }
            recurringSeries.get(seriesId).push(record);
        }
    });
    
    // Process recurring series
    recurringSeries.forEach((seriesInstances, seriesId) => {
        // Find the parent event (the one with Recurring Info)
        const parentEvent = seriesInstances.find(instance => instance.fields['Recurring Info']);
        
        // Process each instance
        seriesInstances.forEach((record) => {
            const fields = record.fields;
            
            // For recurring events, use the parent event's slug (the one with Recurring Info)
            let eventSlug = fields['Slug'] || `#event-${record.id}`;
            if (!fields['Recurring Info'] && parentEvent) {
                // This is a child instance, use the parent's slug
                eventSlug = parentEvent.fields['Slug'] || `#event-${parentEvent.id}`;
            }
            
            events.push({
                id: record.id,
                name: fields['Event Name'],
                date: fields['Date'],
                slug: eventSlug,
                recurringInfo: fields['Recurring Info'] || null,
                seriesId: seriesId,
                isParent: !!fields['Recurring Info']
            });
        });
    });
    
    return events;
}

// Test the logic
console.log('Testing recurring event slug logic...\n');

const processedEvents = processRecurringEvents(mockRecurringEvents);

console.log('Processed Events:');
processedEvents.forEach((event, index) => {
    console.log(`${index + 1}. ${event.name}`);
    console.log(`   ID: ${event.id}`);
    console.log(`   Date: ${event.date}`);
    console.log(`   Slug: ${event.slug}`);
    console.log(`   Is Parent: ${event.isParent}`);
    console.log(`   Recurring Info: ${event.recurringInfo || 'None'}`);
    console.log('');
});

// Verify that all instances use the parent's slug
const parentSlug = processedEvents.find(e => e.isParent)?.slug;
const allUseParentSlug = processedEvents.every(e => e.slug === parentSlug);

console.log(`✅ All recurring event instances use parent slug: ${allUseParentSlug}`);
console.log(`Parent slug: ${parentSlug}`);

if (allUseParentSlug) {
    console.log('🎉 SUCCESS: Recurring event slug logic is working correctly!');
} else {
    console.log('❌ ERROR: Some instances are not using the parent slug');
}