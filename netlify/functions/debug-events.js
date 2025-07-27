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
        const pendingEvents = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'no-status';
            statuses.add(status);
            
            const eventData = {
                id: doc.id,
                name: data.name,
                status: status,
                createdAt: data.createdAt,
                venueName: data.venueName,
                submittedBy: data.submittedBy
            };
            
            events.push(eventData);
            
            // Collect pending events separately
            if (status === 'pending' || status === 'pending review') {
                pendingEvents.push(eventData);
            }
        });
        
        console.log("🔍 DEBUG EVENTS: All statuses found:", Array.from(statuses));
        console.log("🔍 DEBUG EVENTS: Pending events count:", pendingEvents.length);
        console.log("🔍 DEBUG EVENTS: Pending events:", pendingEvents);
        console.log("🔍 DEBUG EVENTS: Total events:", events.length);
        
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
                pendingEventsCount: pendingEvents.length,
                pendingEvents: pendingEvents,
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