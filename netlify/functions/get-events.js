const FirestoreEventService = require('./services/firestore-event-service');
const admin = require('firebase-admin');
const RecurringEventsManager = require('./services/recurring-events-manager');

// Version: 2025-01-27-v1 - Firestore-based events listing function

// Maximum number of approved events to fetch before client-side date filtering.
// Firestore doesn't support offset-based pagination, so we fetch up to this limit
// and slice in memory.
const MAX_EVENTS_FETCH_LIMIT = 500;

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    if (process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    } else {
        // Fallback for local dev if private key isn't set
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    }
}

const db = admin.firestore();
const eventService = new FirestoreEventService();

exports.handler = async function (event, context) {
    console.log("get-events function called");
    console.log("Query parameters:", event.queryStringParameters);

    try {
        const queryParams = event.queryStringParameters || {};
        const view = queryParams.view || 'public';

        // Handle different views
        if (view === 'venues') {
            return await handleVenuesView();
        } else if (view === 'admin') {
            return await handleAdminView(queryParams);
        } else {
            return await handlePublicView(queryParams);
        }

    } catch (error) {
        console.error('Error in get-events:', error);
        console.error('Error stack:', error.stack);

        // Check if this is an index error
        if (error.message && error.message.includes('FAILED_PRECONDITION')) {
            console.log('This is an index error - follow the link in the error message to create the required index');
        }

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                details: error.details || 'No additional details available',
                code: error.code || 'UNKNOWN'
            })
        };
    }
};

