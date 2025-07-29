const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Debugging raw event data from Firestore');
    
    try {
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
        
        // Get 5 approved events
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .limit(5)
            .get();
        
        const debugData = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Get all keys that might contain image data
            const imageRelatedKeys = Object.keys(data).filter(key => 
                key.toLowerCase().includes('image') || 
                key.toLowerCase().includes('promo') || 
                key.toLowerCase().includes('thumbnail') ||
                key.toLowerCase().includes('cloudinary')
            );
            
            const eventData = {
                id: doc.id,
                name: data.name || 'Untitled Event',
                allKeys: Object.keys(data),
                imageRelatedKeys: imageRelatedKeys,
                cloudinaryPublicId: data['Cloudinary Public ID'],
                cloudinaryPublicIdCamel: data.cloudinaryPublicId,
                promoImage: data['Promo Image'],
                promoImageCamel: data.promoImage,
                image: data.image,
                promo_image: data.promo_image,
                thumbnail: data.thumbnail,
                venueImage: data.venueImage,
                venue_image: data.venue_image,
                cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET'
            };
            
            debugData.push(eventData);
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                debugData: debugData,
                cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET'
            })
        };
        
    } catch (error) {
        console.error('Error debugging event data:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to debug event data',
                message: error.message
            })
        };
    }
}; 