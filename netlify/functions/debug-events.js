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
    console.log("🔍 DEBUG EVENTS: Function called");
    
    try {
        const eventsRef = db.collection('events');
        
        // Get all events
        console.log("🔍 DEBUG EVENTS: Fetching all events...");
        const snapshot = await eventsRef.get();
        
        console.log("🔍 DEBUG EVENTS: Total events found:", snapshot.size);
        
        const events = [];
        const statuses = new Set();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'no-status';
            statuses.add(status);
            
            events.push({
                id: doc.id,
                name: data.name,
                status: status,
                createdAt: data.createdAt,
                venueName: data.venueName,
                submittedBy: data.submittedBy
            });
        });
        
        console.log("🔍 DEBUG EVENTS: All statuses found:", Array.from(statuses));
        console.log("🔍 DEBUG EVENTS: Events data:", events);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: JSON.stringify({
                totalEvents: snapshot.size,
                statuses: Array.from(statuses),
                events: events
            })
        };
        
    } catch (error) {
        console.error('❌ DEBUG EVENTS: Error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};