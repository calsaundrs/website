const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Cleanup duplicate status fields function called');
    
    try {
        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }
        
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
        
        console.log('Firebase initialized successfully');
        
        // Get all events from Firestore
        console.log('Fetching all events from database...');
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.get();
        
        console.log(`Found ${snapshot.size} events in database`);
        
        const eventsToCleanup = [];
        const statusCounts = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const lowerStatus = data.status;
            const upperStatus = data['Status'];
            
            // Count statuses
            const status = lowerStatus || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            // Check if event has both fields (needs cleanup)
            if (lowerStatus && upperStatus) {
                eventsToCleanup.push({
                    id: doc.id,
                    name: data.name || data['Event Name'] || 'Untitled Event',
                    lowerStatus: lowerStatus,
                    upperStatus: upperStatus,
                    hasBothFields: true
                });
            }
        });
        
        console.log('Status counts before cleanup:', statusCounts);
        console.log(`Events to cleanup: ${eventsToCleanup.length}`);
        
        // Remove uppercase Status field from events with both fields
        const batch = db.batch();
        let updatedCount = 0;
        
        for (const event of eventsToCleanup) {
            const eventRef = eventsRef.doc(event.id);
            batch.update(eventRef, { 
                Status: admin.firestore.FieldValue.delete(), // Remove the uppercase field
                updatedAt: new Date()
            });
            updatedCount++;
            
            // Firestore batches are limited to 500 operations
            if (updatedCount % 500 === 0) {
                await batch.commit();
                console.log(`Committed batch of ${updatedCount} updates`);
            }
        }
        
        // Commit any remaining updates
        if (updatedCount % 500 !== 0) {
            await batch.commit();
        }
        
        console.log(`Successfully cleaned up ${updatedCount} events`);
        
        // Get updated status counts
        const updatedSnapshot = await eventsRef.get();
        const updatedStatusCounts = {};
        
        updatedSnapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'unknown';
            updatedStatusCounts[status] = (updatedStatusCounts[status] || 0) + 1;
        });
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Duplicate status fields cleaned up successfully',
                totalEvents: snapshot.size,
                eventsCleaned: updatedCount,
                statusCountsBefore: statusCounts,
                statusCountsAfter: updatedStatusCounts,
                eventsToCleanup: eventsToCleanup.slice(0, 10) // Show first 10 for debugging
            })
        };
        
    } catch (error) {
        console.error('Cleanup duplicate status fields failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Cleanup duplicate status fields failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};