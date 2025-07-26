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
    console.log("test-venues-extraction function called");
    
    try {
        const eventsRef = db.collection('events');
        const eventsSnapshot = await eventsRef.where('Status', '==', 'Approved').limit(5).get();
        
        console.log(`Found ${eventsSnapshot.size} approved events`);
        
        const results = [];
        
        eventsSnapshot.forEach(doc => {
            const rawEventData = doc.data();
            
            // Test the mapping logic
            const mappedData = {
                id: doc.id,
                name: rawEventData['Event Name'] || rawEventData.name,
                slug: rawEventData['Slug'] || rawEventData.slug,
                venueId: rawEventData['venueId'] || rawEventData.venueId,
                venueName: rawEventData['Venue Name'] || rawEventData.venueName,
                venueSlug: rawEventData['Venue Slug'] || rawEventData.venueSlug,
                venueAddress: rawEventData['Venue Address'] || rawEventData.venueAddress
            };
            
            results.push({
                id: doc.id,
                rawVenueData: {
                    venueId: rawEventData['venueId'],
                    venueName: rawEventData['Venue Name'],
                    venueSlug: rawEventData['Venue Slug'],
                    venueAddress: rawEventData['Venue Address']
                },
                mappedVenueData: {
                    venueId: mappedData.venueId,
                    venueName: mappedData.venueName,
                    venueSlug: mappedData.venueSlug,
                    venueAddress: mappedData.venueAddress
                },
                hasVenue: !!(mappedData.venueName && mappedData.venueSlug)
            });
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                message: "Venue extraction test complete",
                totalEvents: eventsSnapshot.size,
                eventsWithVenues: results.filter(r => r.hasVenue).length,
                results: results
            })
        };
        
    } catch (error) {
        console.error('Error testing venue extraction:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    }
};