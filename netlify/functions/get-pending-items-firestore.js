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
    console.log("get-pending-items-firestore function called");
    
    try {
        const queryParams = event.queryStringParameters || {};
        const type = queryParams.type || 'all'; // 'events', 'venues', or 'all'
        const limit = parseInt(queryParams.limit) || 50;
        const offset = parseInt(queryParams.offset) || 0;

        console.log(`Fetching pending items - type: ${type}, limit: ${limit}, offset: ${offset}`);

        let pendingItems = [];

        if (type === 'all' || type === 'events') {
            const pendingEvents = await getPendingEvents(limit, offset);
            pendingItems = pendingItems.concat(pendingEvents);
        }

        if (type === 'all' || type === 'venues') {
            const pendingVenues = await getPendingVenues(limit, offset);
            pendingItems = pendingItems.concat(pendingVenues);
        }

        // Sort by creation date (newest first)
        pendingItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply pagination
        const paginatedItems = pendingItems.slice(offset, offset + limit);

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
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .offset(offset)
            .get();

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

        return events;
        
    } catch (error) {
        console.error('Error fetching pending events:', error);
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