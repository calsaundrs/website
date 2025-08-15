const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
        console.log("Firebase initialized successfully");
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
}

const db = admin.firestore();

exports.handler = async function (event, context) {
    try {
        console.log("test-sitemap function called");
        
        // Check environment variables
        const envCheck = {
            FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
            FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
            FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
            URL: process.env.URL || 'https://www.brumoutloud.co.uk'
        };
        
        console.log("Environment variables check:", envCheck);
        
        if (!envCheck.FIREBASE_PROJECT_ID || !envCheck.FIREBASE_CLIENT_EMAIL || !envCheck.FIREBASE_PRIVATE_KEY) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing Firebase environment variables',
                    envCheck: envCheck
                })
            };
        }
        
        // Test events query
        try {
            console.log("Testing events query...");
            const eventsRef = db.collection('events');
            const eventSnapshot = await eventsRef.where('status', '==', 'approved').limit(5).get();
            console.log(`Events query successful: ${eventSnapshot.size} events found`);
            
            const events = [];
            eventSnapshot.forEach(doc => {
                const data = doc.data();
                events.push({
                    id: doc.id,
                    name: data.name || data['Event Name'],
                    slug: data.slug || data['Slug'],
                    status: data.status
                });
            });
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    envCheck: envCheck,
                    events: {
                        count: eventSnapshot.size,
                        sample: events
                    }
                })
            };
            
        } catch (queryError) {
            console.error("Events query error:", queryError);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Events query failed',
                    queryError: queryError.message,
                    envCheck: envCheck
                })
            };
        }
        
    } catch (error) {
        console.error('Error in test-sitemap:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
