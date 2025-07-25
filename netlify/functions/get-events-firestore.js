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
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
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
        let query = eventsRef.where('status', '==', 'approved');

        // For now, let's use a simpler approach to avoid complex indexes
        // We'll get all approved events and filter client-side
        // This is a temporary solution until we set up proper indexes
        
        console.log("Using simplified query to avoid index requirements");
        
        // Get all approved events (simple query)
        query = query.orderBy('date', 'asc');
        
        // Apply pagination
        query = query.limit(filters.limit).offset(filters.offset);

        const snapshot = await query.get();
        
        const events = [];
        snapshot.forEach(doc => {
            const eventData = {
                id: doc.id,
                ...doc.data()
            };
            
            // Apply all filters client-side
            let shouldInclude = true;
            
            // Apply date filtering
            if (filters.dateRange.type === 'upcoming') {
                const now = new Date();
                if (new Date(eventData.date) < now) {
                    shouldInclude = false;
                }
            } else if (filters.dateRange.type === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const eventDate = new Date(eventData.date);
                if (eventDate < today || eventDate >= tomorrow) {
                    shouldInclude = false;
                }
            } else if (filters.dateRange.type === 'week') {
                const now = new Date();
                const weekFromNow = new Date(now);
                weekFromNow.setDate(weekFromNow.getDate() + 7);
                const eventDate = new Date(eventData.date);
                if (eventDate < now || eventDate > weekFromNow) {
                    shouldInclude = false;
                }
            }
            
            // Apply category filtering
            if (shouldInclude && filters.categories.length > 0) {
                const eventCategories = eventData.category || [];
                const hasMatchingCategory = filters.categories.some(cat => 
                    eventCategories.includes(cat)
                );
                if (!hasMatchingCategory) {
                    shouldInclude = false;
                }
            }
            
            // Apply venue filtering
            if (shouldInclude && filters.venues.length > 0) {
                const eventVenueId = eventData.venueId || eventData.venue?.id;
                if (!eventVenueId || !filters.venues.includes(eventVenueId)) {
                    shouldInclude = false;
                }
            }
            
            // Apply search filtering
            if (shouldInclude && filters.search) {
                const searchLower = filters.search.toLowerCase();
                const nameMatch = eventData.name && eventData.name.toLowerCase().includes(searchLower);
                const descMatch = eventData.description && eventData.description.toLowerCase().includes(searchLower);
                if (!nameMatch && !descMatch) {
                    shouldInclude = false;
                }
            }
            
            if (shouldInclude) {
                events.push(processEventForPublic(eventData));
            }
        });

        // Since we're filtering client-side, we need to get all events for accurate count
        // This is a temporary solution - in production, we should set up proper indexes
        const countQuery = eventsRef.where('status', '==', 'approved');
        const countSnapshot = await countQuery.get();
        const allEvents = [];
        countSnapshot.forEach(doc => {
            const eventData = { id: doc.id, ...doc.data() };
            
            // Apply the same filtering logic for count
            let shouldInclude = true;
            
            if (filters.dateRange.type === 'upcoming') {
                const now = new Date();
                if (new Date(eventData.date) < now) shouldInclude = false;
            } else if (filters.dateRange.type === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const eventDate = new Date(eventData.date);
                if (eventDate < today || eventDate >= tomorrow) shouldInclude = false;
            } else if (filters.dateRange.type === 'week') {
                const now = new Date();
                const weekFromNow = new Date(now);
                weekFromNow.setDate(weekFromNow.getDate() + 7);
                const eventDate = new Date(eventData.date);
                if (eventDate < now || eventDate > weekFromNow) shouldInclude = false;
            }
            
            if (shouldInclude && filters.categories.length > 0) {
                const eventCategories = eventData.category || [];
                const hasMatchingCategory = filters.categories.some(cat => 
                    eventCategories.includes(cat)
                );
                if (!hasMatchingCategory) shouldInclude = false;
            }
            
            if (shouldInclude && filters.venues.length > 0) {
                const eventVenueId = eventData.venueId || eventData.venue?.id;
                if (!eventVenueId || !filters.venues.includes(eventVenueId)) shouldInclude = false;
            }
            
            if (shouldInclude && filters.search) {
                const searchLower = filters.search.toLowerCase();
                const nameMatch = eventData.name && eventData.name.toLowerCase().includes(searchLower);
                const descMatch = eventData.description && eventData.description.toLowerCase().includes(searchLower);
                if (!nameMatch && !descMatch) shouldInclude = false;
            }
            
            if (shouldInclude) {
                allEvents.push(eventData);
            }
        });
        
        const totalCount = allEvents.length;

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
            id: eventData.venue?.id || eventData.venueId,
            name: eventData.venue?.name || eventData.venueName,
            address: eventData.venue?.address || eventData.venueAddress
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
            id: eventData.venue?.id || eventData.venueId,
            name: eventData.venue?.name || eventData.venueName,
            address: eventData.venue?.address || eventData.venueAddress
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