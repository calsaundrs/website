const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

let firebaseInitialized = false;
let db = null;

// Pre-load the full event template once at cold-start
let compiledTemplate = null;

// Embedded template as fallback
const embeddedTemplate = `<!DOCTYPE html>
<html lang="en" class="loaded">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{event.name}} - BrumOutLoud</title>
    <meta name="description" content="{{event.description}}">
    
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
        .venue-card {
            background: rgba(17, 24, 39, 0.5);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(75, 85, 99, 0.2);
            transition: all 0.3s ease;
        }
        .accent-color { color: #E83A99; }
    </style>
</head>
<body class="fouc-prevention bg-gray-900 text-white min-h-screen loaded">
    <!-- Header -->
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="flex items-center text-2xl tracking-widest text-white">
                <span>Brum Outloud</span>
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded" loading="lazy">
            </a>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-8 py-8">
        <div class="venue-card rounded-xl overflow-hidden">
            <!-- Hero Image -->
            <div class="aspect-video bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center relative">
                {{#if event.imageUrl}}
                <img src="{{event.imageUrl}}" alt="{{event.name}}" class="w-full h-full object-cover">
                {{else}}
                <i class="fas fa-image text-6xl text-gray-600"></i>
                {{/if}}
            </div>
            
            <div class="p-8">
                <!-- Event Header -->
                <div class="mb-8">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="text-center w-20 flex-shrink-0">
                            <div class="text-4xl font-bold text-white">{{event.dayOfMonth}}</div>
                            <div class="text-sm text-gray-400">{{event.monthAbbr}}</div>
                        </div>
                        <div class="flex-1">
                            <h1 class="text-4xl font-bold text-white mb-2">{{event.name}}</h1>
                            <p class="text-xl text-gray-300 mb-2">
                                <i class="fas fa-map-marker-alt mr-2 accent-color"></i>
                                {{event.venue.name}}
                            </p>
                            <p class="text-gray-400">
                                <i class="fas fa-clock mr-2"></i>
                                {{event.formattedDate}}
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 mb-6">
                        {{#each event.category}}
                        <span class="inline-block bg-blue-100/20 text-blue-300 text-sm px-3 py-1 rounded-full">{{this}}</span>
                        {{/each}}
                    </div>
                </div>

                <!-- Event Content -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Main Content -->
                    <div class="lg:col-span-2">
                        <div class="venue-card p-6 mb-6">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-info-circle mr-3 accent-color"></i>About This Event
                            </h2>
                            <div class="text-gray-300 leading-relaxed">
                                {{event.description}}
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar -->
                    <div class="space-y-6">
                        <!-- Date & Time -->
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4">
                                <i class="fas fa-calendar mr-2 accent-color"></i>Date & Time
                            </h3>
                            <p class="text-2xl font-semibold text-white">{{event.formattedDate}}</p>
                            <p class="text-xl text-gray-400">{{event.time}}</p>
                        </div>

                        <!-- Location -->
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4">
                                <i class="fas fa-map-marker-alt mr-2 accent-color"></i>Location
                            </h3>
                            <div class="space-y-3">
                                <div>
                                    <h4 class="font-semibold text-white">{{event.venue.name}}</h4>
                                </div>
                                {{#if event.venue.slug}}
                                <a href="/venue/{{event.venue.slug}}" class="bg-gray-600 text-white w-full py-2 px-4 rounded-lg text-sm flex items-center justify-center">
                                    <i class="fas fa-map-marker-alt mr-1"></i>View Venue
                                </a>
                                {{/if}}
                            </div>
                        </div>

                        <!-- Back to Events -->
                        <a href="/events" class="bg-gray-600 text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                            <i class="fas fa-arrow-left mr-2"></i>Back to Events
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </main>
</body>
</html>`;

