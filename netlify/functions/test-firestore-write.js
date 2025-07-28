const admin = require('firebase-admin');

exports.handler = async function(event, context) {
    console.log('Test Firestore write function called');
    
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
        
        // Test writing a simple document
        const testDoc = {
            test: true,
            timestamp: new Date().toISOString(),
            message: 'Test Firestore write'
        };
        
        console.log('Writing test document to Firestore');
        
        const docRef = await db.collection('test').add(testDoc);
        
        console.log('Test document written successfully with ID:', docRef.id);
        
        // Read it back to verify
        const doc = await docRef.get();
        const data = doc.data();
        
        console.log('Read back document data:', data);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Firestore write test successful',
                docId: docRef.id,
                data: data
            })
        };
        
    } catch (error) {
        console.error('Error in test Firestore write:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Firestore write test failed',
                message: error.message,
                stack: error.stack
            })
        };
    }
};