const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function (event, context) {
    try {
        console.log('debug-slugs: Starting to examine Airtable slugs...');
        
        // Get all events
        const allRecords = await base('Events').select({
            fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date']
        }).all();
        
        console.log(`debug-slugs: Found ${allRecords.length} events`);
        
        const slugAnalysis = {
            totalEvents: allRecords.length,
            eventsWithFallbackSlugs: [],
            eventsWithProperSlugs: [],
            eventsWithNoSlugs: [],
            recurringEvents: [],
            standaloneEvents: []
        };
        
        allRecords.forEach(record => {
            const eventName = record.fields['Event Name'];
            const slug = record.fields['Slug'];
            const hasRecurringInfo = record.fields['Recurring Info'];
            const seriesId = record.fields['Series ID'];
            
            if (!slug) {
                slugAnalysis.eventsWithNoSlugs.push({
                    name: eventName,
                    id: record.id,
                    hasRecurringInfo: !!hasRecurringInfo,
                    seriesId: seriesId
                });
            } else if (slug.startsWith('#event-')) {
                slugAnalysis.eventsWithFallbackSlugs.push({
                    name: eventName,
                    slug: slug,
                    id: record.id,
                    hasRecurringInfo: !!hasRecurringInfo,
                    seriesId: seriesId
                });
            } else {
                slugAnalysis.eventsWithProperSlugs.push({
                    name: eventName,
                    slug: slug,
                    id: record.id,
                    hasRecurringInfo: !!hasRecurringInfo,
                    seriesId: seriesId
                });
            }
            
            if (hasRecurringInfo || seriesId) {
                slugAnalysis.recurringEvents.push({
                    name: eventName,
                    slug: slug,
                    id: record.id,
                    hasRecurringInfo: !!hasRecurringInfo,
                    seriesId: seriesId
                });
            } else {
                slugAnalysis.standaloneEvents.push({
                    name: eventName,
                    slug: slug,
                    id: record.id
                });
            }
        });
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slugAnalysis, null, 2)
        };
        
    } catch (error) {
        console.error('debug-slugs: Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to debug slugs',
                details: error.message
            })
        };
    }
};