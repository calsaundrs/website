const FirestoreEventService = require('./services/firestore-event-service');
const admin = require('firebase-admin');

// Version: 2025-01-27-v1 - Firestore-based events listing function

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();
const eventService = new FirestoreEventService();

exports.handler = async function (event, context) {
    console.log("get-events-firestore function called");
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
        console.error('Error in get-events-firestore:', error);
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
        offset: parseInt(queryParams.offset) || 0
    };

    console.log("Public view filters:", filters);

            try {
            const eventsRef = db.collection('events');
            let query = eventsRef.where('Status', '==', 'Approved');

        // Start with a simple query that will work immediately
        // This will generate index creation links for more complex queries
        console.log("Using basic query to generate index links");
        
        // For now, get approved events without ordering to avoid index requirements
        // We'll add ordering back once the basic index is created
        console.log("Using simple query without ordering to avoid index requirements");

        // Apply pagination
        query = query.limit(filters.limit).offset(filters.offset);

        console.log("Executing Firestore query...");
        const snapshot = await query.get();
        console.log(`Query returned ${snapshot.size} documents`);
        
        const events = [];
        let processedCount = 0;
        let skippedCount = 0;
        
        snapshot.forEach(doc => {
            const rawData = doc.data();
            
            // Map Firestore field names to expected field names
            const eventData = {
                id: doc.id,
                name: rawData['Event Name'] || rawData.name,
                description: rawData['Description'] || rawData.description,
                date: rawData['Date'] || rawData.date,
                status: rawData['Status'] || rawData.status,
                slug: rawData['Slug'] || rawData.slug,
                category: rawData['categories'] || rawData.category || [],
                venueId: rawData['venueId'] || rawData.venueId,
                venueName: rawData['Venue Name'] || rawData.venueName,
                venueSlug: rawData['Venue Slug'] || rawData.venueSlug,
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
                approvedAt: rawData.approvedAt
            };
            
            console.log(`Processing event: ${eventData.name} (status: ${eventData.status}, date: ${eventData.date}, image: ${JSON.stringify(eventData.image)})`);
            
            // Apply date filtering client-side
            if (eventData.date) {
                const eventDate = new Date(eventData.date);
                const now = new Date();
                
                console.log(`Date comparison for ${eventData.name}: eventDate=${eventDate.toISOString()}, now=${now.toISOString()}, isPast=${eventDate < now}`);
                
                // Filter out past events (events before today)
                if (eventDate < now) {
                    console.log(`Skipping past event ${eventData.name} (date: ${eventDate.toISOString()})`);
                    skippedCount++;
                    return; // Skip this event
                }
            }
            
            // Apply search filtering client-side (Firestore doesn't support full-text search)
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const nameMatch = eventData.name && eventData.name.toLowerCase().includes(searchLower);
                const descMatch = eventData.description && eventData.description.toLowerCase().includes(searchLower);
                if (!nameMatch && !descMatch) {
                    console.log(`Skipping event ${eventData.name} due to search filter`);
                    skippedCount++;
                    return; // Skip this event
                }
            }
            
            const processedEvent = processEventForPublic(eventData);
            events.push(processedEvent);
            processedCount++;
        });
        
        console.log(`Processed ${processedCount} events, skipped ${skippedCount} events`);

        // Sort events by date (client-side since we can't orderBy in Firestore yet)
        events.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA - dateB;
        });

        console.log(`Sorted ${events.length} events by date`);

        // Get total count for pagination
        console.log("Getting total count...");
        const countQuery = eventsRef.where('Status', '==', 'Approved');
        const countSnapshot = await countQuery.get();
        const totalCount = countSnapshot.size;
        console.log(`Total count: ${totalCount}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
            body: JSON.stringify({
                events: events,
                totalCount: totalCount,
                hasMore: events.length === filters.limit,
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

        // Apply pagination
        query = query.limit(filters.limit).offset(filters.offset);

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

async function handleVenuesView() {
    console.log("=== VENUES VIEW REQUESTED ===");

    try {
        let venues = [];
        
        // First, try to get venues from the venues collection with Listing Status = Listed
        try {
            console.log("Attempting to fetch from venues collection with Listing Status = Listed...");
            const venuesRef = db.collection('venues');
            
            // First, get all venues to see what fields exist
            console.log("Getting all venues to inspect field names...");
            const allVenuesSnapshot = await venuesRef.limit(5).get();
            console.log(`Found ${allVenuesSnapshot.size} venues in collection`);
            
            if (allVenuesSnapshot.size > 0) {
                const sampleVenue = allVenuesSnapshot.docs[0].data();
                console.log("Sample venue fields:", Object.keys(sampleVenue));
                console.log("Sample venue data:", sampleVenue);
                
                // Look for listing status field
                const possibleStatusFields = ['Listing Status', 'listingStatus', 'Status', 'status', 'ListingStatus'];
                let foundStatusField = null;
                let foundStatusValue = null;
                
                for (const field of possibleStatusFields) {
                    if (sampleVenue[field] !== undefined) {
                        foundStatusField = field;
                        foundStatusValue = sampleVenue[field];
                        console.log(`Found status field: "${field}" with value: "${foundStatusValue}"`);
                        break;
                    }
                }
                
                if (foundStatusField) {
                    // Query using the found field name
                    console.log(`Querying venues with "${foundStatusField}" = "Listed"...`);
                    const venuesSnapshot = await venuesRef.where(foundStatusField, '==', 'Listed').get();
                    console.log(`Found ${venuesSnapshot.size} venues with "${foundStatusField}" = "Listed"`);
                    
                    venuesSnapshot.forEach(doc => {
                        const venueData = doc.data();
                        venues.push(processVenueForPublic({
                            id: doc.id,
                            ...venueData
                        }));
                    });
                } else {
                    console.log("No status field found in venue data");
                }
            }
            
            console.log(`Total venues found: ${venues.length}`);
            
        } catch (venuesError) {
            console.log('Error accessing venues collection:', venuesError.message);
            console.log('Error stack:', venuesError.stack);
        }
        
        // If no venues found, try to extract venue information from events
        if (venues.length === 0) {
            console.log("No venues found in venues collection, extracting from events...");
            
            const eventsRef = db.collection('events');
            const eventsSnapshot = await eventsRef.where('Status', '==', 'Approved').get();
            
            console.log(`Found ${eventsSnapshot.size} approved events to extract venues from`);
            
            const venueMap = new Map();
            let processedCount = 0;
            let venueFoundCount = 0;
            
            eventsSnapshot.forEach(doc => {
                const rawEventData = doc.data();
                processedCount++;
                
                // Debug: Log the first few events to see the structure
                if (processedCount <= 3) {
                    console.log(`Event ${processedCount} raw data:`, {
                        id: doc.id,
                        eventName: rawEventData['Event Name'],
                        venueName: rawEventData['Venue Name'],
                        venueSlug: rawEventData['Venue Slug'],
                        venue: rawEventData.venue
                    });
                }
                
                // Process the event data to get the standardized venue structure
                const eventData = {
                    id: doc.id,
                    ...rawEventData
                };
                
                // Use the same processing logic as processEventForPublic
                const processedEvent = processEventForPublic(eventData);
                
                // Debug: Log the processed event venue data
                if (processedCount <= 3) {
                    console.log(`Event ${processedCount} processed venue:`, processedEvent.venue);
                }
                
                // Extract venue information from processed event
                if (processedEvent.venue && processedEvent.venue.name && processedEvent.venue.slug) {
                    // Handle both string and array formats for venue name and slug
                    const venueName = Array.isArray(processedEvent.venue.name) ? processedEvent.venue.name[0] : processedEvent.venue.name;
                    const venueSlug = Array.isArray(processedEvent.venue.slug) ? processedEvent.venue.slug[0] : processedEvent.venue.slug;
                    const venueKey = venueSlug;
                    
                    if (venueName && venueSlug && !venueMap.has(venueKey)) {
                        venueFoundCount++;
                        venueMap.set(venueKey, {
                            id: processedEvent.venue.id || venueKey,
                            name: venueName,
                            slug: venueSlug,
                            description: `Venue hosting ${processedEvent.name || 'events'}`,
                            address: processedEvent.venue.address || 'Address TBC',
                            type: 'venue',
                            status: 'Approved',
                            image: processedEvent.image
                        });
                    }
                }
            });
            
            venues = Array.from(venueMap.values());
            console.log(`Processed ${processedCount} events, found ${venueFoundCount} venues, extracted ${venues.length} unique venues from events`);
        }

        console.log(`=== VENUES FUNCTION COMPLETE ===`);
        console.log(`Returning ${venues.length} venues`);
        console.log(`Venues:`, venues.map(v => ({ id: v.id, name: v.name, slug: v.slug })));
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=600' // Cache for 10 minutes
            },
            body: JSON.stringify({
                venues: venues,
                totalCount: venues.length
            })
        };
        
    } catch (error) {
        console.error('Error fetching venues:', error);
        throw error;
    }
}

// Extract image information from Firestore data
function extractImageInfo(fields) {
    const cloudinaryId = fields['Cloudinary Public ID'];
    const promoImage = fields['Promo Image'];
    
    if (cloudinaryId) {
        return {
            url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${cloudinaryId}`,
            alt: fields['Event Name']
        };
    } else if (promoImage) {
        // Handle both string URLs and array objects
        const imageUrl = typeof promoImage === 'string' ? promoImage : 
                        (promoImage.url || promoImage[0]?.url);
        
        if (imageUrl) {
            return {
                url: imageUrl,
                alt: fields['Event Name']
            };
        }
    }
    
    return null;
}

