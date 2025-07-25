const admin = require('firebase-admin');

// Version: 2025-01-27-v1 - Test basic events query

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
    console.log("test-events-query function called");
    
    try {
        console.log("Testing basic Firestore connection...");
        
        // Test 1: Simple collection access
        const eventsRef = db.collection('events');
        console.log("Events collection reference created");
        
        // Test 2: Simple query without ordering
        const basicQuery = eventsRef.where('status', '==', 'approved');
        console.log("Basic query created");
        
        const basicSnapshot = await basicQuery.limit(5).get();
        console.log(`Basic query returned ${basicSnapshot.size} documents`);
        
        // Test 3: Query with ordering (this will trigger index requirement)
        console.log("Testing query with ordering...");
        const orderedQuery = eventsRef.where('status', '==', 'approved').orderBy('date', 'asc');
        const orderedSnapshot = await orderedQuery.limit(5).get();
        console.log(`Ordered query returned ${orderedSnapshot.size} documents`);
        
        // Process results
        const events = [];
        orderedSnapshot.forEach(doc => {
            const eventData = {
                id: doc.id,
                name: doc.data().name,
                date: doc.data().date,
                status: doc.data().status
            };
            events.push(eventData);
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                message: 'Basic events query successful',
                eventCount: events.length,
                events: events,
                tests: {
                    basicQuery: 'PASSED',
                    orderedQuery: 'PASSED'
                }
            })
        };
        
    } catch (error) {
        console.error('Error in test-events-query:', error);
        console.error('Error stack:', error.stack);
        
        // Check if this is an index error
        if (error.message && error.message.includes('FAILED_PRECONDITION')) {
            console.log('INDEX ERROR DETECTED - This query requires an index');
            console.log('Error details:', error.details);
            
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'INDEX_REQUIRED',
                    message: 'This query requires a Firestore index',
                    details: error.details,
                    solution: 'Follow the link in the error details to create the required index',
                    errorMessage: error.message
                })
            };
        }
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: false,
                error: 'QUERY_FAILED',
                message: error.message,
                details: error.details || 'No additional details',
                code: error.code || 'UNKNOWN'
            })
        };
    }
};