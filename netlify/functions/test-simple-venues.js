const admin = require('firebase-admin');

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
    console.log("test-simple-venues function called");
    
    try {
        // Simple test: get one event and extract venue info
        const eventsRef = db.collection('events');
        const eventsSnapshot = await eventsRef.where('Status', '==', 'Approved').limit(1).get();
        
        console.log(`Found ${eventsSnapshot.size} approved events`);
        
        if (eventsSnapshot.empty) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "No events found", venues: [] })
            };
        }
        
        const doc = eventsSnapshot.docs[0];
        const eventData = doc.data();
        
        console.log("Event data:", {
            id: doc.id,
            eventName: eventData['Event Name'],
            venueName: eventData['Venue Name'],
            venueSlug: eventData['Venue Slug'],
            venue: eventData.venue
        });
        
        // Try to extract venue info
        let venueInfo = null;
        
        if (eventData.venue && eventData.venue.name && eventData.venue.slug) {
            venueInfo = {
                id: eventData.venue.id,
                name: Array.isArray(eventData.venue.name) ? eventData.venue.name[0] : eventData.venue.name,
                slug: Array.isArray(eventData.venue.slug) ? eventData.venue.slug[0] : eventData.venue.slug
            };
        } else if (eventData['Venue Name'] && eventData['Venue Slug']) {
            venueInfo = {
                id: eventData['venueId'] || eventData['Venue Slug'],
                name: eventData['Venue Name'],
                slug: eventData['Venue Slug']
            };
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Test complete",
                eventFound: true,
                venueInfo: venueInfo,
                rawVenueData: {
                    venue: eventData.venue,
                    venueName: eventData['Venue Name'],
                    venueSlug: eventData['Venue Slug']
                }
            })
        };
        
    } catch (error) {
        console.error('Error in test-simple-venues:', error);
        
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: error.message,
                stack: error.stack
            })
        };
    }
};