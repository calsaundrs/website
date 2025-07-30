const admin = require('firebase-admin');

let firebaseInitialized = false;
let db = null;

try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        try {
            admin.app();
            firebaseInitialized = true;
        } catch (error) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
            firebaseInitialized = true;
        }
        
        db = admin.firestore();
        console.log('Firebase initialized successfully');
    } else {
        console.log('Firebase environment variables not set');
    }
} catch (error) {
    console.error('Error initializing Firebase:', error);
}

exports.handler = async function(event, context) {
    console.log('Debug Event Data: Starting function');
    
    if (!firebaseInitialized || !db) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Firebase not initialized' })
        };
    }
    
    try {
        // Get a few events to see their structure
        const eventsRef = db.collection('events');
        
        // Fetch events with lowercase 'approved'
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .limit(10)
            .get();

        // Fetch events with uppercase 'Approved'
        const snapshotUppercase = await eventsRef
            .where('Status', '==', 'Approved')
            .limit(10)
            .get();
        
        console.log(`Found ${snapshot.size} events with lowercase 'approved'`);
        console.log(`Found ${snapshotUppercase.size} events with uppercase 'Approved'`);
        
        const events = [];
        const processedIds = new Set();

        const processSnapshot = (snap) => {
            snap.forEach(function(doc) {
                if (processedIds.has(doc.id)) return;

                const data = doc.data();
                console.log('Raw event data for', doc.id, ':', JSON.stringify(data, null, 2));
                
                // Test the processEventForPublic function
                const processedEvent = processEventForPublic(data, doc.id);
                console.log('Processed event for', doc.id, ':', JSON.stringify(processedEvent, null, 2));
                
                events.push({
                    id: doc.id,
                    raw: data,
                    processed: processedEvent
                });
                processedIds.add(doc.id);
            });
        };

        processSnapshot(snapshot);
        processSnapshot(snapshotUppercase);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                events: events
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: error.message,
                stack: error.stack
            })
        };
    }
};

function processEventForPublic(eventData, eventId) {
    // Use standardized field names - no more legacy mapping
    const eventName = eventData.name || 'Unnamed Event';
    const eventSlug = eventData.slug || '';
    const eventDescription = eventData.description || '';
    const eventDate = eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : null;
    
    // Extract image URL using standardized fields
    let imageUrl = null;
    if (eventData.cloudinaryPublicId) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${eventData.cloudinaryPublicId}`;
    } else if (eventData.promoImage) {
        imageUrl = typeof eventData.promoImage === 'string' ? eventData.promoImage : 
                  (eventData.promoImage.url || eventData.promoImage[0]?.url);
    } else if (eventData.image) {
        imageUrl = typeof eventData.image === 'string' ? eventData.image : 
                  (eventData.image.url || eventData.image[0]?.url);
    }
    
    // Extract venue data using standardized fields
    let venueData = {
        id: '',
        name: 'Venue TBC',
        slug: ''
    };
    
    if (eventData.venueId) {
        venueData = {
            id: eventData.venueId,
            name: eventData.venueName || 'Venue TBC',
            slug: eventData.venueSlug || ''
        };
    } else if (eventData.venue) {
        venueData = {
            id: eventData.venue.id || '',
            name: eventData.venue.name || 'Venue TBC',
            slug: eventData.venue.slug || ''
        };
    }
    
    const event = {
        id: eventId,
        name: eventName,
        slug: eventSlug,
        description: eventDescription,
        date: eventDate,
        venue: venueData,
        image: imageUrl ? { url: imageUrl } : null,
        category: eventData.category || [],
        price: eventData.price || null,
        ageRestriction: eventData.ageRestriction || null,
        organizer: eventData.organizer || null,
        accessibility: eventData.accessibility || null,
        ticketLink: eventData.ticketLink || null,
        eventLink: eventData.eventLink || null,
        facebookEvent: eventData.facebookEvent || null,
        recurringInfo: eventData.recurringInfo || null,
        boostedListingStartDate: eventData.boostedListingStartDate || null,
        boostedListingEndDate: eventData.boostedListingEndDate || null,
        otherInstances: [] // Will be populated for recurring events
    };
    
    if (!event.category || event.category.length === 0) {
        event.category = ['Event'];
    }
    
    return event;
} 