async function handlePublicView(queryParams) {
    const filters = {
        status: 'approved',
        dateRange: queryParams.dateRange ? JSON.parse(queryParams.dateRange) : { type: 'all' },
        categories: queryParams.categories ? queryParams.categories.split(',') : [],
        venues: queryParams.venues ? queryParams.venues.split(',') : [],
        search: queryParams.search || '',
        limit: parseInt(queryParams.limit) || 50,
        offset: parseInt(queryParams.offset) || 0,
        includeAdult: queryParams.includeAdult === 'true'
    };

    console.log("Public view filters:", filters);

    try {
        const eventsRef = db.collection('events');
        let query = eventsRef.where('status', '==', 'approved');

        // Start with a simple query that will work immediately
        // This will generate index creation links for more complex queries
        console.log("Using basic query to generate index links");

        // For now, get approved events without ordering to avoid index requirements
        // We'll add ordering back once the basic index is created
        console.log("Using simple query without ordering to avoid index requirements");

        // Fetch all approved events; limit applied after client-side date filtering
        query = query.limit(MAX_EVENTS_FETCH_LIMIT);

        console.log("Executing Firestore query...");
        const snapshot = await query.get();
        console.log(`Query returned ${snapshot.size} documents`);

        const now = new Date();
        const events = [];

        // First pass: map raw docs, filter out past/invalid dates (cheap — no DB calls)
        const candidateDocs = [];
        for (const doc of snapshot.docs) {
            const rawData = doc.data();
            const dateStr = rawData['Date'] || rawData.date;
            if (!dateStr) continue;
            const eventDate = new Date(dateStr);
            if (isNaN(eventDate.getTime()) || eventDate < now) continue;

            // Apply search filter early before expensive processing
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const name = rawData['Event Name'] || rawData.name || '';
                const desc = rawData['Description'] || rawData.description || '';
                if (!name.toLowerCase().includes(searchLower) && !desc.toLowerCase().includes(searchLower)) continue;
            }

            candidateDocs.push({ doc, rawData });
        }

        console.log(`${snapshot.size} docs fetched, ${candidateDocs.length} are upcoming`);

        // Batch-fetch all needed venues in one go (instead of N+1 queries)
        const uniqueVenueSlugs = [...new Set(
            candidateDocs
                .map(({ rawData }) => rawData['Venue Slug'] || rawData.venueSlug)
                .filter(Boolean)
        )];

        const venueMap = new Map();
        if (uniqueVenueSlugs.length > 0) {
            // Firestore 'in' queries support up to 30 values per batch
            const BATCH_SIZE = 30;
            const batchPromises = [];

            for (let i = 0; i < uniqueVenueSlugs.length; i += BATCH_SIZE) {
                const batch = uniqueVenueSlugs.slice(i, i + BATCH_SIZE);
                const batchPromise = db.collection('venues')
                    .where('slug', 'in', batch)
                    .get()
                    .then(venueSnapshot => {
                        venueSnapshot.forEach(vDoc => {
                            const v = processVenueForPublic({ id: vDoc.id, ...vDoc.data() });
                            venueMap.set(v.slug, v);
                        });
                    })
                    .catch(err => {
                        console.warn('Venue batch fetch failed:', err.message);
                    });
                batchPromises.push(batchPromise);
            }

            await Promise.all(batchPromises);
            console.log(`Fetched ${venueMap.size} venues in ${Math.ceil(uniqueVenueSlugs.length / BATCH_SIZE)} concurrent batch(es)`);
        }

        // Second pass: build event objects with venue data from the map
        for (const { doc, rawData } of candidateDocs) {
            const eventData = {
                id: doc.id,
                name: rawData['Event Name'] || rawData.name,
                description: rawData['Description'] || rawData.description,
                date: rawData['Date'] || rawData.date,
                status: rawData.status,
                slug: rawData['Slug'] || rawData.slug,
                category: rawData['categories'] || rawData.category || [],
                venueId: rawData['venueId'] || rawData.venueId,
                venueName: rawData['Venue Name'] || rawData.venueName,
                venueSlug: rawData['Venue Slug'] || rawData.venueSlug,
                venue: rawData.venue,
                image: extractImageInfo(rawData),
                link: rawData['Link'] || rawData.link,
                ticketLink: rawData['Ticket Link'] || rawData.ticketLink,
                recurringInfo: rawData['Recurring Info'] || rawData.recurringInfo,
                series: rawData['Series ID'] || rawData.series,
                promotion: rawData.promotion || {},
                createdAt: rawData.createdAt,
                updatedAt: rawData.updatedAt,
                submittedBy: rawData['Submitter Email'] || rawData.submittedBy,
                approvedBy: rawData.approvedBy,
                approvedAt: rawData.approvedAt,
                cloudinaryPublicId: rawData.cloudinaryPublicId || rawData['Cloudinary Public ID'],
                promoImage: rawData.promoImage || rawData['Promo Image'],
                ageRestriction: rawData['Age Restriction'] || rawData.ageRestriction
            };

            // Convert venue object to venueName string for compatibility
            if (eventData.venue && eventData.venue.name && !eventData.venueName) {
                eventData.venueName = Array.isArray(eventData.venue.name) ? eventData.venue.name[0] : eventData.venue.name;
            }

            // Look up venue from the batch map
            const venueSlug = eventData.venueSlug;
            const venueData = venueSlug ? (venueMap.get(venueSlug) || null) : null;

            const processedEvent = await processEventForPublic(eventData, venueData);
            events.push(processedEvent);
        }

        console.log(`Processed ${events.length} events`);

        // Filter out adult events if includeAdult is false
        let filteredEvents = events;
        if (!filters.includeAdult) {
            filteredEvents = events.filter(ev => {
                let cats = [];
                if (Array.isArray(ev.category)) {
                    cats = ev.category;
                } else if (typeof ev.category === 'string') {
                    cats = ev.category.split(',').map(s => s.trim());
                }

                const isNSFW = cats.includes('Adult') || cats.includes('Kink') || ev.ageRestriction === '18+';
                return !isNSFW;
            });
        }

        // Sort events by date (client-side since we can't orderBy in Firestore yet)
        filteredEvents.sort((a, b) => {
            try {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);

                // Handle invalid dates
                if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
                if (isNaN(dateA.getTime())) return 1; // Invalid dates go to the end
                if (isNaN(dateB.getTime())) return -1;

                return dateA - dateB;
            } catch (error) {
                console.log('Error sorting events by date:', error);
                return 0; // Keep original order if sorting fails
            }
        });

        console.log(`Sorted ${filteredEvents.length} events by date`);

        // Group recurring events using the new manager
        const recurringManager = new RecurringEventsManager();
        const groupedEvents = recurringManager.groupRecurringEvents(filteredEvents);
        console.log(`Grouped ${filteredEvents.length} events into ${groupedEvents.length} display items`);

        // Apply pagination after date filtering and grouping
        const pagedGroupedEvents = groupedEvents.slice(filters.offset, filters.offset + filters.limit);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
            body: JSON.stringify({
                success: true,
                events: pagedGroupedEvents,
                totalCount: groupedEvents.length,
                hasMore: groupedEvents.length > filters.offset + filters.limit,
                filters: filters
            })
        };

    } catch (error) {
        console.error('Error fetching public events:', error);
        throw error;
    }
}

