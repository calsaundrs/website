const admin = require('firebase-admin');

exports.handler = async function(event, context) {
    console.log('Test event submission debug function called');
    
    try {
        // Initialize Firebase if not already initialized
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
        
        // Test writing a simple event to Firestore
        const testEvent = {
            name: 'Test Debug Event',
            description: 'This is a test event to debug Firestore writes',
            date: new Date('2025-08-30T20:00:00.000Z').toISOString(),
            status: 'pending',
            venueName: 'Test Debug Venue',
            category: ['Test'],
            submittedBy: 'debug@test.com',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('Writing test event to Firestore:', testEvent);
        
        const docRef = await db.collection('events').add(testEvent);
        
        console.log('Test event written successfully with ID:', docRef.id);
        
        // Now read it back to verify
        const doc = await docRef.get();
        const data = doc.data();
        
        console.log('Read back event data:', data);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Test event written and read successfully',
                eventId: docRef.id,
                eventData: data,
                status: data.status
            })
        };
        
    } catch (error) {
        console.error('Error in test event submission debug:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Test failed',
                message: error.message,
                stack: error.stack
            })
        };
    }
};