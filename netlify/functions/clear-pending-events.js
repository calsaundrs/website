const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Clear pending events from Firestore called');
    
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

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
        
        console.log('🔍 Finding all pending events...');
        
        // Query for all pending events
        const pendingStatuses = ['pending', 'Pending', 'pending review', 'Pending Review'];
        let allPendingEvents = [];
        
        // Query each status separately since Firestore doesn't support 'in' queries with more than 10 values
        for (const status of pendingStatuses) {
            try {
                const snapshot = await db.collection('events')
                    .where('status', '==', status)
                    .get();
                
                console.log(`Found ${snapshot.size} events with status: ${status}`);
                snapshot.forEach(doc => {
                    allPendingEvents.push({
                        id: doc.id,
                        data: doc.data()
                    });
                });
            } catch (error) {
                console.log(`Error querying status '${status}':`, error.message);
            }
        }
        
        // Remove duplicates (in case there are events with different case variations)
        const uniqueEvents = allPendingEvents.filter((event, index, self) => 
            index === self.findIndex(e => e.id === event.id)
        );
        
        console.log(`📊 Total unique pending events to delete: ${uniqueEvents.length}`);
        
        if (uniqueEvents.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'No pending events found to delete',
                    deletedCount: 0
                })
            };
        }
        
        // Delete events in batches (Firestore batch limit is 500)
        const batchSize = 500;
        let totalDeleted = 0;
        const eventNames = [];
        
        for (let i = 0; i < uniqueEvents.length; i += batchSize) {
            const batch = db.batch();
            const batchEvents = uniqueEvents.slice(i, i + batchSize);
            
            batchEvents.forEach(event => {
                const eventRef = db.collection('events').doc(event.id);
                batch.delete(eventRef);
                eventNames.push(event.data.name || 'Unnamed Event');
            });
            
            await batch.commit();
            totalDeleted += batchEvents.length;
            
            console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batchEvents.length} events`);
        }
        
        console.log(`🎉 Successfully deleted ${totalDeleted} pending events`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Successfully deleted ${totalDeleted} pending events`,
                deletedCount: totalDeleted,
                deletedEvents: eventNames.slice(0, 10), // Show first 10 event names
                totalEvents: eventNames.length
            })
        };
        
    } catch (error) {
        console.error('❌ Error clearing pending events:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to clear pending events',
                message: error.message
            })
        };
    }
};
