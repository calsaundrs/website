const admin = require('firebase-admin');

exports.handler = async function(event, context) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Venue List Firestore: Starting function');
        
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
        const venuesRef = db.collection('venues');
        
        console.log('Venue List Firestore: Fetching venues from Firestore');
        const snapshot = await venuesRef.get(); // Removed status filter

        console.log(`Venue List Firestore: Found ${snapshot.size} venues`);

        const venues = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            venues.push({
                id: doc.id,
                name: data.name || data['Venue Name'] || 'Unnamed Venue',
                address: data.address || data['Address'] || '',
                description: data.description || data['Description'] || '',
                website: data.website || data['Website'] || '',
                phone: data.phone || data['Phone'] || ''
            });
        });

        // Sort venues by name
        venues.sort((a, b) => a.name.localeCompare(b.name));

        console.log('Venue List Firestore: Returning venues successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(venues)
        };

    } catch (error) {
        console.error('Venue List Firestore: Error fetching venues:', error);
        console.error('Venue List Firestore: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch venues',
                details: error.message,
                stack: error.stack
            })
        };
    }
};