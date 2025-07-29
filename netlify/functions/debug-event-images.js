const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Debugging event images');
    
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
        
        // Get all approved events to debug
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .get();
        
        const debugData = [];
        const eventsWithImages = [];
        const eventsWithoutImages = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const imageFields = {};
            
            // Check all possible image fields
            const imageFieldNames = [
                'cloudinaryPublicId', 'promoImage', 'image', 'promo_image', 
                'thumbnail', 'venueImage', 'venue_image', 'Promo Image', 
                'Image', 'Thumbnail', 'Venue Image'
            ];
            
            imageFieldNames.forEach(fieldName => {
                if (data[fieldName]) {
                    imageFields[fieldName] = data[fieldName];
                }
            });
            
            // Also check for any field containing 'cloudinary'
            const cloudinaryFields = {};
            Object.keys(data).forEach(key => {
                if (key.toLowerCase().includes('cloudinary') || 
                    (typeof data[key] === 'string' && data[key].includes('cloudinary'))) {
                    cloudinaryFields[key] = data[key];
                }
            });
            
            const eventData = {
                id: doc.id,
                name: data.name || 'Untitled Event',
                imageFields: imageFields,
                cloudinaryFields: cloudinaryFields,
                allKeys: Object.keys(data),
                hasAnyImage: Object.keys(imageFields).length > 0 || Object.keys(cloudinaryFields).length > 0
            };
            
            debugData.push(eventData);
            
            if (eventData.hasAnyImage) {
                eventsWithImages.push(eventData);
            } else {
                eventsWithoutImages.push(eventData);
            }
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
                totalEvents: debugData.length,
                eventsWithImages: eventsWithImages.length,
                eventsWithoutImages: eventsWithoutImages.length,
                debugData: debugData,
                eventsWithImagesData: eventsWithImages,
                eventsWithoutImagesData: eventsWithoutImages,
                cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET'
            })
        };
        
    } catch (error) {
        console.error('Error debugging event images:', error);
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
                error: 'Failed to debug event images',
                message: error.message
            })
        };
    }
}; 