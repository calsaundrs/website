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
    try {
        console.log("debug-sitemap-data function called");
        
        const results = {
            events: {
                total: 0,
                approved: 0,
                withSlugs: 0,
                sample: []
            },
            venues: {
                total: 0,
                withSlugs: 0,
                withValidImages: 0,
                sample: []
            }
        };

        // Check events
        try {
            console.log("Fetching events...");
            const eventsRef = db.collection('events');
            const eventSnapshot = await eventsRef.limit(100).get();
            
            results.events.total = eventSnapshot.size;
            console.log(`Found ${eventSnapshot.size} events`);
            
            eventSnapshot.forEach(doc => {
                const eventData = doc.data();
                
                if (eventData.status === 'approved') {
                    results.events.approved++;
                }
                
                if (eventData.slug) {
                    results.events.withSlugs++;
                    
                    if (results.events.sample.length < 10) {
                        results.events.sample.push({
                            id: doc.id,
                            name: eventData.name,
                            slug: eventData.slug,
                            status: eventData.status,
                            date: eventData.date
                        });
                    }
                }
            });
            
            console.log(`Events summary: ${results.events.approved} approved, ${results.events.withSlugs} with slugs (all should be in sitemap)`);
            
        } catch (eventError) {
            console.error("Error fetching events:", eventError);
            results.events.error = eventError.message;
        }

        // Check venues
        try {
            console.log("Fetching venues...");
            const venuesRef = db.collection('venues');
            const venueSnapshot = await venuesRef.limit(100).get();
            
            results.venues.total = venueSnapshot.size;
            console.log(`Found ${venueSnapshot.size} venues`);
            
            venueSnapshot.forEach(doc => {
                const venueData = doc.data();
                
                if (venueData.slug) {
                    results.venues.withSlugs++;
                }
                
                const hasImage = venueData.image || venueData.Photo || venueData['Cloudinary Public ID'];
                const hasValidImage = hasImage && (!venueData.image?.url || !venueData.image.url.includes('placehold.co'));
                if (hasValidImage) {
                    results.venues.withValidImages++;
                }
                
                if (results.venues.sample.length < 5) {
                    results.venues.sample.push({
                        id: doc.id,
                        name: venueData.name,
                        slug: venueData.slug,
                        hasImage: !!hasImage,
                        imageFields: {
                            image: !!venueData.image,
                            Photo: !!venueData.Photo,
                            cloudinaryId: !!venueData['Cloudinary Public ID']
                        }
                    });
                }
            });
            
            console.log(`Venues summary: ${results.venues.withSlugs} with slugs, ${results.venues.withValidImages} with valid images (should be in sitemap)`);
            
        } catch (venueError) {
            console.error("Error fetching venues:", venueError);
            results.venues.error = venueError.message;
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(results, null, 2)
        };
        
    } catch (error) {
        console.error('Error in debug-sitemap-data:', error);
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
