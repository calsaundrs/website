const admin = require('firebase-admin');

let firebaseInitialized = false;
let db = null;

try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        try {
            admin.app();
            firebaseInitialized = true;
        } catch (error) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
            firebaseInitialized = true;
        }
        
        if (firebaseInitialized) {
            db = admin.firestore();
        }
    }
} catch (error) {
    console.log('Firebase init failed:', error.message);
}

async function getAllEvents() {
    if (!firebaseInitialized) {
        return [];
    }
    
    try {
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .limit(5)
            .get();
        
        const events = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.slug) {
                events.push({
                    id: doc.id,
                    name: data.name || 'Unnamed Event',
                    slug: data.slug,
                    description: data.description || ''
                });
            }
        });
        
        return events;
    } catch (error) {
        console.error('Error fetching events:', error);
        return [];
    }
}

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const events = await getAllEvents();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Simple test completed',
                eventCount: events.length,
                firebaseStatus: firebaseInitialized ? 'initialized' : 'not_initialized',
                environment: process.env.NETLIFY ? 'production' : 'development',
                events: events.map(function(event) {
                    return {
                        name: event.name,
                        slug: event.slug
                    };
                })
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Test failed',
                details: error.message
            })
        };
    }
}; 