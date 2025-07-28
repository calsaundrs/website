const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Fix event status casing function called');
    
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
        
        const eventsToUpdate = [];
        const statusCounts = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const currentStatus = data.status || 'unknown';
            
            // Count current statuses
            statusCounts[currentStatus] = (statusCounts[currentStatus] || 0) + 1;
            
            // Check if status needs to be fixed (uppercase to lowercase)
            if (currentStatus === 'Approved' || currentStatus === 'Pending' || currentStatus === 'Rejected' || currentStatus === 'Archived') {
                eventsToUpdate.push({
                    id: doc.id,
                    currentStatus: currentStatus,
                    newStatus: currentStatus.toLowerCase()
                });
            }
        });
        
        console.log('Status counts before fix:', statusCounts);
        console.log(`Events to update: ${eventsToUpdate.length}`);
        
        // Update events with incorrect casing
        const batch = db.batch();
        let updatedCount = 0;
        
        for (const event of eventsToUpdate) {
            const eventRef = eventsRef.doc(event.id);
            batch.update(eventRef, { 
                status: event.newStatus,
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
        
        console.log(`Successfully updated ${updatedCount} events`);
        
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
                message: 'Event status casing fixed successfully',
                totalEvents: snapshot.size,
                eventsUpdated: updatedCount,
                statusCountsBefore: statusCounts,
                statusCountsAfter: updatedStatusCounts,
                eventsToUpdate: eventsToUpdate.slice(0, 10) // Show first 10 for debugging
            })
        };
        
    } catch (error) {
        console.error('Fix event status casing failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Fix event status casing failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};