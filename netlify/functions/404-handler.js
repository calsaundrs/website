const admin = require('firebase-admin');

let firebaseInitialized = false;
let db = null;

// Initialize Firebase if credentials are available
try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
        }
        firebaseInitialized = true;
        db = admin.firestore();
    }
} catch (error) {
    console.error('Firebase initialization failed:', error.message);
}

// Process event data for public display
function processEventForPublic(eventData, eventId) {
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
        let venueName = 'Venue TBC';
        if (eventData.venueName) {
            if (Array.isArray(eventData.venueName)) {
                venueName = eventData.venueName[0] || 'Venue TBC';
            } else {
                venueName = eventData.venueName;
            }
        }
        
        let venueSlug = '';
        if (eventData.venueSlug) {
            if (Array.isArray(eventData.venueSlug)) {
                venueSlug = eventData.venueSlug[0] || '';
            } else {
                venueSlug = eventData.venueSlug;
            }
        }
        
        venueData = {
            id: eventData.venueId,
            name: venueName,
            slug: venueSlug
        };
    } else if (eventData.venue) {
        venueData = {
            id: eventData.venue.id || '',
            name: eventData.venue.name || 'Venue TBC',
            slug: eventData.venue.slug || ''
        };
    }
    
    return {
        id: eventId,
        name: eventName,
        slug: eventSlug,
        description: eventDescription,
        date: eventDate,
        venue: venueData,
        image: imageUrl ? { url: imageUrl } : null,
        category: eventData.category || ['Event'],
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
        otherInstances: []
    };
}

// Format date for display
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

