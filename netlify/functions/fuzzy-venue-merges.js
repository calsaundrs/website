const Airtable = require('airtable');

// Helper function to calculate similarity between two strings
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return 1.0;
    
    // One contains the other
    if (s1.includes(s2) || s2.includes(s1)) {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        return shorter.length / longer.length;
    }
    
    // Word-based similarity
    const words1 = s1.split(/\s+/).filter(w => w.length > 2);
    const words2 = s2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word1 => 
        words2.some(word2 => 
            word1.includes(word2) || word2.includes(word1) || 
            word1 === word2
        )
    );
    
    const totalWords = Math.max(words1.length, words2.length);
    return commonWords.length / totalWords;
}

// Helper function to find venue groups with fuzzy matching
function findFuzzyVenueGroups(venues, similarityThreshold = 0.3) {
    const groups = [];
    const processed = new Set();
    
    for (let i = 0; i < venues.length; i++) {
        if (processed.has(i)) continue;
        
        const group = [venues[i]];
        processed.add(i);
        
        for (let j = i + 1; j < venues.length; j++) {
            if (processed.has(j)) continue;
            
            const similarity = calculateSimilarity(venues[i].fields.Name, venues[j].fields.Name);
            if (similarity >= similarityThreshold) {
                group.push(venues[j]);
                processed.add(j);
            }
        }
        
        if (group.length > 1) {
            groups.push(group);
        }
    }
    
    return groups;
}

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
        console.log('Fuzzy Venue Merges: Starting fuzzy venue analysis...');
        
        if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get all venues
        console.log('Fuzzy Venue Merges: Fetching all venues...');
        const venueRecords = await base('Venues').select({
            fields: ['Name', 'Address', 'Description']
        }).all();

        // Get all events to see venue usage
        console.log('Fuzzy Venue Merges: Fetching all events...');
        const eventRecords = await base('Events').select({
            fields: ['Event Name', 'Venue', 'Venue Name', 'VenueText']
        }).all();

        // Count venue usage
        const venueUsage = new Map();
        const venueMap = new Map();
        
        venueRecords.forEach(venue => {
            venueMap.set(venue.id, venue.fields);
        });
        
        eventRecords.forEach(event => {
            const venueId = event.fields['Venue'] && event.fields['Venue'][0];
            if (venueId) {
                venueUsage.set(venueId, (venueUsage.get(venueId) || 0) + 1);
            }
        });

        // Find fuzzy venue groups
        console.log('Fuzzy Venue Merges: Finding fuzzy venue groups...');
        const venueGroups = findFuzzyVenueGroups(venueRecords, 0.3); // 30% similarity threshold
        
        console.log(`Fuzzy Venue Merges: Found ${venueGroups.length} fuzzy venue groups`);

        // Process each group to create merge operations
        const mergePreviews = [];
        
        for (const group of venueGroups) {
            // Sort by usage (most used first) and name length (longer names preferred)
            const sortedVenues = group.sort((a, b) => {
                const usageA = venueUsage.get(a.id) || 0;
                const usageB = venueUsage.get(b.id) || 0;
                if (usageA !== usageB) return usageB - usageA;
                return b.fields.Name.length - a.fields.Name.length;
            });

            const primary = sortedVenues[0];
            const secondary = sortedVenues.slice(1);

            // Calculate similarities for reporting
            const similarities = secondary.map(venue => ({
                venue: venue,
                similarity: calculateSimilarity(primary.fields.Name, venue.fields.Name)
            }));

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
                type: 'fuzzy_match',
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
                similarities,
                eventsToUpdate,
                reason: `Fuzzy match: "${primary.fields.Name}" similar to ${secondary.map(v => `"${v.fields.Name}"`).join(', ')}`,
                totalEventsAffected: eventsToUpdate.length
            });
        }

        // Sort by total events affected (most impactful first)
        mergePreviews.sort((a, b) => b.totalEventsAffected - a.totalEventsAffected);

        console.log(`Fuzzy Venue Merges: Generated ${mergePreviews.length} merge previews`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Fuzzy venue merge analysis completed',
                summary: {
                    totalVenues: venueRecords.length,
                    fuzzyGroups: venueGroups.length,
                    mergePreviews: mergePreviews.length,
                    totalEventsToUpdate: mergePreviews.reduce((sum, p) => sum + p.totalEventsAffected, 0),
                    totalVenuesToDelete: mergePreviews.reduce((sum, p) => sum + p.secondaryVenues.length, 0)
                },
                mergePreviews,
                recommendations: [
                    'Review each fuzzy match carefully - some may be false positives',
                    'Similarity scores show how closely venues match',
                    'Primary venue is chosen based on event count and name length',
                    'Consider adjusting similarity threshold if needed'
                ]
            })
        };

    } catch (error) {
        console.error('Fuzzy Venue Merges: Error during analysis:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to analyze fuzzy venue matches',
                details: error.message
            })
        };
    }
};