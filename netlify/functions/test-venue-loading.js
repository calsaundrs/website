const admin = require('firebase-admin');

exports.handler = async function(event, context) {
    console.log('Test Venue Loading: Starting function');
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Check environment variables
        console.log('Test Venue Loading: Checking environment variables');
        const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
        const missing = required.filter(varName => !process.env[varName]);
        
        if (missing.length > 0) {
            console.error('Test Venue Loading: Missing environment variables:', missing);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Missing environment variables',
                    missing: missing
                })
            };
        }

        console.log('Test Venue Loading: Environment variables OK');

        // Initialize Firebase
        if (!admin.apps.length) {
            console.log('Test Venue Loading: Initializing Firebase');
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
        }

        const db = admin.firestore();
        console.log('Test Venue Loading: Firebase initialized');

        // Try to get venues
        console.log('Test Venue Loading: Fetching venues');
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.limit(5).get(); // Just get 5 venues for testing

        console.log(`Test Venue Loading: Found ${snapshot.size} venues`);

        const venues = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            venues.push({
                id: doc.id,
                name: data.name || data['Name'] || 'Unnamed Venue',
                status: data.status || 'unknown'
            });
        });

        console.log('Test Venue Loading: Successfully processed venues');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                venueCount: venues.length,
                venues: venues,
                message: 'Venue loading test successful'
            })
        };

    } catch (error) {
        console.error('Test Venue Loading: Error:', error);
        console.error('Test Venue Loading: Error stack:', error.stack);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Test failed',
                message: error.message,
                stack: error.stack
            })
        };
    }
}; 