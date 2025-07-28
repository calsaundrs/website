const admin = require('firebase-admin');

exports.handler = async function(event, context) {
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

    try {
        console.log('Test Build Events Simple: Starting test');
        
        // Test Firebase initialization
        let firebaseStatus = 'not_initialized';
        let eventCount = 0;
        
        try {
            if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
                // Check if Firebase is already initialized
                try {
                    admin.app();
                    firebaseStatus = 'already_initialized';
                } catch (error) {
                    // Initialize Firebase
                    admin.initializeApp({
                        credential: admin.credential.cert({
                            projectId: process.env.FIREBASE_PROJECT_ID,
                            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                        })
                    });
                    firebaseStatus = 'initialized';
                }
                
                if (firebaseStatus !== 'not_initialized') {
                    const db = admin.firestore();
                    const eventsRef = db.collection('events');
                    const snapshot = await eventsRef
                        .where('status', '==', 'approved')
                        .limit(5)
                        .get();
                    
                    eventCount = snapshot.size;
                }
            }
        } catch (firebaseError) {
            console.error('Firebase error:', firebaseError);
            firebaseStatus = 'error';
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Simple test completed',
                firebaseStatus,
                eventCount,
                environment: process.env.NETLIFY ? 'production' : 'development',
                firebaseVars: {
                    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET',
                    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT SET',
                    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'NOT SET'
                }
            })
        };

    } catch (error) {
        console.error('Test Build Events Simple: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Test failed',
                details: error.message,
                stack: error.stack
            })
        };
    }
}; 