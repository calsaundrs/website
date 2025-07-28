const admin = require('firebase-admin');

// Initialize Firebase if credentials are available
let firebaseInitialized = false;
let db = null;

try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        // Check if Firebase is already initialized
        try {
            admin.app();
            firebaseInitialized = true;
        } catch (error) {
            // Initialize Firebase
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
            console.log('Firebase initialized successfully');
        }
    } else {
        console.log('Missing Firebase environment variables');
    }
} catch (error) {
    console.log('Firebase initialization failed:', error.message);
}

function processEventForPublic(eventData, eventId) {
    const event = {
        id: eventId,
        name: eventData.name || eventData['Event Name'] || 'Unnamed Event',
        slug: eventData.slug || eventData['Event Slug'] || '',
        description: eventData.description || eventData['Description'] || '',
        date: eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : null
    };
    
    return event;
}

async function getAllEvents() {
    try {
        if (!firebaseInitialized) {
            console.log('Firebase not initialized. Cannot fetch events.');
            return [];
        }
        
        console.log('Fetching all approved events from Firestore...');
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .limit(10)
            .get();
        
        console.log(`Found ${snapshot.size} approved events`);
        
        const events = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const processedEvent = processEventForPublic(data, doc.id);
            if (processedEvent && processedEvent.slug) {
                events.push(processedEvent);
            }
        });
        
        console.log(`Processed ${events.length} events with valid slugs`);
        return events;
        
    } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
    }
}

function generateEventPage(event) {
    const template = '<!DOCTYPE html><html><head><title>' + event.name + '</title></head><body><h1>' + event.name + '</h1><p>' + (event.description || 'No description') + '</p><p>Date: ' + (event.date ? new Date(event.date).toLocaleDateString() : 'TBC') + '</p></body></html>';
    return template;
}

async function generateAllEventPages() {
    try {
        if (!firebaseInitialized) {
            console.log('Firebase not initialized. Skipping event page generation.');
            return [];
        }
        
        console.log('Starting event page generation...');
        
        const events = await getAllEvents();
        
        if (events.length === 0) {
            console.log('No events found. No pages will be generated.');
            return [];
        }
        
        console.log(`Generating ${events.length} event pages...`);
        
        const generatedPages = [];
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
        
    } catch (error) {
        console.error('Error in event page generation:', error);
        throw error;
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
        console.log('Simple Event SSG Build: Starting function');
        
        const generatedPages = await generateAllEventPages();
        
        console.log('Simple Event SSG Build: Build completed');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Simple event pages built successfully',
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
        });

    } catch (error) {
        console.error('Simple Event SSG Build: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to start simple event SSG build',
                details: error.message,
                stack: error.stack
            })
        };
    }
}; 