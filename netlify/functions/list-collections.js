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
        console.log('List Collections: Starting function');
        
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
        console.log('List Collections: Fetching collections from Firestore');
        const collections = await db.listCollections();
        console.log(`List Collections: Found ${collections.length} collections`);
        
        const collectionNames = collections.map(col => col.id);
        
        console.log('List Collections: Collection names:', collectionNames);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                totalCollections: collections.length,
                collections: collectionNames
            })
        };

    } catch (error) {
        console.error('List Collections: Error:', error);
        console.error('List Collections: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to list collections',
                details: error.message,
                stack: error.stack
            })
        };
    }
};