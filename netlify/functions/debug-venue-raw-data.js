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
        console.log('Debug Venue Raw Data: Starting function');
        
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
        
        // Fetch first few venues to inspect their raw structure
        const venuesRef = db.collection('venues');
        console.log('Debug Venue Raw Data: Fetching venues from Firestore');
        const snapshot = await venuesRef.limit(3).get();
        console.log(`Debug Venue Raw Data: Found ${snapshot.size} venues`);
        
        const venueRawData = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            venueRawData.push({
                id: doc.id,
                name: data.name || data['Name'] || 'Unnamed Venue',
                rawData: data
            });
        });
        
        console.log('Debug Venue Raw Data: Raw venue data:', venueRawData);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                totalVenues: snapshot.size,
                venueRawData: venueRawData
            })
        };

    } catch (error) {
        console.error('Debug Venue Raw Data: Error:', error);
        console.error('Debug Venue Raw Data: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to debug venue raw data',
                details: error.message,
                stack: error.stack
            })
        };
    }
};