async function handleAdminView(queryParams) {
    const filters = {
        status: queryParams.status || 'all',
        limit: parseInt(queryParams.limit) || 100,
        offset: parseInt(queryParams.offset) || 0
    };

    console.log("Admin view filters:", filters);

    try {
        const eventsRef = db.collection('events');
        let query = eventsRef;

        // Apply status filtering
        if (filters.status !== 'all') {
            query = query.where('status', '==', filters.status);
        }

        // Order by creation date (newest first)
        query = query.orderBy('createdAt', 'desc');

        // Apply pagination (Firestore doesn't support offset, so we'll get all and slice)
        query = query.limit(filters.limit);

        const snapshot = await query.get();

        const events = [];
        snapshot.forEach(doc => {
            const eventData = {
                id: doc.id,
                ...doc.data()
            };
            events.push(processEventForAdmin(eventData));
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                events: events,
                totalCount: events.length,
                hasMore: events.length === filters.limit,
                filters: filters
            })
        };

    } catch (error) {
        console.error('Error fetching admin events:', error);
        throw error;
    }
}

function extractImageInfo(eventData, venueData = null) {
    // Check for standardized Cloudinary Public ID first (new field name)
    const cloudinaryId = eventData.cloudinaryPublicId || eventData['Cloudinary Public ID'];
    if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
        return {
            url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${cloudinaryId}`,
            alt: eventData['Event Name'] || eventData.name
        };
    }

    // Check for standardized promo image (new field name)
    const promoImage = eventData.promoImage || eventData['Promo Image'];
    if (promoImage) {
        let imageUrl = null;
        if (typeof promoImage === 'string') {
            imageUrl = promoImage;
        } else if (Array.isArray(promoImage) && promoImage.length > 0) {
            imageUrl = promoImage[0].url || promoImage[0];
        } else if (promoImage && typeof promoImage === 'object') {
            imageUrl = promoImage.url || promoImage[0]?.url;
        }

        if (imageUrl) {
            return {
                url: imageUrl,
                alt: eventData['Event Name'] || eventData.name
            };
        }
    }

    // Check for generic image field
    const image = eventData.image;
    if (image) {
        let imageUrl = null;
        if (typeof image === 'string') {
            imageUrl = image;
        } else if (Array.isArray(image) && image.length > 0) {
            imageUrl = image[0].url || image[0];
        } else if (image && typeof image === 'object') {
            imageUrl = image.url || image[0]?.url;
        }

        if (imageUrl) {
            return {
                url: imageUrl,
                alt: eventData['Event Name'] || eventData.name
            };
        }
    }

    // Fallback to venue image if available
    if (venueData && venueData.image && venueData.image.url) {
        return {
            url: venueData.image.url,
            alt: `${eventData['Event Name'] || eventData.name} at ${venueData.name}`
        };
    }

    return null;
}

async function handleVenuesView() {
    console.log("=== VENUES VIEW REQUESTED ===");

    try {
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.get();

        console.log(`Found ${snapshot.size} total venues in collection`);

        const venues = [];

        snapshot.forEach(doc => {
            const venueData = doc.data();

            // Process all venues - let processVenueForPublic handle image logic
            const processedVenue = processVenueForPublic({
                id: doc.id,
                ...venueData
            });

            // Only include venues that have some form of image (Cloudinary or will use placeholder)
            if (processedVenue.image || processedVenue.name) {
                venues.push(processedVenue);
            }
        });

        console.log(`Found ${venues.length} venues to display`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify({
                venues: venues,
                totalCount: venues.length,
                version: 'v4-cloudinary-only'
            })
        };

    } catch (error) {
        console.error('Error fetching venues:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Failed to fetch venues',
                message: error.message
            })
        };
    }
}

function processVenueForPublic(venueData) {
    // Extract image URL from various possible formats
    let imageUrl = null;

    // 1. First try Cloudinary public ID
    const cloudinaryId = venueData['Cloudinary Public ID'] || venueData['cloudinaryPublicId'];
    if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_800,h_400,c_fill/${cloudinaryId}`;
    } else {
        // 2. Try to find any image field that might contain a Cloudinary URL
        const possibleImageFields = ['image', 'Image', 'Photo', 'Photo URL', 'imageUrl'];
        for (const field of possibleImageFields) {
            const imageData = venueData[field];
            if (imageData) {
                // Check if it's already a Cloudinary URL
                if (typeof imageData === 'string' && imageData.includes('cloudinary.com')) {
                    imageUrl = imageData;
                    break;
                }
                // Check if it's an object with a Cloudinary URL
                if (imageData && typeof imageData === 'object' && imageData.url && imageData.url.includes('cloudinary.com')) {
                    imageUrl = imageData.url;
                    break;
                }
            }
        }

        // 3. If still no image, generate a consistent placeholder based on venue name
        if (!imageUrl) {
            const venueName = venueData.name || venueData['Venue Name'] || venueData['Name'] || 'Venue';
            const encodedName = encodeURIComponent(venueName);
            imageUrl = `https://placehold.co/800x400/1e1e1e/EAEAEA?text=${encodedName}`;
        }
    }
    const venue = {
        id: venueData.id,
        name: venueData.name || venueData['Venue Name'] || venueData['Name'],
        slug: venueData.slug || venueData['Venue Slug'] || venueData['Slug'],
        description: venueData.description || venueData['Description'] || `Venue hosting events`,
        address: venueData.address || venueData['Venue Address'] || venueData['Address'] || 'Address TBC',
        link: venueData.link || venueData['Venue Link'] || venueData['Link'],
        image: imageUrl ? { url: imageUrl } : null,
        category: venueData.category || venueData.tags || venueData['Tags'] || [],
        type: venueData.type || venueData['Type'] || 'venue',
        status: venueData.status || venueData['Status'] || venueData['Listing Status'] || 'Listed',
        openingHours: venueData.openingHours || venueData['Opening Hours'],
        popular: venueData.popular || venueData['Popular'] || false
    };
    if (!venue.category || venue.category.length === 0) {
        venue.category = ['LGBTQ+', 'Venue'];
    }
    return venue;
}