try {
    // Try multiple possible paths for the template
    const possiblePaths = [
        path.join(__dirname, '..', '..', 'event-template.html'), // Local development
        path.join(process.cwd(), 'event-template.html'), // Netlify build root
        path.join(__dirname, 'event-template.html'), // Same directory
        '/opt/build/repo/event-template.html' // Netlify absolute path
    ];
    
    let templatePath = null;
    let rawTemplate = null;
    
    for (const testPath of possiblePaths) {
        console.log('Testing template path:', testPath);
        if (fs.existsSync(testPath)) {
            templatePath = testPath;
            rawTemplate = fs.readFileSync(templatePath, 'utf8');
            console.log('✅ Found template at:', templatePath);
            break;
        }
    }
    
    if (rawTemplate) {
        compiledTemplate = Handlebars.compile(rawTemplate);
        console.log('✅ Successfully loaded and compiled event-template.html for dynamic rendering');
    } else {
        console.log('Using embedded template as fallback');
        compiledTemplate = Handlebars.compile(embeddedTemplate);
    }
} catch (err) {
    console.error('❌ Could not load full event template, using embedded template:', err.message);
    compiledTemplate = Handlebars.compile(embeddedTemplate);
}

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
    
    // Robust slug generation
    let eventSlug = eventData.slug || '';
    if (!eventSlug && eventName) {
        eventSlug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    const eventDescription = eventData.description || '';
    const eventDate = eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : null;
    
    // Extract image URL using standardized fields
    const imageUrl = eventData.image && eventData.image.length > 0 ? eventData.image[0].url : (eventData.imageUrl || null);
    
    // Correctly process venue data from raw fields
    const venueData = { id: '', name: 'Venue TBC', slug: '' };
    if (eventData.venueName && Array.isArray(eventData.venueName) && eventData.venueName.length > 0) {
        venueData.name = eventData.venueName[0];
    } else if (typeof eventData.venueName === 'string') {
        venueData.name = eventData.venueName;
    }

    if (eventData.venueSlug) {
        venueData.slug = eventData.venueSlug;
    } else if (venueData.name !== 'Venue TBC') {
        venueData.slug = venueData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    
    // Standardize other fields
    const category = eventData.category || [];
    const price = eventData.price || null;
    const ageRestriction = eventData.ageRestriction || null;
    const organizer = eventData.organizer || null;
    const accessibility = eventData.accessibility || null;
    const ticketLink = eventData.ticketLink || null;
    const eventLink = eventData.eventLink || null;
    const facebookEvent = eventData.facebookEvent || null;
    const recurringInfo = eventData.recurringInfo || null;
    const boostedListingStartDate = eventData.boostedListingStartDate || null;
    const boostedListingEndDate = eventData.boostedListingEndDate || null;
    const otherInstances = []; // This field is not directly available in the raw eventData, so it's always empty.

    return {
        id: eventId,
        name: eventName,
        slug: eventSlug,
        description: eventDescription,
        date: eventDate,
        venue: venueData,
        image: imageUrl ? { url: imageUrl } : null,
        category: category,
        price: price,
        ageRestriction: ageRestriction,
        organizer: organizer,
        accessibility: accessibility,
        ticketLink: ticketLink,
        eventLink: eventLink,
        facebookEvent: facebookEvent,
        recurringInfo: recurringInfo,
        boostedListingStartDate: boostedListingStartDate,
        boostedListingEndDate: boostedListingEndDate,
        otherInstances: otherInstances
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
<html lang="en" class="loaded">
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
<body class="loaded">
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

// Enrich event data for template rendering
function enrichEventForTemplate(eventData) {
    const eventDate = eventData.date ? new Date(eventData.date) : null;
    
    // Format date components
    const dayOfMonth = eventDate ? eventDate.getDate() : '';
    const monthAbbr = eventDate ? eventDate.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() : '';
    const formattedDate = eventDate ? eventDate.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    }) : 'Date TBC';
    const time = eventDate ? eventDate.toLocaleTimeString('en-GB', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    }) : '';

    // Generate calendar URLs
    const googleCalendarUrl = eventDate ? generateGoogleCalendarUrl(eventData) : null;
    const icalUrl = eventDate ? generateICalUrl(eventData) : null;
    
    // Check if recurring/boosted
    const isRecurring = !!eventData.recurringInfo;
    const today = new Date();
    const isBoosted = eventData.boostedListingStartDate && eventData.boostedListingEndDate &&
        new Date(eventData.boostedListingStartDate) <= today &&
        new Date(eventData.boostedListingEndDate) >= today;

    return {
        ...eventData,
        dayOfMonth,
        monthAbbr,
        formattedDate,
        time,
        googleCalendarUrl,
        icalUrl,
        isRecurring,
        isBoosted,
        imageUrl: eventData.image?.url || null
    };
}

