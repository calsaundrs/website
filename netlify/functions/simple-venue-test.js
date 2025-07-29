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
        console.log('Simple test: Starting');
        
        // Check if Firebase is already initialized
        if (!admin.apps.length) {
            console.log('Simple test: Initializing Firebase');
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
        }

        console.log('Simple test: Firebase initialized');
        
        const db = admin.firestore();
        console.log('Simple test: Firestore instance created');
        
        // Just try to get the collection reference
        const venuesRef = db.collection('venues');
        console.log('Simple test: Collection reference created');
        
        // Try to get just one document
        const snapshot = await venuesRef.limit(1).get();
        console.log('Simple test: Query executed, found', snapshot.size, 'documents');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Simple test passed',
                venueCount: snapshot.size
            })
        };

    } catch (error) {
        console.error('Simple test: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Simple test failed',
                message: error.message
            })
        };
    }
}; 