// This function is deprecated - using processVenueForPublic and processEventForPublic instead

async function processEventForPublic(eventData, venueData = null) {
    // Map Firestore field names to expected field names (same as service)
    const mappedData = {
        id: eventData.id,
        name: eventData['Event Name'] || eventData.name,
        slug: eventData['Slug'] || eventData.slug,
        description: eventData['Description'] || eventData.description,
        category: eventData['categories'] || eventData.category || [],
        date: eventData['Date'] || eventData.date,
        venueId: eventData['venueId'] || eventData.venueId,
        venueName: eventData['Venue Name'] || eventData.venueName || (eventData.venue && eventData.venue.name ? (Array.isArray(eventData.venue.name) ? eventData.venue.name[0] : eventData.venue.name) : null),
        venueSlug: eventData['Venue Slug'] || eventData.venueSlug,
        venueAddress: eventData['Venue Address'] || eventData.venueAddress,
        venueLink: eventData['Venue Link'] || eventData.venueLink,
        image: eventData['Promo Image'] || eventData.image, // Raw image data
        cloudinaryPublicId: eventData['Cloudinary Public ID'] || eventData.cloudinaryPublicId,
        price: eventData['Price'] || eventData.price,
        ageRestriction: eventData['Age Restriction'] || eventData.ageRestriction,
        link: eventData['Link'] || eventData.link,
        ticketLink: eventData['Ticket Link'] || eventData.ticketLink,
        seriesId: eventData['Series ID'] || eventData.seriesId,
        status: eventData.status,
        recurringInfo: eventData['Recurring Info'] || eventData.recurringInfo
    };
    // Extract image URL from various possible formats
    let imageUrl = null;

    // 1. First try Cloudinary public ID
    if (mappedData.cloudinaryPublicId && process.env.CLOUDINARY_CLOUD_NAME) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_800,h_400,c_fill/${mappedData.cloudinaryPublicId}`;
    } else {
        // 2. Try to find any image field that might contain a Cloudinary URL
        const possibleImageFields = ['Promo Image', 'image', 'Image'];
        for (const field of possibleImageFields) {
            const imageData = mappedData[field];
            if (imageData) {
                // Check if it's already a Cloudinary URL
                if (typeof imageData === 'string' && imageData.includes('cloudinary.com')) {
                    imageUrl = imageData;
                    break;
                }
                // Check if it's an object with a Cloudinary URL
                if (imageData && typeof imageData === 'object' && imageData.url && imageData.url.includes('cloudinary.com')) {
                    imageUrl = imageData.url;
                    break;
                }
            }
        }

        // 3. If still no image, try to get venue image as fallback
        if (!imageUrl && venueData && venueData.image && venueData.image.url) {
            imageUrl = venueData.image.url;
        }

        // 4. If still no image, generate a consistent placeholder based on event name
        if (!imageUrl) {
            const eventName = mappedData.name || 'Event';
            const encodedName = encodeURIComponent(eventName);
            imageUrl = `https://placehold.co/800x400/1e1e1e/EAEAEA?text=${encodedName}`;
        }
    }

    // Use passed venue data or fallback to event venue data
    let finalVenueData = venueData;

    if (!finalVenueData) {
        // Handle venue data - check for venue object first, then fallback to individual fields
        if (eventData.venue && eventData.venue.name && eventData.venue.slug) {
            // New format: venue object with arrays
            finalVenueData = {
                id: eventData.venue.id,
                name: Array.isArray(eventData.venue.name) ? eventData.venue.name[0] : eventData.venue.name,
                slug: Array.isArray(eventData.venue.slug) ? eventData.venue.slug[0] : eventData.venue.slug,
                address: eventData.venue.address || mappedData.venueAddress
            };
        } else if (mappedData.venueName && mappedData.venueSlug) {
            // Old format: individual venue fields
            finalVenueData = {
                id: mappedData.venueId,
                name: mappedData.venueName,
                slug: mappedData.venueSlug,
                address: mappedData.venueAddress
            };
        }
    }

    // Extract venue name for compatibility with live events page
    let venueName = null;
    if (finalVenueData && finalVenueData.name) {
        venueName = finalVenueData.name;
    } else if (mappedData.venueName) {
        venueName = Array.isArray(mappedData.venueName) ? mappedData.venueName[0] : mappedData.venueName;
    } else if (eventData.venue && eventData.venue.name) {
        venueName = Array.isArray(eventData.venue.name) ? eventData.venue.name[0] : eventData.venue.name;
    }

    return {
        id: mappedData.id,
        name: mappedData.name,
        slug: mappedData.slug,
        description: mappedData.description,
        date: mappedData.date,
        category: mappedData.category,
        venue: finalVenueData,
        venueName: venueName, // Add venueName for compatibility
        image: imageUrl ? { url: imageUrl } : null,
        price: mappedData.price,
        ageRestriction: mappedData.ageRestriction,
        link: mappedData.link || mappedData.ticketLink,
        recurringInfo: mappedData.recurringInfo,
        series: mappedData.seriesId ? { id: mappedData.seriesId, type: 'instance' } : null,
        promotion: {},
        status: mappedData.status
    };
}

function processEventForAdmin(eventData) {
    return {
        id: eventData.id,
        name: eventData.name,
        slug: eventData.slug,
        description: eventData.description,
        date: eventData.date,
        category: eventData.category || [],
        venue: {
            id: eventData.venueId,
            name: eventData.venueName,
            slug: eventData.venueSlug,
            address: eventData.venueAddress
        },
        image: eventData.image,
        price: eventData.price,
        ageRestriction: eventData.ageRestriction,
        link: eventData.link || eventData.ticketLink,
        recurringInfo: eventData.recurringInfo,
        series: eventData.series,
        promotion: eventData.promotion || {},
        status: eventData.status,
        createdAt: eventData.createdAt,
        updatedAt: eventData.updatedAt,
        submittedBy: eventData.submittedBy,
        approvedBy: eventData.approvedBy,
        approvedAt: eventData.approvedAt
    };
}

