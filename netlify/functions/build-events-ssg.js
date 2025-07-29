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
    // Use standardized field names - no more legacy mapping
    const eventName = eventData.name || 'Unnamed Event';
    const eventSlug = eventData.slug || '';
    const eventDescription = eventData.description || '';
    const eventDate = eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : null;
    
    // Extract image URL using standardized fields
    let imageUrl = null;
    if (eventData.cloudinaryPublicId) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${eventData.cloudinaryPublicId}`;
    } else if (eventData.promoImage) {
        imageUrl = typeof eventData.promoImage === 'string' ? eventData.promoImage : 
                  (eventData.promoImage.url || eventData.promoImage[0]?.url);
    } else if (eventData.image) {
        imageUrl = typeof eventData.image === 'string' ? eventData.image : 
                  (eventData.image.url || eventData.image[0]?.url);
    }
    
    // Extract venue data using standardized fields
    let venueData = {
        id: '',
        name: 'Venue TBC',
        slug: ''
    };
    
    if (eventData.venueId) {
        venueData = {
            id: eventData.venueId,
            name: eventData.venueName || 'Venue TBC',
            slug: eventData.venueSlug || ''
        };
    } else if (eventData.venue) {
        venueData = {
            id: eventData.venue.id || '',
            name: eventData.venue.name || 'Venue TBC',
            slug: eventData.venue.slug || ''
        };
    }
    
    const event = {
        id: eventId,
        name: eventName,
        slug: eventSlug,
        description: eventDescription,
        date: eventDate,
        venue: venueData,
        image: imageUrl ? { url: imageUrl } : null,
        category: eventData.category || [],
        price: eventData.price || null,
        ageRestriction: eventData.ageRestriction || null,
        organizer: eventData.organizer || null,
        accessibility: eventData.accessibility || null,
        ticketLink: eventData.ticketLink || null,
        eventLink: eventData.eventLink || null,
        facebookEvent: eventData.facebookEvent || null,
        recurringInfo: eventData.recurringInfo || null,
        boostedListingStartDate: eventData.boostedListingStartDate || null,
        boostedListingEndDate: eventData.boostedListingEndDate || null,
        otherInstances: [] // Will be populated for recurring events
    };
    
    if (!event.category || event.category.length === 0) {
        event.category = ['Event'];
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