const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Debugging Bear All event data');
    
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
        
        // Search for "Bear All" event in all collections
        const collections = await db.listCollections();
        const collectionNames = collections.map(col => col.id);
        
        console.log('Available collections:', collectionNames);
        
        const results = {};
        
        for (const collectionName of collectionNames) {
            try {
                // Search for "Bear All" in this collection
                const snapshot = await db.collection(collectionName)
                    .where('name', '>=', 'Bear All')
                    .where('name', '<=', 'Bear All\uf8ff')
                    .limit(5)
                    .get();
                
                if (!snapshot.empty) {
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
                            image: data.image,
                            slug: data.slug || data['Slug']
                        });
                    });
                    
                    results[collectionName] = {
                        found: true,
                        docCount: snapshot.size,
                        docs: docs
                    };
                } else {
                    results[collectionName] = {
                        found: false,
                        docCount: 0
                    };
                }
                
            } catch (error) {
                console.log('Error searching collection', collectionName, ':', error.message);
                results[collectionName] = {
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
                results: results,
                cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET'
            })
        };
        
    } catch (error) {
        console.error('Error debugging Bear All event:', error);
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
                error: 'Failed to debug Bear All event',
                message: error.message
            })
        };
    }
}; 