const admin = require('firebase-admin');

// Version: 2025-01-27-v1 - Firestore-based pending items function

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

exports.handler = async function (event, context) {
    console.log("🔍 PENDING ITEMS: Function called");
    console.log("📋 PENDING ITEMS: HTTP Method:", event.httpMethod);
    console.log("📋 PENDING ITEMS: Query params:", event.queryStringParameters);
    
    try {
        const queryParams = event.queryStringParameters || {};
        const type = queryParams.type || 'all'; // 'events', 'venues', or 'all'
        const limit = parseInt(queryParams.limit) || 50;
        const offset = parseInt(queryParams.offset) || 0;

        console.log(`🔍 PENDING ITEMS: Fetching pending items - type: ${type}, limit: ${limit}, offset: ${offset}`);

        let pendingItems = [];

        if (type === 'all' || type === 'events') {
            console.log("📅 PENDING ITEMS: Fetching pending events...");
            const pendingEvents = await getPendingEvents(limit, offset);
            console.log(`📅 PENDING ITEMS: Found ${pendingEvents.length} pending events`);
            pendingItems = pendingItems.concat(pendingEvents);
        }

        if (type === 'all' || type === 'venues') {
            console.log("🏢 PENDING ITEMS: Fetching pending venues...");
            const pendingVenues = await getPendingVenues(limit, offset);
            console.log(`🏢 PENDING ITEMS: Found ${pendingVenues.length} pending venues`);
            pendingItems = pendingItems.concat(pendingVenues);
        }

        console.log(`📊 PENDING ITEMS: Total items found: ${pendingItems.length}`);
        
        // Sort by creation date (newest first)
        pendingItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log("📊 PENDING ITEMS: Items sorted by creation date");

        // Apply pagination
        const paginatedItems = pendingItems.slice(offset, offset + limit);
        console.log(`📊 PENDING ITEMS: Paginated items: ${paginatedItems.length} (offset: ${offset}, limit: ${limit})`);

        console.log("✅ PENDING ITEMS: Returning response");
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                items: paginatedItems,
                totalCount: pendingItems.length,
                hasMore: paginatedItems.length === limit,
                filters: { type, limit, offset }
            })
        };

    } catch (error) {
        console.error('Error in get-pending-items-firestore:', error);
        
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

async function getPendingEvents(limit, offset) {
    try {
        console.log("🔍 GET PENDING EVENTS: Starting query");
        console.log("🔍 GET PENDING EVENTS: Query params - limit:", limit, "offset:", offset);
        
        const eventsRef = db.collection('events');
        console.log("🔍 GET PENDING EVENTS: Created events reference");
        
        // First, let's check if there are any events at all
        console.log("🔍 GET PENDING EVENTS: Checking total events count...");
        const allEventsSnapshot = await eventsRef.get();
        console.log("🔍 GET PENDING EVENTS: Total events in collection:", allEventsSnapshot.size);
        
        // Let's also check what statuses exist
        const statuses = new Set();
        allEventsSnapshot.forEach(doc => {
            const data = doc.data();
            statuses.add(data.status || 'no-status');
        });
        console.log("🔍 GET PENDING EVENTS: All statuses found:", Array.from(statuses));
        
        console.log("🔍 GET PENDING EVENTS: Executing Firestore query...");
        const snapshot = await eventsRef
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .offset(offset)
            .get();
        
        console.log("🔍 GET PENDING EVENTS: Query completed");
        console.log("🔍 GET PENDING EVENTS: Snapshot size:", snapshot.size);
        console.log("🔍 GET PENDING EVENTS: Snapshot empty:", snapshot.empty);

        const events = [];
        snapshot.forEach(doc => {
            const eventData = {
                id: doc.id,
                ...doc.data()
            };
            
            events.push({
                id: eventData.id,
                type: 'event',
                name: eventData.name,
                description: eventData.description,
                date: eventData.date,
                venue: {
                    id: eventData.venue?.id || eventData.venueId,
                    name: eventData.venue?.name || eventData.venueName,
                    address: eventData.venue?.address || eventData.venueAddress
                },
                category: eventData.category || [],
                image: eventData.image,
                price: eventData.price,
                ageRestriction: eventData.ageRestriction,
                link: eventData.link || eventData.ticketLink,
                recurringInfo: eventData.recurringInfo,
                series: eventData.series,
                status: eventData.status,
                createdAt: eventData.createdAt,
                updatedAt: eventData.updatedAt,
                submittedBy: eventData.submittedBy,
                submittedAt: eventData.submittedAt,
                notes: eventData.notes || ''
            });
        });

        console.log("🔍 GET PENDING EVENTS: Processed", events.length, "events");
        console.log("🔍 GET PENDING EVENTS: Event IDs:", events.map(e => e.id));
        
        return events;
        
    } catch (error) {
        console.error('❌ GET PENDING EVENTS: Error fetching pending events:', error);
        console.error('❌ GET PENDING EVENTS: Error message:', error.message);
        console.error('❌ GET PENDING EVENTS: Error stack:', error.stack);
        return [];
    }
}

async function getPendingVenues(limit, offset) {
    try {
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .offset(offset)
            .get();

        const venues = [];
        snapshot.forEach(doc => {
            const venueData = {
                id: doc.id,
                ...doc.data()
            };
            
            venues.push({
                id: venueData.id,
                type: 'venue',
                name: venueData.name,
                description: venueData.description,
                address: venueData.address,
                link: venueData.link,
                image: venueData.image,
                category: venueData.category || [],
                openingHours: venueData.openingHours,
                status: venueData.status,
                createdAt: venueData.createdAt,
                updatedAt: venueData.updatedAt,
                submittedBy: venueData.submittedBy,
                submittedAt: venueData.submittedAt,
                notes: venueData.notes || ''
            });
        });

        return venues;
        
    } catch (error) {
        console.error('Error fetching pending venues:', error);
        return [];
    }
}