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

function formatDate(dateString) {
    if (!dateString) return 'Date TBC';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date TBC';
    
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    return date.toLocaleDateString('en-GB', options);
}

function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

function processEventForPublic(eventData, eventId) {
    const event = {
        id: eventId,
        name: eventData.name || eventData['Event Name'] || 'Unnamed Event',
        slug: eventData.slug || eventData['Event Slug'] || '',
        description: eventData.description || eventData['Description'] || '',
        date: eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : null,
        venue: eventData.venue || null,
        imageUrl: null
    };
    
    // Process image URL
    if (eventData.cloudinaryPublicId) {
        const cloudinaryId = eventData.cloudinaryPublicId;
        if (process.env.CLOUDINARY_CLOUD_NAME) {
            event.imageUrl = 'https://res.cloudinary.com/' + process.env.CLOUDINARY_CLOUD_NAME + '/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/' + cloudinaryId;
        } else {
            event.imageUrl = 'https://placehold.co/1200x675/1e1e1e/EAEAEA?text=' + encodeURIComponent(event.name);
        }
    } else if (eventData.imageUrl) {
        event.imageUrl = eventData.imageUrl;
    } else {
        event.imageUrl = 'https://placehold.co/1200x675/1e1e1e/EAEAEA?text=' + encodeURIComponent(event.name);
    }
    
    return event;
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
        
        console.log('Found ' + snapshot.size + ' approved events');
        
        const events = [];
        snapshot.forEach(function(doc) {
            const data = doc.data();
            const processedEvent = processEventForPublic(data, doc.id);
            if (processedEvent && processedEvent.slug) {
                events.push(processedEvent);
            }
        });
        
        console.log('Processed ' + events.length + ' events with valid slugs');
        return events;
        
    } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
    }
}

function generateEventPage(event) {
    const template = '<!DOCTYPE html>' +
        '<html lang="en">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + event.name + ' - Brum Out Loud</title>' +
        '<meta name="description" content="' + (event.description || 'Event details') + '">' +
        '<link href="https://cdn.tailwindcss.com" rel="stylesheet">' +
        '<meta property="og:title" content="' + event.name + '">' +
        '<meta property="og:description" content="' + (event.description || 'Event details') + '">' +
        '<meta property="og:image" content="' + event.imageUrl + '">' +
        '<meta property="og:url" content="https://www.brumoutloud.co.uk/event/' + event.slug + '">' +
        '<meta name="twitter:card" content="summary_large_image">' +
        '</head>' +
        '<body class="bg-gray-100">' +
        '<div class="container mx-auto px-4 py-8">' +
        '<h1 class="text-3xl font-bold text-gray-800 mb-4">' + event.name + '</h1>' +
        '<p class="text-gray-600 mb-4">' + (event.description || 'No description available') + '</p>' +
        '<p class="text-gray-700 mb-4">Date: ' + formatDate(event.date) + '</p>' +
        '<a href="/events.html" class="text-blue-600 hover:text-blue-800">← Back to Events</a>' +
        '</div>' +
        '</body>' +
        '</html>';
    
    return template;
}

async function generateAllEventPages() {
    const events = await getAllEvents();
    const generatedPages = [];
    
    console.log('Generating ' + events.length + ' event pages...');
    
    for (const event of events) {
        try {
            const htmlContent = generateEventPage(event);
            const fileName = event.slug + '.html';
            
            generatedPages.push({
                fileName: fileName,
                content: htmlContent,
                event: event
            });
            
            console.log('Generated: ' + fileName);
        } catch (error) {
            console.error('Failed to generate page for event ' + event.slug + ':', error.message);
        }
    }
    
    console.log('Successfully generated ' + generatedPages.length + ' event pages');
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
        console.log('Event SSG Build: Starting function');
        
        const generatedPages = await generateAllEventPages();
        
        console.log('Event SSG Build: Build completed');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Event pages built successfully',
                output: 'Generated ' + generatedPages.length + ' event pages',
                generatedFiles: generatedPages.length,
                firebaseStatus: firebaseInitialized ? 'initialized' : 'not_initialized',
                hasEvents: generatedPages.length > 0,
                environment: process.env.NETLIFY ? 'production' : 'development',
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
        console.error('Event SSG Build: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to start event SSG build',
                details: error.message
            })
        };
    }
}; 