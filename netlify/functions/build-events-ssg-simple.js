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

function generateEventPage(event) {
    const html = '<!DOCTYPE html>' +
        '<html lang="en">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + event.name + ' - Brum Out Loud</title>' +
        '<link href="https://cdn.tailwindcss.com" rel="stylesheet">' +
        '</head>' +
        '<body class="bg-gray-100">' +
        '<div class="container mx-auto px-4 py-8">' +
        '<h1 class="text-3xl font-bold text-gray-800 mb-4">' + event.name + '</h1>' +
        '<p class="text-gray-600 mb-4">' + (event.description || 'No description available') + '</p>' +
        '<a href="/events.html" class="text-blue-600 hover:text-blue-800">← Back to Events</a>' +
        '</div>' +
        '</body>' +
        '</html>';
    
    return html;
}

async function generateAllEventPages() {
    const events = await getAllEvents();
    const generatedPages = [];
    
    for (const event of events) {
        const htmlContent = generateEventPage(event);
        const fileName = event.slug + '.html';
        
        generatedPages.push({
            fileName: fileName,
            content: htmlContent,
            event: event
        });
    }
    
    return generatedPages;
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
        const generatedPages = await generateAllEventPages();
        const timestamp = new Date().toISOString();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Event pages built successfully - V2',
                generatedFiles: generatedPages.length,
                firebaseStatus: firebaseInitialized ? 'initialized' : 'not_initialized',
                hasEvents: generatedPages.length > 0,
                environment: process.env.NETLIFY ? 'production' : 'development',
                timestamp: timestamp,
                firebaseVars: {
                    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET',
                    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT SET',
                    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'NOT SET'
                },
                generatedPages: generatedPages.map(function(page) {
                    return {
                        fileName: page.fileName,
                        eventName: page.event.name,
                        eventSlug: page.event.slug
                    };
                })
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Build failed',
                details: error.message
            })
        };
    }
}; 