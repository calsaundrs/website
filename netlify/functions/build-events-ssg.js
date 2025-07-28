const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
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

// Event template content
const EVENT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{EVENT_NAME}} - BrumOutLoud</title>
    <meta name="description" content="{{EVENT_DESCRIPTION}}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{{EVENT_URL}}">
    <meta property="og:title" content="{{EVENT_NAME}} - BrumOutLoud">
    <meta property="og:description" content="{{EVENT_DESCRIPTION}}">
    <meta property="og:image" content="{{EVENT_IMAGE_URL}}">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="{{EVENT_URL}}">
    <meta property="twitter:title" content="{{EVENT_NAME}} - BrumOutLoud">
    <meta property="twitter:description" content="{{EVENT_DESCRIPTION}}">
    <meta property="twitter:image" content="{{EVENT_IMAGE_URL}}">
    
    <!-- Styles -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    
    <style>
        body {
            background: linear-gradient(135deg, #111827 0%, #7C3AED 50%, #111827 100%);
            color: #EAEAEA;
            font-family: 'Poppins', sans-serif;
            min-height: 100vh;
        }
        .font-anton {
            font-family: 'Anton', sans-serif;
            letter-spacing: 0.05em;
        }
        .accent-color { color: #E83A99; }
        .btn-primary {
            background: linear-gradient(135deg, #E83A99 0%, #8B5CF6 100%);
            border: 1px solid rgba(232, 58, 153, 0.3);
            transition: all 0.3s ease;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #D61F69 0%, #7C3AED 100%);
            transform: translateY(-1px);
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="flex items-center text-2xl tracking-widest text-white" style="font-family: 'Omnes Pro', sans-serif;">
                <span>Brum Outloud</span>
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded" loading="lazy">
            </a>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-8 py-8">
        <div class="max-w-4xl mx-auto">
            <!-- Event Header -->
            <div class="mb-8">
                <div class="flex items-center space-x-4 mb-4">
                    <a href="/events" class="text-accent-color hover:text-white transition-colors">
                        <i class="fas fa-arrow-left mr-2"></i>Back to Events
                    </a>
                </div>
                <h1 class="text-4xl md:text-5xl font-anton text-white mb-4">{{EVENT_NAME}}</h1>
                <div class="flex flex-wrap items-center gap-4 text-gray-400">
                    <div class="flex items-center">
                        <i class="fas fa-calendar-alt mr-2"></i>
                        <span>{{EVENT_DATE_FORMATTED}}</span>
                    </div>
                    {{#if EVENT_VENUE}}
                    <div class="flex items-center">
                        <i class="fas fa-map-marker-alt mr-2"></i>
                        <a href="/venue/{{EVENT_VENUE_SLUG}}" class="hover:text-accent-color transition-colors">{{EVENT_VENUE_NAME}}</a>
                    </div>
                    {{/if}}
                    {{#if EVENT_PRICE}}
                    <div class="flex items-center">
                        <i class="fas fa-ticket-alt mr-2"></i>
                        <span>{{EVENT_PRICE}}</span>
                    </div>
                    {{/if}}
                </div>
            </div>

            <!-- Event Image -->
            {{#if EVENT_IMAGE_URL}}
            <div class="mb-8">
                <img src="{{EVENT_IMAGE_URL}}" alt="{{EVENT_NAME}}" class="w-full h-96 object-cover rounded-lg shadow-lg">
            </div>
            {{/if}}

            <!-- Event Details -->
            <div class="grid md:grid-cols-3 gap-8">
                <!-- Main Content -->
                <div class="md:col-span-2">
                    <div class="bg-gray-800/50 p-6 rounded-lg mb-6">
                        <h2 class="text-2xl font-bold text-white mb-4">About This Event</h2>
                        <div class="prose prose-invert max-w-none">
                            <p class="text-gray-300 leading-relaxed">{{EVENT_DESCRIPTION}}</p>
                        </div>
                    </div>

                    {{#if EVENT_CATEGORIES}}
                    <div class="bg-gray-800/50 p-6 rounded-lg mb-6">
                        <h3 class="text-xl font-bold text-white mb-4">Categories</h3>
                        <div class="flex flex-wrap gap-2">
                            {{#each EVENT_CATEGORIES}}
                            <span class="bg-accent-color text-white px-3 py-1 rounded-full text-sm">{{this}}</span>
                            {{/each}}
                        </div>
                    </div>
                    {{/if}}
                </div>

                <!-- Sidebar -->
                <div class="space-y-6">
                    <!-- Event Actions -->
                    <div class="bg-gray-800/50 p-6 rounded-lg">
                        <h3 class="text-xl font-bold text-white mb-4">Event Actions</h3>
                        <div class="space-y-3">
                            <a href="{{GOOGLE_CALENDAR_LINK}}" target="_blank" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                                <i class="fas fa-calendar-plus mr-2"></i>Add to Google Calendar
                            </a>
                            <a href="{{OUTLOOK_CALENDAR_LINK}}" target="_blank" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                                <i class="fas fa-calendar-plus mr-2"></i>Add to Outlook
                            </a>
                            {{#if EVENT_ORGANIZER}}
                            <div class="text-center">
                                <p class="text-gray-400 text-sm">Organized by</p>
                                <p class="text-white font-semibold">{{EVENT_ORGANIZER}}</p>
                            </div>
                            {{/if}}
                        </div>
                    </div>

                    <!-- Event Info -->
                    <div class="bg-gray-800/50 p-6 rounded-lg">
                        <h3 class="text-xl font-bold text-white mb-4">Event Information</h3>
                        <div class="space-y-3">
                            {{#if EVENT_AGE_RESTRICTION}}
                            <div>
                                <p class="text-gray-400 text-sm">Age Restriction</p>
                                <p class="text-white">{{EVENT_AGE_RESTRICTION}}</p>
                            </div>
                            {{/if}}
                            <div>
                                <p class="text-gray-400 text-sm">Event ID</p>
                                <p class="text-white font-mono text-sm">{{EVENT_ID}}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="border-t-2 border-gray-800 p-8 mt-16">
        <div class="container mx-auto text-center">
            <h3 class="font-anton text-3xl leading-tight text-white mb-4">BE SEEN,<br>BE HEARD.</h3>
            <p class="text-gray-400">Birmingham's LGBTQ+ Community Hub</p>
        </div>
    </footer>
</body>
</html>`;

// Helper functions
function formatDate(dateString) {
    if (!dateString) return 'Date TBC';
    
    try {
        const date = new Date(dateString);
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-GB', options);
    } catch (error) {
        return 'Date TBC';
    }
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
    // Extract image URL from various possible formats
    let imageUrl = null;
    
    // 1. First try Cloudinary public ID
    const cloudinaryId = eventData.cloudinaryPublicId;
    if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${cloudinaryId}`;
    } else {
        // 2. Try to find any image field that might contain a Cloudinary URL
        const possibleImageFields = ['image', 'Image', 'Promo Image', 'promoImage'];
        for (const field of possibleImageFields) {
            const imageData = eventData[field];
            if (imageData) {
                // Check if it's already a Cloudinary URL
                if (typeof imageData === 'string' && imageData.includes('cloudinary.com')) {
                    imageUrl = imageData;
                    break;
                }
                // Check if it's an object with a Cloudinary URL
                if (imageData && typeof imageData === 'object' && imageData.url && imageData.url.includes('cloudinary.com')) {
                    imageUrl = imageData.url;
                    break;
                }
            }
        }
        
        // 3. If still no image, generate a consistent placeholder based on event name
        if (!imageUrl) {
            const eventName = eventData.name || 'Event';
            const encodedName = encodeURIComponent(eventName);
            imageUrl = `https://placehold.co/1200x675/1e1e1e/EAEAEA?text=${encodedName}`;
        }
    }
    
    // Process venue data
    let venueData = null;
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
        name: eventData.name || eventData['Event Name'] || 'Unnamed Event',
        slug: eventData.slug || eventData['Event Slug'] || '',
        description: eventData.description || eventData['Description'] || '',
        date: eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : null,
        venue: venueData,
        image: imageUrl ? { url: imageUrl } : null,
        category: eventData.category || eventData['Category'] || [],
        price: eventData.price || eventData['Price'] || null,
        ageRestriction: eventData.ageRestriction || eventData['Age Restriction'] || null,
        organizer: eventData.organizer || eventData['Organizer'] || null,
        cloudinaryPublicId: eventData.cloudinaryPublicId || null
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
    let template = EVENT_TEMPLATE;
    
    // Replace template variables
    const replacements = {
        '{{EVENT_NAME}}': event.name,
        '{{EVENT_DESCRIPTION}}': event.description || 'No description available',
        '{{EVENT_URL}}': `https://www.brumoutloud.co.uk/event/${event.slug}`,
        '{{EVENT_IMAGE_URL}}': event.image ? event.image.url : 'https://placehold.co/1200x675/1e1e1e/EAEAEA?text=Event',
        '{{EVENT_DATE_FORMATTED}}': event.date ? formatDate(event.date) : 'Date TBC',
        '{{EVENT_ID}}': event.id,
        '{{EVENT_VENUE_NAME}}': event.venue ? event.venue.name : '',
        '{{EVENT_VENUE_SLUG}}': event.venue ? event.venue.slug : '',
        '{{EVENT_PRICE}}': event.price || 'Free',
        '{{EVENT_ORGANIZER}}': event.organizer || 'TBC',
        '{{EVENT_AGE_RESTRICTION}}': event.ageRestriction || 'All ages',
        '{{EVENT_CATEGORIES}}': event.category && event.category.length > 0 ? event.category.join(', ') : '',
        '{{GOOGLE_CALENDAR_LINK}}': event.date ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${new Date(event.date).toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.venue ? event.venue.name : '')}` : '#',
        '{{OUTLOOK_CALENDAR_LINK}}': event.date ? `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.name)}&startdt=${new Date(event.date).toISOString()}&enddt=${new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000).toISOString()}&body=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.venue ? event.venue.name : '')}` : '#'
    };
    
    // Apply replacements
    Object.keys(replacements).forEach(key => {
        template = template.replace(new RegExp(key, 'g'), replacements[key]);
    });
    
    return template;
}

async function generateAllEventPages() {
    try {
        if (!firebaseInitialized) {
            console.log('Firebase not initialized. Skipping event page generation.');
            return [];
        }
        
        console.log('Starting event page generation...');
        
        // Fetch all events
        const events = await getAllEvents();
        
        if (events.length === 0) {
            console.log('No events found. No pages will be generated.');
            return [];
        }
        
        console.log(`Generating ${events.length} event pages...`);
        
        // Generate pages for each event
        const generatedPages = [];
        for (const event of events) {
            try {
                const htmlContent = generateEventPage(event);
                const fileName = `${event.slug}.html`;
                
                // In Netlify functions, we can't write to the filesystem
                // So we'll return the content instead
                generatedPages.push({
                    fileName,
                    content: htmlContent,
                    event: event
                });
                
                console.log(`Generated: ${fileName}`);
            } catch (error) {
                console.error(`Failed to generate page for event ${event.slug}:`, error.message);
            }
        }
        
        console.log(`Successfully generated ${generatedPages.length} event pages`);
        return generatedPages;
        
    } catch (error) {
        console.error('Error in event page generation:', error);
        throw error;
    }
}

exports.handler = async function(event, context) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
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
        
        // Generate event pages
        const generatedPages = await generateAllEventPages();
        
        console.log('Event SSG Build: Build script output:', `Generated ${generatedPages.length} event pages`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Event pages built successfully',
                output: `Generated ${generatedPages.length} event pages`,
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