function processEventForPublic(eventData) {
    // Map Firestore field names to expected field names (same as service)
    const mappedData = {
        id: eventData.id,
        name: eventData['Event Name'] || eventData.name,
        slug: eventData['Slug'] || eventData.slug,
        description: eventData['Description'] || eventData.description,
        category: eventData['categories'] || eventData.category || [],
        date: eventData['Date'] || eventData.date,
        venueId: eventData['venueId'] || eventData.venueId,
        venueName: eventData['Venue Name'] || eventData.venueName,
        venueSlug: eventData['Venue Slug'] || eventData.venueSlug,
        venueAddress: eventData['Venue Address'] || eventData.venueAddress,
        venueLink: eventData['Venue Link'] || eventData.venueLink,
        image: eventData['Promo Image'] || eventData.image,
        cloudinaryPublicId: eventData['Cloudinary Public ID'] || eventData.cloudinaryPublicId,
        price: eventData['Price'] || eventData.price,
        ageRestriction: eventData['Age Restriction'] || eventData.ageRestriction,
        link: eventData['Link'] || eventData.link,
        ticketLink: eventData['Ticket Link'] || eventData.ticketLink,
        seriesId: eventData['Series ID'] || eventData.seriesId,
        status: eventData['Status'] || eventData.status,
        recurringInfo: eventData['Recurring Info'] || eventData.recurringInfo
    };

    // Handle venue data - check for venue object first, then fallback to individual fields
    let venueData = null;
    
    if (eventData.venue && eventData.venue.name && eventData.venue.slug) {
        // New format: venue object with arrays
        venueData = {
            id: eventData.venue.id,
            name: Array.isArray(eventData.venue.name) ? eventData.venue.name[0] : eventData.venue.name,
            slug: Array.isArray(eventData.venue.slug) ? eventData.venue.slug[0] : eventData.venue.slug,
            address: eventData.venue.address || mappedData.venueAddress
        };
    } else if (mappedData.venueName && mappedData.venueSlug) {
        // Old format: individual venue fields
        venueData = {
            id: mappedData.venueId,
            name: mappedData.venueName,
            slug: mappedData.venueSlug,
            address: mappedData.venueAddress
        };
    }

    return {
        id: mappedData.id,
        name: mappedData.name,
        slug: mappedData.slug,
        description: mappedData.description,
        date: mappedData.date,
        category: mappedData.category,
        venue: venueData,
        image: extractImageInfo(mappedData),
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

function processVenueForPublic(venueData) {
    // Handle venue data from venues collection
    const venue = {
        id: venueData.id,
        name: venueData.name || venueData['Venue Name'] || venueData['Name'],
        slug: venueData.slug || venueData['Venue Slug'] || venueData['Slug'],
        description: venueData.description || venueData['Description'] || `Venue hosting events`,
        address: venueData.address || venueData['Venue Address'] || venueData['Address'] || 'Address TBC',
        link: venueData.link || venueData['Venue Link'] || venueData['Link'],
        image: venueData.image || venueData['Image'],
        category: venueData.category || venueData.tags || venueData['Tags'] || [],
        type: venueData.type || venueData['Type'] || 'venue',
        status: venueData.status || venueData['Status'] || venueData['Listing Status'] || 'Listed',
        openingHours: venueData.openingHours || venueData['Opening Hours'],
        popular: venueData.popular || venueData['Popular'] || false
    };
    
    // Add some default tags based on venue type if none exist
    if (!venue.category || venue.category.length === 0) {
        venue.category = ['LGBTQ+', 'Venue'];
    }
    
    return venue;
}