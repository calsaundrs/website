const admin = require('firebase-admin');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('Simple events test: Starting');
        
        // Check if Firebase is already initialized
        if (!admin.apps.length) {
            console.log('Simple events test: Initializing Firebase');
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
        }

        console.log('Simple events test: Firebase initialized');
        
        const db = admin.firestore();
        console.log('Simple events test: Firestore instance created');
        
        // Try to get events
        const eventsRef = db.collection('events');
        console.log('Simple events test: Events collection reference created');
        
        // Try to get just a few events
        const snapshot = await eventsRef.limit(5).get();
        console.log('Simple events test: Query executed, found', snapshot.size, 'events');

        const events = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            events.push({
                id: doc.id,
                name: data.name || 'Unnamed Event',
                date: data.date
            });
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Simple events test passed',
                eventCount: events.length,
                events: events
            })
        };

    } catch (error) {
        console.error('Simple events test: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Simple events test failed',
                message: error.message
            })
        };
    }
}; 