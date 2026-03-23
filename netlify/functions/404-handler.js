const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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
    };
}

// Format date for display (omit time if midnight/missing)
function formatDate(dateString) {
    if (!dateString) return 'Date TBC';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date TBC';
    
    const dateStr = typeof dateString === 'string' ? dateString : '';
    const hasNoTime = !dateStr.includes('T') || dateStr.includes('T00:00');
    
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    if (!hasNoTime) {
        options.hour = 'numeric';
        options.minute = '2-digit';
    }
    
    return date.toLocaleDateString('en-GB', options);
}

// Generate event page HTML using global layout parts
function generateEventPage(event) {
    // Load reusable UI parts
    const headerPath = path.join(process.cwd(), 'global', 'header.html');
    const footerPath = path.join(process.cwd(), 'global', 'footer.html');
    
    let header = '';
    let footer = '';
    
    try {
        header = fs.readFileSync(headerPath, 'utf8');
        footer = fs.readFileSync(footerPath, 'utf8');
    } catch (e) {
        console.warn('Could not load global header/footer, using fallbacks');
    }

    const body = `
    <section class="max-w-4xl mx-auto py-16 px-4">
        <div class="bg-white text-black border-4 border-black shadow-[12px_12px_0_#7a00ff] overflow-hidden">
            <div class="relative h-64 md:h-96">
                <img src="${event.image?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=675&fit=crop'}" 
                     alt="${event.name}" 
                     class="w-full h-full object-cover">
                <div class="absolute bottom-0 left-0 bg-[#ff007f] text-white px-6 py-2 border-r-4 border-t-4 border-black font-syne font-black uppercase text-xl">
                    ${event.category ? event.category[0] : 'EVENT'}
                </div>
            </div>
            
            <div class="p-8 md:p-12">
                <h1 class="font-syne font-black uppercase text-5xl md:text-6xl mb-6 leading-none text-black">${event.name}</h1>
                
                <div class="grid md:grid-cols-2 gap-8 mb-12">
                    <div class="space-y-4">
                        <div class="flex items-center text-xl font-bold">
                            <i class="fas fa-calendar-alt w-10 text-[#7a00ff]"></i>
                            <span>${formatDate(event.date)}</span>
                        </div>
                        <div class="flex items-center text-xl font-bold">
                            <i class="fas fa-map-marker-alt w-10 text-[#7a00ff]"></i>
                            <span>${event.venue?.name || 'Venue TBC'}</span>
                        </div>
                        ${event.price ? `<div class="flex items-center text-xl font-bold">
                            <i class="fas fa-pound-sign w-10 text-[#7a00ff]"></i>
                            <span>${event.price}</span>
                        </div>` : ''}
                    </div>
                </div>

                ${event.description ? `
                <div class="prose prose-xl max-w-none font-medium mb-12">
                    ${event.description}
                </div>` : ''}

                <div class="flex flex-wrap gap-4 pt-8 border-t-4 border-[#f3e8ff]">
                    ${event.ticketLink ? `
                    <a href="${event.ticketLink}" target="_blank" rel="noopener noreferrer" class="bg-[#ccff00] text-black px-8 py-4 font-black uppercase tracking-widest border-4 border-black hover:bg-black hover:text-white transition-all shadow-[4px_4px_0_black]">
                        GET TICKETS
                    </a>` : ''}
                    <a href="/events" class="bg-white text-black px-8 py-4 font-black uppercase tracking-widest border-4 border-black hover:bg-[#7a00ff] hover:text-white transition-all shadow-[4px_4px_0_black]">
                        BACK TO EVENTS
                    </a>
                </div>
            </div>
        </div>
    </section>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${event.name} | Brum Outloud</title>
    <meta name="description" content="${event.description?.substring(0, 160) || 'Event details'}">
    <meta property="og:title" content="${event.name}">
    <meta property="og:description" content="${event.description?.substring(0, 160) || 'Event details'}">
    <meta property="og:type" content="event">
    <meta property="og:image" content="${event.image?.url || ''}">
    
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="/js/fouc-prevention.js"></script>
</head>
<body class="antialiased fouc-prevention">
    ${header}
    <main>${body}</main>
    ${footer}
    <script src="/js/main.js" defer></script>
</body>
</html>`;
}

// Get event by slug
async function getEventBySlug(slug) {
    if (!firebaseInitialized || !db) {
        return null;
    }
    
    try {
        const snapshot = await db.collection('events')
            .where('slug', '==', slug)
            .where('status', '==', 'approved')
            .limit(1)
            .get();
        
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return processEventForPublic(doc.data(), doc.id);
    } catch (error) {
        console.error('Error fetching event by slug:', error);
        return null;
    }
}

exports.handler = async function(event, context) {
    const pathValue = event.path || (event.queryStringParameters && event.queryStringParameters.path) || '';
    
    if (pathValue.startsWith('/event/')) {
        const slug = pathValue.replace('/event/', '');
        const eventData = await getEventBySlug(slug);
        
        if (eventData) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' },
                body: generateEventPage(eventData)
            };
        }
    }
    
    // Return the static 404 page
    try {
        const static404Path = path.join(process.cwd(), '404.html');
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'text/html' },
            body: fs.readFileSync(static404Path, 'utf8')
        };
    } catch (error) {
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'text/html' },
            body: '<h1>404 - Page Not Found</h1>'
        };
    }
};