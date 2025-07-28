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
        console.log('Debug Venues: Starting function');
        
        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }
        
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
        console.log('Debug Venues: Fetching venues from Firestore');
        const snapshot = await venuesRef.get();
        console.log(`Debug Venues: Found ${snapshot.size} venues`);
        
        const allVenues = [];
        const venuesWithImages = [];
        const venuesWithoutImages = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const venueInfo = {
                id: doc.id,
                name: data.name || data['Name'] || 'Unnamed Venue',
                status: data.status || 'pending',
                imageFields: {
                    promoImage: data.promoImage,
                    image: data.image,
                    'Promo Image': data['Promo Image'],
                    'Image': data['Image'],
                    promo_image: data.promo_image,
                    venue_image: data.venue_image,
                    'Venue Image': data['Venue Image']
                },
                allFields: Object.keys(data)
            };
            
            allVenues.push(venueInfo);
            
            // Check if venue has any image data - check all possible field names
            const hasImage = (data.promoImage && data.promoImage.url) ||
                           (data.image && data.image.url) ||
                           (data['Promo Image'] && data['Promo Image'].url) ||
                           (data['Image'] && data['Image'].url) ||
                           (data.promo_image && data.promo_image.url) ||
                           (data.venue_image && data.venue_image.url) ||
                           (data['Venue Image'] && data['Venue Image'].url) ||
                           (typeof data.promoImage === 'string') ||
                           (typeof data.image === 'string') ||
                           (typeof data.promo_image === 'string') ||
                           (typeof data.venue_image === 'string');
            
            if (hasImage) {
                venuesWithImages.push(venueInfo);
            } else {
                venuesWithoutImages.push(venueInfo);
            }
        });
        
        const result = {
            totalVenues: snapshot.size,
            allVenues: allVenues,
            venuesWithImages: venuesWithImages,
            venuesWithoutImages: venuesWithoutImages,
            summary: {
                total: snapshot.size,
                withImages: venuesWithImages.length,
                withoutImages: venuesWithoutImages.length
            }
        };
        
        console.log('Debug Venues: Result summary:', result.summary);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Debug Venues: Error:', error);
        console.error('Debug Venues: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to debug venues',
                details: error.message,
                stack: error.stack
            })
        };
    }
};