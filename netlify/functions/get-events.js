const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;

// Function to generate URL-friendly slugs
const generateSlug = (eventName, date) => {
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
};

const getCloudinaryUrl = (publicId, width, height) => {
    if (!publicId || !cloudinaryCloudName) return null;
    return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/f_auto,q_auto,w_${width},h_${height},c_limit/${publicId}`;
};

// Helper function to resolve venue information consistently
const resolveVenueInfo = (fields) => {
    // Priority order: Venue (linked record) > Venue Name > VenueText
    const venueRecord = fields['Venue'] && fields['Venue'][0];
    const venueName = fields['Venue Name'] && fields['Venue Name'][0];
    const venueText = fields['VenueText'];
    
    return {
        venueId: venueRecord || null,
        venueName: venueName || venueText || 'TBC',
        venueText: venueText || venueName || 'TBC'
    };
};

console.log('AIRTABLE_PERSONAL_ACCESS_TOKEN:', process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN ? 'Loaded' : 'Not Loaded');
console.log('AIRTABLE_BASE_ID:', process.env.AIRTABLE_BASE_ID ? 'Loaded' : 'Not Loaded');

exports.handler = async (event, context) => {
    try {
        const { view } = event.queryStringParameters;
        if (view === 'admin') {
            const query = base('Events').select({
                view: "Approved Upcoming",
                sort: [{ field: 'Date', direction: 'asc' }],
                fields: [
                    'Event Name', 'Description', 'Date', 'Promo Image', 'Slug',
                    'Venue', 'Venue Name', 'VenueText', 'Category', 'Recurring Info', 'Recurring JSON', 'Series ID'
                ]
            });
            const allRecords = await query.all();

            const eventsById = new Map();
            const seriesParents = new Map(); // Stores parent events (those with Recurring Info)
            const seriesChildren = new Map(); // Stores arrays of child events, keyed by Series ID

            allRecords.forEach(record => {
                eventsById.set(record.id, record);

                if (record.fields['Recurring Info']) {
                    // This event is a series parent (it defines the recurrence)
                    seriesParents.set(record.id, record);
                }

                if (record.fields['Series ID'] && record.fields['Series ID'] !== record.id) {
                    // This event is a child instance of a series
                    const seriesId = record.fields['Series ID'];
                    if (!seriesChildren.has(seriesId)) {
                        seriesChildren.set(seriesId, []);
                    }
                    seriesChildren.get(seriesId).push(record);
                }
            });

            const finalEvents = [];
            eventsById.forEach(record => {
                if (seriesParents.has(record.id)) {
                    // This is a series parent (has Recurring Info)
                    const children = seriesChildren.get(record.id) || [];
                    children.sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));
                    
                    const venueInfo = resolveVenueInfo(record.fields);
                    finalEvents.push({
                        id: record.id,
                        fields: {
                            ...record.fields,
                            venueId: venueInfo.venueId,
                            venueName: venueInfo.venueName,
                            venueText: venueInfo.venueText
                        },
                        seriesChildren: children.map(child => {
                            const childVenueInfo = resolveVenueInfo(child.fields);
                            return { 
                                id: child.id, 
                                fields: {
                                    ...child.fields,
                                    venueId: childVenueInfo.venueId,
                                    venueName: childVenueInfo.venueName,
                                    venueText: childVenueInfo.venueText
                                }
                            };
                        })
                    });
                } else if (!record.fields['Series ID']) {
                    // This is a single event (no Series ID, no Recurring Info)
                    const venueInfo = resolveVenueInfo(record.fields);
                    finalEvents.push({ 
                        id: record.id, 
                        fields: {
                            ...record.fields,
                            venueId: venueInfo.venueId,
                            venueName: venueInfo.venueName,
                            venueText: venueInfo.venueText
                        }
                    });
                }
                // Events that are children (have Series ID but no Recurring Info, and Series ID != record.id) are implicitly handled by their parent and not added as top-level events.
            });

            // Sort the final list of events (single events and series parents) by date
            finalEvents.sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));

            return { statusCode: 200, body: JSON.stringify({ events: finalEvents, offset: allRecords.offset }) };
        }

        // --- PUBLIC SITE LOGIC ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get the number of instances to show from settings
        const instancesToShow = parseInt(process.env.RECURRING_INSTANCES_TO_SHOW) || 6;
        console.log(`get-events: Will show up to ${instancesToShow} instances per recurring series`);

        const allRecords = await base('Events').select({
            filterByFormula: "AND({Status} = 'Approved', IS_AFTER({Date}, DATEADD(TODAY(), -1, 'days')))",
            sort: [{ field: 'Date', direction: 'asc' }],
            fields: [
                'Event Name', 'Description', 'Date', 'Promo Image', 'Slug', 
                'Venue Name', 'VenueText', 'Venue', 'Category',
                'Featured Banner Start Date', 'Featured Banner End Date',
                'Boosted Listing Start Date', 'Boosted Listing End Date',
                'Cloudinary Public ID', 'Recurring Info', 'Series ID'
            ]
        }).all();
        
        const events = [];
        const uniqueVenues = new Map(); // To store unique venue names and a placeholder ID if needed
        const recurringSeries = new Map(); // Group recurring events by Series ID

        // First pass: group recurring events and process standalone events
        allRecords.forEach((record) => {
            const fields = record.fields;
            
            // If it's part of a recurring series, group it
            if (fields['Series ID']) {
                const seriesId = fields['Series ID'];
                if (!recurringSeries.has(seriesId)) {
                    recurringSeries.set(seriesId, []);
                }
                recurringSeries.get(seriesId).push(record);
            } else {
                // Standalone event - process it normally
                let isFeatured = false;
                let isBoosted = false;

                const featuredStartDate = fields['Featured Banner Start Date'] ? new Date(fields['Featured Banner Start Date']) : null;
                const featuredEndDate = fields['Featured Banner End Date'] ? new Date(fields['Featured Banner End Date']) : null;
                if (featuredStartDate && featuredEndDate && today >= featuredStartDate && today <= new Date(featuredEndDate.getTime() + 86400000) ) {
                    isFeatured = true;
                }

                const boostedStartDate = fields['Boosted Listing Start Date'] ? new Date(fields['Boosted Listing Start Date']) : null;
                const boostedEndDate = fields['Boosted Listing End Date'] ? new Date(fields['Boosted Listing End Date']) : null;
                if (boostedStartDate && boostedEndDate && today >= boostedStartDate && today <= new Date(boostedEndDate.getTime() + 86400000) ) {
                    isBoosted = true;
                }

                const cloudinaryPublicId = fields['Cloudinary Public ID'];
                const promoImage = fields['Promo Image'] && fields['Promo Image'][0] ? fields['Promo Image'][0] : null;
                let imageUrl = null;
                
                try {
                    imageUrl = cloudinaryPublicId ? getCloudinaryUrl(cloudinaryPublicId, 500, 281) : (promoImage ? promoImage.url : null);
                    if (!imageUrl) {
                        console.log("No image URL found for event:", fields['Event Name']);
                        imageUrl = 'https://placehold.co/500x281/1e1e1e/EAEAEA?text=Event';
                    }
                } catch (imageError) {
                    console.error("Error processing image for event:", fields['Event Name'], imageError);
                    imageUrl = 'https://placehold.co/500x281/1e1e1e/EAEAEA?text=Event';
                }
                
                const venueInfo = resolveVenueInfo(fields);

                // Generate proper slug for standalone events
                let eventSlug = fields['Slug'];
                if (!eventSlug || eventSlug.startsWith('#event-')) {
                    // For standalone events, include the date
                    eventSlug = generateSlug(fields['Event Name'], fields['Date']);
                }

                events.push({
                    id: record.id,
                    name: fields['Event Name'],
                    description: fields['Description'],
                    date: fields['Date'],
                    venue: venueInfo.venueName,
                    venueId: venueInfo.venueId,
                    venueText: venueInfo.venueText,
                    image: imageUrl,
                    imageWidth: promoImage?.width,
                    imageHeight: promoImage?.height,
                    slug: eventSlug,
                    category: fields['Category'] || [],
                    isFeatured: isFeatured,
                    isBoosted: isBoosted,
                    recurringInfo: fields['Recurring Info'] || null
                });

                // Populate uniqueVenues map
                if (venueInfo.venueName && !uniqueVenues.has(venueInfo.venueName)) {
                    uniqueVenues.set(venueInfo.venueName, { 
                        id: venueInfo.venueId || venueInfo.venueName, 
                        name: venueInfo.venueName 
                    });
                }
            }
        });

        // Second pass: process recurring series with limited instances
        recurringSeries.forEach((seriesInstances, seriesId) => {
            // Sort instances by date (earliest first)
            seriesInstances.sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));
            
            // Find the parent event (the one with Recurring Info) to get the image
            const parentEvent = seriesInstances.find(instance => instance.fields['Recurring Info']);
            let parentImageUrl = null;
            let parentPromoImage = null;
            
            if (parentEvent) {
                const parentCloudinaryPublicId = parentEvent.fields['Cloudinary Public ID'];
                parentPromoImage = parentEvent.fields['Promo Image'] && parentEvent.fields['Promo Image'][0] ? parentEvent.fields['Promo Image'][0] : null;
                try {
                    parentImageUrl = parentCloudinaryPublicId ? getCloudinaryUrl(parentCloudinaryPublicId, 500, 281) : (parentPromoImage ? parentPromoImage.url : null);
                } catch (imageError) {
                    console.error("Error processing parent event image:", imageError);
                }
            }
            
            // Limit to configured number of instances
            const limitedInstances = seriesInstances.slice(0, instancesToShow);
            
            // Process each limited instance
            limitedInstances.forEach((record) => {
                const fields = record.fields;
                let isFeatured = false;
                let isBoosted = false;

                const featuredStartDate = fields['Featured Banner Start Date'] ? new Date(fields['Featured Banner Start Date']) : null;
                const featuredEndDate = fields['Featured Banner End Date'] ? new Date(fields['Featured Banner End Date']) : null;
                if (featuredStartDate && featuredEndDate && today >= featuredStartDate && today <= new Date(featuredEndDate.getTime() + 86400000) ) {
                    isFeatured = true;
                }

                const boostedStartDate = fields['Boosted Listing Start Date'] ? new Date(fields['Boosted Listing Start Date']) : null;
                const boostedEndDate = fields['Boosted Listing End Date'] ? new Date(fields['Boosted Listing End Date']) : null;
                if (boostedStartDate && boostedEndDate && today >= boostedStartDate && today <= new Date(boostedEndDate.getTime() + 86400000) ) {
                    isBoosted = true;
                }

                // Try to get image from this instance first, then fall back to parent
                const cloudinaryPublicId = fields['Cloudinary Public ID'];
                const promoImage = fields['Promo Image'] && fields['Promo Image'][0] ? fields['Promo Image'][0] : null;
                let imageUrl = null;
                
                try {
                    // First try this instance's image
                    imageUrl = cloudinaryPublicId ? getCloudinaryUrl(cloudinaryPublicId, 500, 281) : (promoImage ? promoImage.url : null);
                    
                    // If no image, try parent's image
                    if (!imageUrl && parentImageUrl) {
                        imageUrl = parentImageUrl;
                        console.log("Using parent event image for recurring instance:", fields['Event Name']);
                    }
                    
                    // If still no image, use placeholder
                    if (!imageUrl) {
                        console.log("No image URL found for recurring event:", fields['Event Name']);
                        imageUrl = 'https://placehold.co/500x281/1e1e1e/EAEAEA?text=Event';
                    }
                } catch (imageError) {
                    console.error("Error processing image for recurring event:", fields['Event Name'], imageError);
                    imageUrl = 'https://placehold.co/500x281/1e1e1e/EAEAEA?text=Event';
                }
                
                const venueInfo = resolveVenueInfo(fields);

                // For recurring events, generate proper slugs (without dates)
                let eventSlug = fields['Slug'];
                
                if (!eventSlug || eventSlug.startsWith('#event-')) {
                    // Generate a proper slug for this event (without date for recurring events)
                    if (fields['Recurring Info'] || parentEvent) {
                        // This is a recurring event, don't include date
                        eventSlug = generateSlug(fields['Event Name']);
                    } else {
                        // This is a standalone event, include date
                        eventSlug = generateSlug(fields['Event Name'], fields['Date']);
                    }
                }
                
                // For child instances, use the parent's slug (without date)
                if (!fields['Recurring Info'] && parentEvent) {
                    const parentSlug = parentEvent.fields['Slug'];
                    if (parentSlug && !parentSlug.startsWith('#event-')) {
                        // Use parent's slug without date
                        eventSlug = generateSlug(parentEvent.fields['Event Name']);
                    } else {
                        // Generate a proper slug for the parent
                        eventSlug = generateSlug(parentEvent.fields['Event Name']);
                    }
                }
                
                events.push({
                    id: record.id,
                    name: fields['Event Name'],
                    description: fields['Description'],
                    date: fields['Date'],
                    venue: venueInfo.venueName,
                    venueId: venueInfo.venueId,
                    venueText: venueInfo.venueText,
                    image: imageUrl,
                    imageWidth: promoImage?.width,
                    imageHeight: promoImage?.height,
                    slug: eventSlug,
                    category: fields['Category'] || [],
                    isFeatured: isFeatured,
                    isBoosted: isBoosted,
                    recurringInfo: fields['Recurring Info'] || null,
                    seriesId: seriesId,
                    totalSeriesInstances: seriesInstances.length,
                    instanceNumber: seriesInstances.indexOf(record) + 1
                });

                // Populate uniqueVenues map
                if (venueInfo.venueName && !uniqueVenues.has(venueInfo.venueName)) {
                    uniqueVenues.set(venueInfo.venueName, { 
                        id: venueInfo.venueId || venueInfo.venueName, 
                        name: venueInfo.venueName 
                    });
                }
            });
        });
        
        // Convert map values to an array for the response
        const venues = Array.from(uniqueVenues.values());

        return {
            statusCode: 200,
            body: JSON.stringify({ events: events, venues: venues }), // Return both events and venues
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        };

    } catch (error) {
        console.error("Error in get-events function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch events and venues', details: error.message }),
        };
    }
};
