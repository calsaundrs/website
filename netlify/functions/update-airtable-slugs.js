const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

function generateSlug(eventName, date) {
    // Convert event name to URL-friendly slug
    let slug = eventName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .trim();
    
    // Add date if provided
    if (date) {
        const dateStr = new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD format
        slug = `${slug}-${dateStr}`;
    }
    
    return slug;
}

exports.handler = async function (event, context) {
    try {
        console.log('update-airtable-slugs: Starting to update Airtable slugs...');
        
        // Get all events
        const allRecords = await base('Events').select({
            fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date']
        }).all();
        
        console.log(`update-airtable-slugs: Found ${allRecords.length} events`);
        
        const updates = [];
        
        // Group events by Series ID to handle recurring events
        const seriesGroups = new Map();
        
        allRecords.forEach(record => {
            const seriesId = record.fields['Series ID'];
            if (seriesId) {
                if (!seriesGroups.has(seriesId)) {
                    seriesGroups.set(seriesId, []);
                }
                seriesGroups.get(seriesId).push(record);
            }
        });
        
        // Process recurring series
        seriesGroups.forEach((seriesInstances, seriesId) => {
            console.log(`update-airtable-slugs: Processing series ${seriesId} with ${seriesInstances.length} instances`);
            
            // Find the parent event (the one with Recurring Info)
            const parentEvent = seriesInstances.find(instance => instance.fields['Recurring Info']);
            
            if (parentEvent) {
                console.log(`update-airtable-slugs: Found parent event "${parentEvent.fields['Event Name']}" for series ${seriesId}`);
                // Generate slug for parent event (without date)
                const parentSlug = generateSlug(parentEvent.fields['Event Name']);
                
                // Update parent event if slug is missing, is a fallback, or doesn't match
                const currentParentSlug = parentEvent.fields['Slug'];
                if (!currentParentSlug || currentParentSlug.startsWith('#event-') || currentParentSlug !== parentSlug) {
                    console.log(`update-airtable-slugs: Updating parent event "${parentEvent.fields['Event Name']}" slug from "${currentParentSlug || 'null'}" to "${parentSlug}"`);
                    updates.push({
                        id: parentEvent.id,
                        fields: { 'Slug': parentSlug }
                    });
                }
                
                // Update all child events to use parent's slug
                seriesInstances.forEach(instance => {
                    if (!instance.fields['Recurring Info']) { // This is a child
                        const currentChildSlug = instance.fields['Slug'];
                        if (!currentChildSlug || currentChildSlug.startsWith('#event-') || currentChildSlug !== parentSlug) {
                            console.log(`update-airtable-slugs: Updating child event "${instance.fields['Event Name']}" slug from "${currentChildSlug || 'null'}" to "${parentSlug}"`);
                            updates.push({
                                id: instance.id,
                                fields: { 'Slug': parentSlug }
                            });
                        }
                    }
                });
            } else {
                console.log(`update-airtable-slugs: No parent event found for series ${seriesId}, generating slug from first instance`);
                // If no parent event found, use the first instance to generate a slug
                const firstInstance = seriesInstances[0];
                const seriesSlug = generateSlug(firstInstance.fields['Event Name']);
                
                // Update all instances to use the same slug
                seriesInstances.forEach(instance => {
                    const currentSlug = instance.fields['Slug'];
                    if (!currentSlug || currentSlug.startsWith('#event-') || currentSlug !== seriesSlug) {
                        console.log(`update-airtable-slugs: Updating series instance "${instance.fields['Event Name']}" slug from "${currentSlug || 'null'}" to "${seriesSlug}"`);
                        updates.push({
                            id: instance.id,
                            fields: { 'Slug': seriesSlug }
                        });
                    }
                });
            }
        });
        
        // Process standalone events (no Series ID)
        allRecords.forEach(record => {
            if (!record.fields['Series ID']) {
                const currentSlug = record.fields['Slug'];
                const newSlug = generateSlug(record.fields['Event Name'], record.fields['Date']);
                
                if (!currentSlug || currentSlug.startsWith('#event-') || currentSlug !== newSlug) {
                    console.log(`update-airtable-slugs: Updating standalone event "${record.fields['Event Name']}" slug from "${currentSlug || 'null'}" to "${newSlug}"`);
                    updates.push({
                        id: record.id,
                        fields: { 'Slug': newSlug }
                    });
                }
            }
        });
        
        // Update records in batches
        if (updates.length > 0) {
            console.log(`update-airtable-slugs: Updating ${updates.length} records...`);
            
            const batchSize = 10; // Airtable limit
            for (let i = 0; i < updates.length; i += batchSize) {
                const batch = updates.slice(i, i + batchSize);
                await base('Events').update(batch);
                console.log(`update-airtable-slugs: Updated batch ${Math.floor(i / batchSize) + 1}`);
            }
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Airtable slugs updated successfully',
                totalUpdates: updates.length,
                updatedEvents: updates.map(u => u.id)
            })
        };
        
    } catch (error) {
        console.error('update-airtable-slugs: Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to update Airtable slugs',
                details: error.message
            })
        };
    }
};