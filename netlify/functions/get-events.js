const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;

const getCloudinaryUrl = (publicId, width, height) => {
    if (!publicId || !cloudinaryCloudName) return null;
    return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/f_auto,q_auto,w_${width},h_${height},c_limit/${publicId}`;
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
                    finalEvents.push({
                        id: record.id,
                        fields: record.fields,
                        seriesChildren: children.map(child => ({ id: child.id, fields: child.fields }))
                    });
                } else if (!record.fields['Series ID']) {
                    // This is a single event (no Series ID, no Recurring Info)
                    finalEvents.push({ id: record.id, fields: record.fields });
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
                'Venue Name', 'VenueText', 'Category',
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
                const imageUrl = cloudinaryPublicId ? getCloudinaryUrl(cloudinaryPublicId, 500, 281) : (promoImage ? promoImage.url : null);
                const venueName = (fields['Venue Name'] ? fields['Venue Name'][0] : fields['VenueText']) || 'TBC';

                events.push({
                    id: record.id,
                    name: fields['Event Name'],
                    description: fields['Description'],
                    date: fields['Date'],
                    venue: venueName,
                    image: promoImage ? promoImage.url : null,
                    imageWidth: promoImage?.width,
                    imageHeight: promoImage?.height,
                    slug: fields['Slug'] || `#event-${record.id}`,
                    category: fields['Category'] || [],
                    isFeatured: isFeatured,
                    isBoosted: isBoosted,
                    recurringInfo: fields['Recurring Info'] || null
                });

                // Populate uniqueVenues map
                if (venueName && !uniqueVenues.has(venueName)) {
                    uniqueVenues.set(venueName, { id: venueName, name: venueName });
                }
            }
        });

        // Second pass: process recurring series with limited instances
        recurringSeries.forEach((seriesInstances, seriesId) => {
            // Sort instances by date (earliest first)
            seriesInstances.sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));
            
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

                const cloudinaryPublicId = fields['Cloudinary Public ID'];
                const promoImage = fields['Promo Image'] && fields['Promo Image'][0] ? fields['Promo Image'][0] : null;
                const imageUrl = cloudinaryPublicId ? getCloudinaryUrl(cloudinaryPublicId, 500, 281) : (promoImage ? promoImage.url : null);
                const venueName = (fields['Venue Name'] ? fields['Venue Name'][0] : fields['VenueText']) || 'TBC';

                events.push({
                    id: record.id,
                    name: fields['Event Name'],
                    description: fields['Description'],
                    date: fields['Date'],
                    venue: venueName,
                    image: promoImage ? promoImage.url : null,
                    imageWidth: promoImage?.width,
                    imageHeight: promoImage?.height,
                    slug: fields['Slug'] || `#event-${record.id}`,
                    category: fields['Category'] || [],
                    isFeatured: isFeatured,
                    isBoosted: isBoosted,
                    recurringInfo: fields['Recurring Info'] || null,
                    seriesId: seriesId,
                    totalSeriesInstances: seriesInstances.length,
                    instanceNumber: seriesInstances.indexOf(record) + 1
                });

                // Populate uniqueVenues map
                if (venueName && !uniqueVenues.has(venueName)) {
                    uniqueVenues.set(venueName, { id: venueName, name: venueName });
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
