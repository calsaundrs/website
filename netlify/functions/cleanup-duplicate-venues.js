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
        console.log('Cleanup Duplicate Venues: Starting analysis...');
        
        if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
            throw new Error('Missing required environment variables');
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        
        // Get all venues
        console.log('Cleanup Duplicate Venues: Fetching all venues...');
        const venueRecords = await base('Venues').select({
            fields: ['Name', 'Address', 'Description']
        }).all();

        // Get all events to see venue usage
        console.log('Cleanup Duplicate Venues: Fetching all events...');
        const eventRecords = await base('Events').select({
            fields: ['Event Name', 'Venue', 'Venue Name', 'VenueText']
        }).all();

        // Analyze venues for potential duplicates
        const venueGroups = new Map();
        const venueUsage = new Map();

        // Group venues by normalized name
        venueRecords.forEach(venue => {
            const name = venue.fields.Name;
            if (!name) return;
            
            const normalizedName = name.toLowerCase().trim();
            if (!venueGroups.has(normalizedName)) {
                venueGroups.set(normalizedName, []);
            }
            venueGroups.get(normalizedName).push(venue);
        });

        // Count venue usage
        eventRecords.forEach(event => {
            const venueId = event.fields['Venue'] && event.fields['Venue'][0];
            if (venueId) {
                venueUsage.set(venueId, (venueUsage.get(venueId) || 0) + 1);
            }
        });

        // Find potential duplicates
        const duplicates = [];
        const suggestions = [];

        for (const [normalizedName, venues] of venueGroups) {
            if (venues.length > 1) {
                // Multiple venues with same normalized name
                duplicates.push({
                    normalizedName,
                    venues: venues.map(v => ({
                        id: v.id,
                        name: v.fields.Name,
                        address: v.fields.Address,
                        description: v.fields.Description,
                        usage: venueUsage.get(v.id) || 0
                    }))
                });
            }
        }

        // Find similar venue names that might be duplicates
        const venueNames = Array.from(venueGroups.keys());
        for (let i = 0; i < venueNames.length; i++) {
            for (let j = i + 1; j < venueNames.length; j++) {
                const name1 = venueNames[i];
                const name2 = venueNames[j];
                
                // Check if one name contains the other
                if (name1.includes(name2) || name2.includes(name1)) {
                    const venues1 = venueGroups.get(name1);
                    const venues2 = venueGroups.get(name2);
                    
                    if (venues1 && venues2) {
                        suggestions.push({
                            type: 'containment',
                            name1,
                            name2,
                            venues1: venues1.map(v => ({
                                id: v.id,
                                name: v.fields.Name,
                                usage: venueUsage.get(v.id) || 0
                            })),
                            venues2: venues2.map(v => ({
                                id: v.id,
                                name: v.fields.Name,
                                usage: venueUsage.get(v.id) || 0
                            }))
                        });
                    }
                }
            }
        }

        // Generate merge recommendations
        const mergeRecommendations = [];

        // For exact duplicates, recommend keeping the one with most usage
        duplicates.forEach(duplicate => {
            const venues = duplicate.venues.sort((a, b) => b.usage - a.usage);
            const primary = venues[0];
            const secondary = venues.slice(1);
            
            mergeRecommendations.push({
                type: 'exact_duplicate',
                primaryVenue: primary,
                secondaryVenues: secondary,
                reason: `Multiple venues with same name "${primary.name}"`,
                action: `Keep "${primary.name}" (${primary.usage} events), merge others`
            });
        });

        // For containment duplicates, recommend keeping the more specific name
        suggestions.forEach(suggestion => {
            if (suggestion.type === 'containment') {
                const longerName = suggestion.name1.length > suggestion.name2.length ? suggestion.name1 : suggestion.name2;
                const shorterName = suggestion.name1.length > suggestion.name2.length ? suggestion.name2 : suggestion.name1;
                
                const longerVenues = suggestion.name1.length > suggestion.name2.length ? suggestion.venues1 : suggestion.venues2;
                const shorterVenues = suggestion.name1.length > suggestion.name2.length ? suggestion.venues2 : suggestion.venues1;
                
                const totalUsageLonger = longerVenues.reduce((sum, v) => sum + v.usage, 0);
                const totalUsageShorter = shorterVenues.reduce((sum, v) => sum + v.usage, 0);
                
                mergeRecommendations.push({
                    type: 'containment',
                    primaryVenues: longerVenues,
                    secondaryVenues: shorterVenues,
                    reason: `"${longerName}" contains "${shorterName}"`,
                    action: `Consider merging "${shorterName}" into "${longerName}" (${totalUsageLonger} vs ${totalUsageShorter} events)`
                });
            }
        });

        console.log(`Cleanup Duplicate Venues: Found ${duplicates.length} exact duplicates and ${suggestions.length} potential containment duplicates`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Duplicate venue analysis completed',
                summary: {
                    totalVenues: venueRecords.length,
                    exactDuplicates: duplicates.length,
                    potentialDuplicates: suggestions.length,
                    mergeRecommendations: mergeRecommendations.length
                },
                duplicates,
                suggestions,
                mergeRecommendations,
                venueUsage: Object.fromEntries(venueUsage),
                recommendations: [
                    'Review merge recommendations before taking action',
                    'Consider venue usage counts when deciding which to keep',
                    'Backup data before performing any merges',
                    'Update event venue references after merging venues'
                ]
            })
        };

    } catch (error) {
        console.error('Cleanup Duplicate Venues: Error during analysis:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to analyze duplicate venues',
                details: error.message
            })
        };
    }
};