function generateGoogleCalendarUrl(event) {
    if (!event.date || !event.name) return null;
    
    const startDate = new Date(event.date);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // 3 hours later
    
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.name,
        dates: `${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        details: event.description || '',
        location: event.venue?.name || ''
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function generateICalUrl(event) {
    if (!event.date || !event.name) return null;
    
    const startDate = new Date(event.date);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
    
    const ical = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BrumOutloud//Event//EN',
        'BEGIN:VEVENT',
        `DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `SUMMARY:${event.name}`,
        `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
        `LOCATION:${event.venue?.name || ''}`,
        `URL:https://brumoutloud.co.uk/event/${event.slug}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    
    return `data:text/calendar;charset=utf8,${encodeURIComponent(ical)}`;
}

// Get event by slug
async function getEventBySlug(slug) {
    if (!firebaseInitialized || !db) {
        return null;
    }
    
    try {
        const eventsRef = db.collection('events');
        
        // Try fetching with lowercase 'approved'
        const snapshot = await eventsRef
            .where('slug', '==', slug)
            .where('status', '==', 'approved')
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return processEventForPublic(doc.data(), doc.id);
        }

        // If not found, try fetching with uppercase 'Approved'
        const snapshotUppercase = await eventsRef
            .where('slug', '==', slug)
            .where('Status', '==', 'Approved')
            .limit(1)
            .get();

        if (!snapshotUppercase.empty) {
            const doc = snapshotUppercase.docs[0];
            return processEventForPublic(doc.data(), doc.id);
        }

        // Fallback: try to find the first upcoming event whose slug STARTS WITH the provided slug.
        // This helps when legacy links omit the date suffix (e.g. "/event/bear-all" vs "bear-all-2025-07-19").
        try {
            const today = new Date();
            today.setUTCHours(0,0,0,0);

            // Fetch up to 20 future approved events and search in memory for prefix match
            const rangeSnapshot = await eventsRef
                .where('status', '==', 'approved')
                .limit(40)
                .get();

            for (const doc of rangeSnapshot.docs) {
                const data = doc.data();
                if (typeof data.slug === 'string' && data.slug.startsWith(slug)) {
                    return processEventForPublic(data, doc.id);
                }
            }
        } catch (prefixErr) {
            console.error('Prefix fallback search failed:', prefixErr);
        }

        return null; // Event not found with either status

    } catch (error) {
        console.error('Error fetching event by slug:', error);
        return null;
    }
}

exports.handler = async function(event, context) {
    console.log('Event handler called with event:', JSON.stringify(event, null, 2));
    
    // Get slug from query parameters
    let slug = event.queryStringParameters?.slug;
    if (slug && slug.endsWith('.html')) {
        slug = slug.slice(0, -5);
    }
    
    // If still no slug, attempt to derive from path (/event/<slug> or ...?splat)
    if (!slug) {
        const pathParts = event.rawUrl ? new URL(event.rawUrl).pathname.split('/') : (event.path || '').split('/');
        if (pathParts.length >= 3 && pathParts[1] === 'event') {
            slug = pathParts.slice(2).join('/').replace(/\.html$/, '');
        }
    }

    if (!slug) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/html' },
            body: '<h1>Missing slug parameter</h1>'
        };
    }
    
    console.log('Looking for event with slug:', slug);
    
    // Try to get the event from Firestore
    const eventData = await getEventBySlug(slug);
    
    if (eventData) {
        console.log('Found event:', eventData.name);
        // Enrich event data for template
        const enrichedEvent = enrichEventForTemplate(eventData);
        console.log('Using template compilation:', !!compiledTemplate ? 'Handlebars template' : 'fallback generateEventPage');
        
        // Force use of new template
        if (!compiledTemplate) {
            console.log('Compiling embedded template as fallback');
            compiledTemplate = Handlebars.compile(embeddedTemplate);
        }
        
        const html = compiledTemplate({ event: enrichedEvent });
        
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
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'text/html' },
            body: '<h1>Event Not Found</h1><p>The event you\'re looking for doesn\'t exist.</p>'
        };
    }
}; 