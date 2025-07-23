const Airtable = require('airtable');

exports.handler = async (event, context) => {
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
        console.log('Preview Venue Merges: Starting analysis...');
        
        if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get all venues
        console.log('Preview Venue Merges: Fetching all venues...');
        const venueRecords = await base('Venues').select({
            fields: ['Name', 'Address', 'Description']
        }).all();

        // Get all events to see venue usage
        console.log('Preview Venue Merges: Fetching all events...');
        const eventRecords = await base('Events').select({
            fields: ['Event Name', 'Venue', 'Venue Name', 'VenueText']
        }).all();

        // Analyze venues for duplicates
        const venueGroups = new Map();
        const venueUsage = new Map();
        const venueMap = new Map();

        // Group venues by normalized name
        venueRecords.forEach(venue => {
            const name = venue.fields.Name;
            if (!name) return;
            
            const normalizedName = name.toLowerCase().trim();
            if (!venueGroups.has(normalizedName)) {
                venueGroups.set(normalizedName, []);
            }
            venueGroups.get(normalizedName).push(venue);
            venueMap.set(venue.id, venue.fields);
        });

        // Count venue usage
        eventRecords.forEach(event => {
            const venueId = event.fields['Venue'] && event.fields['Venue'][0];
            if (venueId) {
                venueUsage.set(venueId, (venueUsage.get(venueId) || 0) + 1);
            }
        });

        // Find ONLY exact duplicates (same normalized name)
        const mergePreviews = [];

        for (const [normalizedName, venues] of venueGroups) {
            if (venues.length > 1) {
                // Sort by usage (most used first) and name length (longer names preferred)
                const sortedVenues = venues.sort((a, b) => {
                    const usageA = venueUsage.get(a.id) || 0;
                    const usageB = venueUsage.get(b.id) || 0;
                    if (usageA !== usageB) return usageB - usageA;
                    return b.fields.Name.length - a.fields.Name.length;
                });

                const primary = sortedVenues[0];
                const secondary = sortedVenues.slice(1);

                // Find events that would be updated
                const eventsToUpdate = [];
                const secondaryVenueIds = secondary.map(v => v.id);
                
                eventRecords.forEach(event => {
                    const venueId = event.fields['Venue'] && event.fields['Venue'][0];
                    if (venueId && secondaryVenueIds.includes(venueId)) {
                        eventsToUpdate.push({
                            eventId: event.id,
                            eventName: event.fields['Event Name'] || 'Unnamed Event',
                            oldVenueId: venueId,
                            oldVenueName: venueMap.get(venueId)?.Name || 'Unknown'
                        });
                    }
                });

                mergePreviews.push({
                    type: 'exact_duplicate',
                    normalizedName,
                    primaryVenue: {
                        id: primary.id,
                        name: primary.fields.Name,
                        address: primary.fields.Address,
                        description: primary.fields.Description,
                        usage: venueUsage.get(primary.id) || 0
                    },
                    secondaryVenues: secondary.map(v => ({
                        id: v.id,
                        name: v.fields.Name,
                        address: v.fields.Address,
                        description: v.fields.Description,
                        usage: venueUsage.get(v.id) || 0
                    })),
                    eventsToUpdate,
                    reason: `Multiple venues with exact same name "${primary.fields.Name}"`,
                    totalEventsAffected: eventsToUpdate.length
                });
            }
        }

        console.log(`Preview Venue Merges: Found ${mergePreviews.length} exact duplicate groups`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Venue merge preview completed',
                summary: {
                    totalVenues: venueRecords.length,
                    exactDuplicateGroups: mergePreviews.length,
                    totalEventsToUpdate: mergePreviews.reduce((sum, p) => sum + p.totalEventsAffected, 0),
                    totalVenuesToDelete: mergePreviews.reduce((sum, p) => sum + p.secondaryVenues.length, 0)
                },
                mergePreviews,
                recommendations: [
                    'Review each merge preview carefully before proceeding',
                    'Only exact name duplicates are included (no partial matches)',
                    'Primary venue is chosen based on event count and name length',
                    'All events will be updated to point to the primary venue'
                ]
            })
        };

    } catch (error) {
        console.error('Preview Venue Merges: Error during analysis:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to preview venue merges',
                details: error.message
            })
        };
    }
};