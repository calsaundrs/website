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
        console.log('Test Venue List: Starting function');
        
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
        
        // Fetch all venues from Firestore
        const venuesRef = db.collection('venues');
        console.log('Test Venue List: Fetching venues from Firestore');
        const snapshot = await venuesRef.get();
        console.log(`Test Venue List: Found ${snapshot.size} venues`);
        
        const venues = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            venues.push({
                id: doc.id,
                name: data.name || data['Name'] || 'Unnamed Venue',
                status: data.status || 'pending'
            });
        });
        
        console.log(`Test Venue List: Returning ${venues.length} venues`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                totalVenues: snapshot.size,
                venues: venues
            })
        };

    } catch (error) {
        console.error('Test Venue List: Error:', error);
        console.error('Test Venue List: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to test venues',
                details: error.message,
                stack: error.stack
            })
        };
    }
};