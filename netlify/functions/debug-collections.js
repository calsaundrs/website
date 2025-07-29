const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Debugging Firestore collections');
    
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
        
        // List all collections
        const collections = await db.listCollections();
        const collectionNames = collections.map(col => col.id);
        
        console.log('Available collections:', collectionNames);
        
        // Check each collection for events with images
        const collectionData = {};
        
        for (const collectionName of collectionNames) {
            console.log('Checking collection:', collectionName);
            
            try {
                const snapshot = await db.collection(collectionName).limit(3).get();
                const docs = [];
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const imageRelatedKeys = Object.keys(data).filter(key => 
                        key.toLowerCase().includes('image') || 
                        key.toLowerCase().includes('promo') || 
                        key.toLowerCase().includes('thumbnail') ||
                        key.toLowerCase().includes('cloudinary')
                    );
                    
                    docs.push({
                        id: doc.id,
                        name: data.name || data['Name'] || 'No name',
                        hasImageFields: imageRelatedKeys.length > 0,
                        imageRelatedKeys: imageRelatedKeys,
                        allKeys: Object.keys(data),
                        cloudinaryPublicId: data['Cloudinary Public ID'] || data.cloudinaryPublicId,
                        promoImage: data['Promo Image'] || data.promoImage,
                        image: data.image
                    });
                });
                
                collectionData[collectionName] = {
                    docCount: snapshot.size,
                    docs: docs,
                    hasImageFields: docs.some(doc => doc.hasImageFields)
                };
                
            } catch (error) {
                console.log('Error reading collection', collectionName, ':', error.message);
                collectionData[collectionName] = {
                    error: error.message
                };
            }
        }
        
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
                collections: collectionNames,
                collectionData: collectionData
            })
        };
        
    } catch (error) {
        console.error('Error debugging collections:', error);
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
                error: 'Failed to debug collections',
                message: error.message
            })
        };
    }
}; 