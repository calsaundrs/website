const admin = require('firebase-admin');

// Version: 2025-01-27-v1 - Test Firestore connection

exports.handler = async function (event, context) {
    console.log("test-firestore-connection function called");
    
    try {
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
        
        // Test basic connection by getting a sample of events
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.limit(5).get();
        
        const events = [];
        snapshot.forEach(doc => {
            events.push({
                id: doc.id,
                name: doc.data().name,
                slug: doc.data().slug,
                date: doc.data().date
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
                message: 'Firestore connection successful',
                eventCount: events.length,
                sampleEvents: events,
                environment: {
                    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
                    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
                    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
                }
            })
        };
        
    } catch (error) {
        console.error('Error testing Firestore connection:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: false,
                message: 'Firestore connection failed',
                error: error.message,
                environment: {
                    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
                    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
                    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
                }
            })
        };
    }
};