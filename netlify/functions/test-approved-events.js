const admin = require('firebase-admin');

exports.handler = async function(event, context) {
    console.log('Test Approved Events: Starting function');
    
    try {
        // Initialize Firebase
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
        }
        const db = admin.firestore();
        
        // Get all events
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.get();
        
        console.log(`Test Approved Events: Found ${snapshot.size} total events`);
        
        const allEvents = [];
        const approvedEvents = [];
        const pendingEvents = [];
        const rejectedEvents = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'pending';
            const eventInfo = {
                id: doc.id,
                name: data.name || data['Event Name'] || 'Untitled Event',
                status: status,
                date: data.date
            };
            
            allEvents.push(eventInfo);
            
            if (status === 'approved') {
                approvedEvents.push(eventInfo);
            } else if (status === 'pending') {
                pendingEvents.push(eventInfo);
            } else if (status === 'rejected') {
                rejectedEvents.push(eventInfo);
            }
        });
        
        console.log(`Test Approved Events: Status breakdown:`);
        console.log(`  - Total: ${allEvents.length}`);
        console.log(`  - Approved: ${approvedEvents.length}`);
        console.log(`  - Pending: ${pendingEvents.length}`);
        console.log(`  - Rejected: ${rejectedEvents.length}`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                total: allEvents.length,
                approved: approvedEvents.length,
                pending: pendingEvents.length,
                rejected: rejectedEvents.length,
                allEvents: allEvents,
                approvedEvents: approvedEvents,
                pendingEvents: pendingEvents,
                rejectedEvents: rejectedEvents
            })
        };
        
    } catch (error) {
        console.error('Test Approved Events: Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
}; 