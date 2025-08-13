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
        
        // Primary query: status in common pending variants
        console.log("🔍 GET PENDING EVENTS: Querying status 'in' for pending variants...");
        let pendingDocs = [];
        try {
            const statusVariants = ['pending', 'Pending', 'pending review', 'Pending Review'];
            const inSnapshot = await eventsRef
                .where('status', 'in', statusVariants)
                .limit(100)
                .get();
            console.log("🔍 GET PENDING EVENTS: 'in' query found:", inSnapshot.size);
            inSnapshot.forEach(doc => pendingDocs.push(doc));
        } catch (inError) {
            console.log('ℹ️ GET PENDING EVENTS: status "in" query not supported or failed, falling back to separate queries:', inError.message);
            const pendingSnapshot = await eventsRef.where('status', '==', 'pending').limit(50).get();
            const pendingReviewSnapshot = await eventsRef.where('status', '==', 'pending review').limit(50).get();
            console.log("🔍 GET PENDING EVENTS: 'pending' query found:", pendingSnapshot.size);
            console.log("🔍 GET PENDING EVENTS: 'pending review' query found:", pendingReviewSnapshot.size);
            pendingSnapshot.forEach(doc => pendingDocs.push(doc));
            pendingReviewSnapshot.forEach(doc => pendingDocs.push(doc));
        }

        // Fallback: If still empty, pull recent and filter in memory
        if (pendingDocs.length === 0) {
            console.log('🔍 GET PENDING EVENTS: No pending found; fetching recent for in-memory filter...');
            const recentSnapshot = await eventsRef
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            console.log('🔍 GET PENDING EVENTS: Recent events found:', recentSnapshot.size);
            
            // Log all statuses for debugging
            const statuses = {};
            recentSnapshot.forEach(doc => {
                const d = doc.data() || {};
                const status = String(d.status || 'no-status');
                statuses[status] = (statuses[status] || 0) + 1;
                
                if (!status || status === 'pending' || status === 'pending review' || status === 'submitted') {
                    pendingDocs.push(doc);
                }
            });
            console.log('🔍 GET PENDING EVENTS: Status breakdown:', statuses);
            console.log('🔍 GET PENDING EVENTS: Fallback produced pendingDocs:', pendingDocs.length);
        }
        
        console.log("🔍 GET PENDING EVENTS: Total pending events:", pendingDocs.length);
        
        // Sort by creation date (newest first)
        pendingDocs.sort((a, b) => {
            const dateA = a.data().createdAt;
            const dateB = b.data().createdAt;
            
            // Handle Firestore timestamp objects
            if (dateA && dateA._seconds) {
                const timeA = dateA._seconds * 1000 + (dateA._nanoseconds || 0) / 1000000;
                const timeB = dateB._seconds * 1000 + (dateB._nanoseconds || 0) / 1000000;
                return timeB - timeA;
            }
            
            // Handle regular Date objects or strings
            const timeA = new Date(dateA).getTime();
            const timeB = new Date(dateB).getTime();
            return timeB - timeA;
        });
        
        // Apply pagination
        const paginatedDocs = pendingDocs.slice(offset, offset + limit);
        console.log("🔍 GET PENDING EVENTS: Paginated results:", paginatedDocs.length);
        console.log("🔍 GET PENDING EVENTS: First few docs:", paginatedDocs.slice(0, 3).map(doc => ({
            id: doc.id,
            name: doc.data().name,
            status: doc.data().status,
            createdAt: doc.data().createdAt
        })));
        
        const snapshot = {
            size: paginatedDocs.length,
            empty: paginatedDocs.length === 0,
            forEach: (callback) => paginatedDocs.forEach(callback)
        };
        
        console.log("🔍 GET PENDING EVENTS: Query completed");
        console.log("🔍 GET PENDING EVENTS: Snapshot size:", snapshot.size);
        console.log("🔍 GET PENDING EVENTS: Snapshot empty:", snapshot.empty);

        const events = [];
        const now = new Date();
        
        snapshot.forEach(doc => {
            const eventData = {
                id: doc.id,
                ...doc.data()
            };
            
            // Check if this is a past event
            const eventDate = eventData.date ? new Date(eventData.date) : null;
            const isPastEvent = eventDate && eventDate < now;
            
            // Check if this is a recurring event
            const isRecurring = eventData.recurringInfo || eventData.series || eventData.isRecurring;
            
            // Include past events for admin review; mark flag for UI
            if (isPastEvent && !isRecurring) {
                console.log(`⏰ PAST EVENT (included for review): ${eventData.name} (${eventData.id}) - Date: ${eventDate}`);
            }
            
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
                category: Array.isArray(eventData.category) ? eventData.category : (eventData.categoryIds || []),
                image: eventData.image || (eventData.promoImage ? (typeof eventData.promoImage === 'string' ? { url: eventData.promoImage } : eventData.promoImage) : null),
                price: eventData.price,
                ageRestriction: eventData.ageRestriction,
                link: eventData.link || eventData.ticketLink,
                recurringInfo: eventData.recurringInfo,
                series: eventData.series,
                status: eventData.status,
                createdAt: eventData.createdAt || eventData.submittedAt || new Date(),
                updatedAt: eventData.updatedAt,
                submittedBy: eventData.submittedBy,
                submittedAt: eventData.submittedAt,
                notes: eventData.notes || '',
                isPastEvent: isPastEvent,
                isRecurring: isRecurring
            });
        });

        console.log("🔍 GET PENDING EVENTS: Processed", events.length, "events");
        console.log("🔍 GET PENDING EVENTS: Event IDs:", events.map(e => e.id));
        
        return events;
        
    } catch (error) {
        console.error('❌ GET PENDING EVENTS: Error fetching pending events:', error);
        console.error('❌ GET PENDING EVENTS: Error message:', error.message);
        console.error('❌ GET PENDING EVENTS: Error stack:', error.stack);
        
        // Return empty array but log the error
        console.error('❌ GET PENDING EVENTS: Returning empty array due to error');
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