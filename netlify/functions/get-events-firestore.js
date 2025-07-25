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
        
        // For now, just get approved events ordered by date
        // This will trigger the basic index creation link
        query = query.orderBy('Date', 'asc');
        
        // Note: We'll add filtering back once the basic index is created
        // The error messages will guide us to create the right indexes

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
                image: rawData['Promo Image'] || rawData.image,
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
            
            console.log(`Processing event: ${eventData.name} (status: ${eventData.status})`);
            
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
    console.log("Venues view requested");

    try {
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.where('status', '==', 'approved').get();
        
        const venues = [];
        snapshot.forEach(doc => {
            const venueData = {
                id: doc.id,
                ...doc.data()
            };
            venues.push(processVenueForPublic(venueData));
        });

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

function processEventForPublic(eventData) {
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
        status: eventData.status
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
    return {
        id: venueData.id,
        name: venueData.name,
        slug: venueData.slug,
        description: venueData.description,
        address: venueData.address,
        link: venueData.link,
        image: venueData.image,
        category: venueData.category || [],
        openingHours: venueData.openingHours,
        status: venueData.status
    };
}