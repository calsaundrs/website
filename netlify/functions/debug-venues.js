const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
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

exports.handler = async function (event, context) {
    console.log("debug-venues function called");
    
    try {
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.limit(10).get();
        
        console.log(`Found ${snapshot.size} venues in collection`);
        
        const venues = [];
        snapshot.forEach(doc => {
            const venueData = doc.data();
            venues.push({
                id: doc.id,
                fields: Object.keys(venueData),
                data: venueData
            });
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                totalVenues: snapshot.size,
                venues: venues
            })
        };
        
    } catch (error) {
        console.error('Error debugging venues:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};