// Generate event page HTML
function generateEventPage(event) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${event.name} - BrumOutLoud</title>
    <meta name="description" content="${event.description || 'Event details'}">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${event.name}">
    <meta property="og:description" content="${event.description || 'Event details'}">
    <meta property="og:type" content="event">
    <meta property="og:url" content="https://brumoutloud.co.uk/event/${event.slug}">
    <meta property="og:image" content="${event.image?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop&crop=center&auto=format&q=80'}">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${event.name}">
    <meta name="twitter:description" content="${event.description || 'Event details'}">
    <meta name="twitter:image" content="${event.image?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop&crop=center&auto=format&q=80'}">
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    
    <!-- Styles -->
    <link rel="stylesheet" href="/css/tailwind.css">
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
        .bg-accent-color { background-color: #E83A99; }
        .border-accent-color { border-color: #E83A99; }
        .accent-color-secondary { color: #8B5CF6; }
        .bg-accent-color-secondary { background-color: #8B5CF6; }
        .card-bg {
            background: rgba(17, 24, 39, 0.7);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(75, 85, 99, 0.3);
            border-radius: 1.25rem;
        }
        .event-card {
            background: rgba(31, 41, 55, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(75, 85, 99, 0.3);
            border-radius: 1rem;
        }
        .btn-primary {
            background: linear-gradient(135deg, #E83A99 0%, #8B5CF6 100%);
            border: 1px solid rgba(232, 58, 153, 0.3);
            transition: all 0.3s ease;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #D61F69 0%, #7C3AED 100%);
            transform: translateY(-1px);
        }
        .btn-secondary {
            background: rgba(75, 85, 99, 0.3);
            border: 1px solid rgba(75, 85, 99, 0.5);
            transition: all 0.3s ease;
        }
        .btn-secondary:hover {
            background: rgba(75, 85, 99, 0.5);
        }
        .heading-gradient {
            background: linear-gradient(135deg, #FFFFFF 0%, #E83A99 50%, #8B5CF6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
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
            <div class="card-bg p-8 mb-8">
                <div class="flex flex-col lg:flex-row gap-8">
                    <!-- Event Image -->
                    <div class="lg:w-1/3">
                        <img src="${event.image?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop&crop=center&auto=format&q=80'}" 
                             alt="${event.name}" 
                             class="w-full h-64 object-cover rounded-lg">
                    </div>
                    
                    <!-- Event Info -->
                    <div class="lg:w-2/3">
                        <h1 class="font-anton text-4xl lg:text-5xl heading-gradient mb-4">${event.name}</h1>
                        
                        <div class="space-y-4 mb-6">
                            ${event.date ? `<div class="flex items-center text-lg">
                                <i class="fas fa-calendar-alt text-accent-color mr-3"></i>
                                <span>${formatDate(event.date)}</span>
                            </div>` : ''}
                            
                            ${event.venue?.name ? `<div class="flex items-center text-lg">
                                <i class="fas fa-map-marker-alt text-accent-color mr-3"></i>
                                <span>${event.venue.name}</span>
                            </div>` : ''}
                            
                            ${event.category && event.category.length > 0 ? `<div class="flex items-center text-lg">
                                <i class="fas fa-tags text-accent-color mr-3"></i>
                                <span>${event.category.join(', ')}</span>
                            </div>` : ''}
                        </div>
                        
                        <div class="flex flex-wrap gap-3">
                            ${event.ticketLink ? `<a href="${event.ticketLink}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white px-6 py-3 rounded-lg font-bold">
                                <i class="fas fa-ticket-alt mr-2"></i>Get Tickets
                            </a>` : ''}
                            
                            <a href="/events" class="btn-secondary text-white px-6 py-3 rounded-lg font-bold">
                                <i class="fas fa-arrow-left mr-2"></i>Back to Events
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Event Description -->
            ${event.description ? `<div class="card-bg p-8 mb-8">
                <h2 class="font-anton text-2xl heading-gradient mb-4">About This Event</h2>
                <p class="text-lg leading-relaxed">${event.description}</p>
            </div>` : ''}
            
            <!-- Event Details -->
            <div class="card-bg p-8">
                <h2 class="font-anton text-2xl heading-gradient mb-6">Event Details</h2>
                <div class="grid md:grid-cols-2 gap-6">
                    ${event.date ? `<div class="flex items-center">
                        <i class="fas fa-calendar-alt text-accent-color mr-3 text-xl"></i>
                        <div>
                            <div class="font-semibold">Date & Time</div>
                            <div>${formatDate(event.date)}</div>
                        </div>
                    </div>` : ''}
                    
                    ${event.venue?.name ? `<div class="flex items-center">
                        <i class="fas fa-map-marker-alt text-accent-color mr-3 text-xl"></i>
                        <div>
                            <div class="font-semibold">Venue</div>
                            <div>${event.venue.name}</div>
                        </div>
                    </div>` : ''}
                    
                    ${event.price ? `<div class="flex items-center">
                        <i class="fas fa-pound-sign text-accent-color mr-3 text-xl"></i>
                        <div>
                            <div class="font-semibold">Price</div>
                            <div>${event.price}</div>
                        </div>
                    </div>` : ''}
                    
                    ${event.ageRestriction ? `<div class="flex items-center">
                        <i class="fas fa-users text-accent-color mr-3 text-xl"></i>
                        <div>
                            <div class="font-semibold">Age Restriction</div>
                            <div>${event.ageRestriction}</div>
                        </div>
                    </div>` : ''}
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="border-t-2 border-gray-800 p-8 mt-16">
        <div class="container mx-auto text-center">
            <h3 class="font-anton text-3xl leading-tight text-white mb-4">BE SEEN,<br>BE HEARD.</h3>
        </div>
    </footer>
</body>
</html>`;
}

// Get event by slug
async function getEventBySlug(slug) {
    if (!firebaseInitialized || !db) {
        return null;
    }
    
    try {
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('slug', '==', slug)
            .where('status', '==', 'approved')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return null;
        }
        
        const doc = snapshot.docs[0];
        return processEventForPublic(doc.data(), doc.id);
    } catch (error) {
        console.error('Error fetching event by slug:', error);
        return null;
    }
}

exports.handler = async function(event, context) {
    console.log('404 handler called with event:', JSON.stringify(event, null, 2));
    
    // Get path from multiple possible sources
    let path = event.path;
    if (event.queryStringParameters && event.queryStringParameters.path) {
        path = event.queryStringParameters.path;
    }
    
    console.log('Processing path:', path);
    
    // Check if this is an event URL
    if (path && path.startsWith('/event/')) {
        const slug = path.replace('/event/', '');
        console.log('Extracted slug:', slug);
        
        // Try to get the event from Firestore
        const eventData = await getEventBySlug(slug);
        console.log('Event data found:', eventData ? 'yes' : 'no');
        
        if (eventData) {
            console.log('Generating event page for:', eventData.name);
            // Generate and return the event page
            const html = generateEventPage(eventData);
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
                },
                body: html
            };
        } else {
            console.log('No event found for slug:', slug);
        }
    } else {
        console.log('Path does not start with /event/:', path);
    }
    
    // If not an event or event not found, return the static 404 page
    try {
        const fs = require('fs');
        const path = require('path');
        const static404Path = path.join(process.cwd(), '404.html');
        const static404Content = fs.readFileSync(static404Path, 'utf8');
        
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'text/html'
            },
            body: static404Content
        };
    } catch (error) {
        console.error('Error reading static 404 page:', error);
        // Fallback 404 response
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'text/html'
            },
            body: `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Page Not Found</title>
                </head>
                <body>
                    <h1>Page Not Found</h1>
                    <p>The page you're looking for doesn't exist.</p>
                    <a href="/">Go Home</a>
                </body>
                </html>
            `
        };
    }
}; 