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
            
            // Extract image URL using same logic as events
            let imageUrl = null;
            
            // 1. Try explicit image fields
            if (data.image) {
                imageUrl = typeof data.image === 'string' ? data.image : data.image.url;
            } else if (data['Image']) {
                imageUrl = typeof data['Image'] === 'string' ? data['Image'] : data['Image'].url;
            } else if (data.venueImage) {
                imageUrl = typeof data.venueImage === 'string' ? data.venueImage : data.venueImage.url;
            } else if (data['Venue Image']) {
                imageUrl = typeof data['Venue Image'] === 'string' ? data['Venue Image'] : data['Venue Image'].url;
            } else if (data.airtableId && process.env.CLOUDINARY_CLOUD_NAME) {
                // Try Cloudinary URL from airtableId (venues might be in events folder)
                imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/brumoutloud_events/venue_${data.airtableId}`;
                console.log('Trying airtableId-based Cloudinary URL for venue:', imageUrl);
            }
            
            venues.push({
                id: doc.id,
                name: data.name || data['Venue Name'] || 'Unnamed Venue',
                address: data.address || data['Address'] || '',
                description: data.description || data['Description'] || '',
                website: data.website || data['Website'] || '',
                phone: data.phone || data['Phone'] || '',
                airtableId: data.airtableId || null,
                image: imageUrl ? { url: imageUrl } : null
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