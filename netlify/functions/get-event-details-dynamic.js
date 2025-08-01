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
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="{{event.name}}">
    <meta property="og:description" content="{{event.description}}">
    <meta property="og:type" content="event">
    <meta property="og:url" content="https://brumoutloud.co.uk/event/{{event.slug}}">
    <meta property="og:image" content="{{event.imageUrl}}">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{event.name}}">
    <meta name="twitter:description" content="{{event.description}}">
    <meta name="twitter:image" content="{{event.imageUrl}}">
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    
    <!-- Styles -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    
    <style>
        /* Base Styles */
        body {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a0d2e 50%, #0a0a0a 100%);
            color: #EAEAEA;
            font-family: 'Poppins', sans-serif;
            min-height: 100vh;
        }
        .font-anton {
            font-family: 'Anton', sans-serif;
            letter-spacing: 0.05em;
        }

        /* Updated Core Colour Palette Classes */
        .accent-color { color: #E83A99; }
        .bg-accent-color { background-color: #E83A99; }
        .border-accent-color { border-color: #E83A99; }
        .accent-color-secondary { color: #8B5CF6; }
        .bg-accent-color-secondary { background-color: #8B5CF6; }

        /* Modern Glassmorphism Components */
        .card-bg {
            background: rgba(17, 24, 39, 0.7);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(75, 85, 99, 0.3);
            border-radius: 1.25rem;
        }

        .venue-card, .submission-card, .result-card {
            background: rgba(17, 24, 39, 0.5);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(75, 85, 99, 0.2);
            transition: all 0.3s ease;
        }
        .venue-card:hover, .submission-card:hover, .result-card:hover {
            transform: translateY(-2px);
            border-color: rgba(232, 58, 153, 0.3);
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

        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .status-badge.approved {
            background: rgba(16, 185, 129, 0.2);
            color: #10B981;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
    </style>
    
    <!-- FOUC Prevention Script -->
    <script src="/js/fouc-prevention.js"></script>
</head>
<body class="fouc-prevention bg-gray-900 text-white min-h-screen loaded">
    <!-- Header -->
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="flex items-center text-2xl tracking-widest text-white" style="font-family: 'Omnes Pro', sans-serif;">
                <span>Brum Outloud</span>
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded" loading="lazy">
            </a>
            <div class="hidden lg:flex items-center space-x-8">
                <a class='text-gray-300 hover:text-white' href='/events'>WHAT'S ON</a>
                <a class='text-gray-300 hover:text-white' href='/all-venues'>VENUES</a>
                <a class='text-gray-300 hover:text-white' href='/community'>COMMUNITY</a>
                <a class='text-gray-300 hover:text-white' href='/contact'>CONTACT</a>
                <a class='inline-block bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200' href='/promoter-tool'>GET LISTED</a>
            </div>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-8 py-8">
        <div class="venue-card rounded-xl overflow-hidden">
            <!-- Hero Image -->
            <div class="aspect-[2/1] bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center overflow-hidden">
                <img src="{{event.imageUrl}}" alt="{{event.name}}" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=600&fit=crop&crop=center&auto=format&q=80'">
                <div class="absolute top-4 right-4">
                    <button onclick="shareEvent()" class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                        <i class="fas fa-share mr-1"></i>Share
                    </button>
                </div>
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
                                <i class="fas fa-map-marker-alt mr-2 text-accent-color"></i>
                                {{event.venue.name}}
                            </p>
                            <p class="text-gray-400">
                                <i class="fas fa-clock mr-2"></i>
                                {{event.formattedDate}} • {{event.time}}
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
                        <div class="venue-card p-6 mb-6 rounded-xl">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-info-circle mr-3 text-accent-color"></i>About This Event
                            </h2>
                            <div class="text-gray-300 leading-relaxed">
                                {{{event.formattedDescription}}}
                            </div>
                        </div>

                        {{#if event.otherInstances}}
                        <!-- Other Events in Series -->
                        <div class="venue-card p-6 mb-6 rounded-xl">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-calendar mr-3 text-accent-color"></i>Other Events in this Series
                            </h2>
                            <div class="space-y-4">
                                {{#each event.otherInstances}}
                                <a href="/event/{{this.slug}}" class="venue-card p-4 flex items-center space-x-4 hover:bg-gray-800 transition-colors duration-200 block rounded-lg">
                                    <div class="text-center w-20 flex-shrink-0">
                                        <p class="text-2xl font-bold text-white">{{this.dayOfMonth}}</p>
                                        <p class="text-lg text-gray-400">{{this.monthAbbr}}</p>
                                    </div>
                                    <div class="flex-grow">
                                        <h4 class="font-bold text-white text-xl">{{this.name}}</h4>
                                        <p class="text-sm text-gray-400">{{this.time}}</p>
                                    </div>
                                    <div class="text-accent-color">
                                        <i class="fas fa-arrow-right"></i>
                                    </div>
                                </a>
                                {{/each}}
                            </div>
                        </div>
                        {{/if}}
                    </div>

                    <!-- Sidebar -->
                    <div class="space-y-6">

                        {{#if event.ticketLink}}
                        <!-- Action Buttons -->
                        <div class="venue-card p-6 rounded-xl">
                            <div class="space-y-3">
                                <a href="{{event.ticketLink}}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold flex items-center justify-center">
                                    <i class="fas fa-ticket-alt mr-2"></i>Get Tickets / Info
                                </a>
                            </div>
                        </div>
                        {{/if}}

                        <!-- Add to Calendar -->
                        <div class="venue-card p-6 rounded-xl">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-calendar-plus mr-2 text-accent-color"></i>Add to Calendar
                            </h3>
                            <div class="space-y-3">
                                {{#if event.googleCalendarUrl}}
                                <a href="{{event.googleCalendarUrl}}" target="_blank" rel="noopener noreferrer" class="btn-secondary text-white w-full py-2 px-4 rounded-lg text-sm flex items-center justify-center">
                                    <i class="fab fa-google mr-2"></i>Google Calendar
                                </a>
                                {{/if}}
                                {{#if event.icalUrl}}
                                <a href="{{event.icalUrl}}" download="{{event.slug}}.ics" class="btn-secondary text-white w-full py-2 px-4 rounded-lg text-sm flex items-center justify-center">
                                    <i class="fas fa-calendar-plus mr-2"></i>Apple/Outlook/Other
                                </a>
                                {{/if}}
                            </div>
                        </div>

                        <!-- Share Event -->
                        <div class="venue-card p-6 rounded-xl">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-share-alt mr-2 text-accent-color"></i>Share This Event
                            </h3>
                            <button onclick="shareEvent()" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold">
                                <i class="fas fa-share-alt mr-2"></i>Share Event
                            </button>
                        </div>



                        <!-- Back to Events -->
                        <a href="/events" class="btn-secondary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                            <i class="fas fa-arrow-left mr-2"></i>Back to Events
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="border-t-2 border-gray-800 p-8 mt-16">
        <div class="container mx-auto grid md:grid-cols-2">
            <div>
                <h3 class="font-anton text-5xl leading-tight text-white">BE SEEN,<br>BE HEARD.</h3>
                <div class="flex space-x-6 text-2xl mt-6 text-gray-400">
                    <a href="https://www.instagram.com/brumoutloud/" target="_blank" rel="noopener noreferrer" class="hover:text-pink-400 transition-colors"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-8 mt-8 md:mt-0">
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">Explore</h4>
                    <ul>
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/events'>Events</a></li>
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/all-venues'>Venues</a></li>
                        <li class="mb-2"><a href="/promoter-tool" class="text-gray-400 hover:text-white transition-colors">Promoter Tools</a></li>
                        <li class="mb-2"><a href="/admin/settings" class="text-gray-400 hover:text-white transition-colors">ADMIN</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">About</h4>
                    <ul>
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/community'>Community & FAQ</a></li>
                        <li class="mb-2"><a href="/contact" class="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/privacy-policy'>Privacy Policy</a></li>
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/terms-and-conditions'>Terms and Conditions</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>

    <script>
        // Share functionality
        function shareEvent() {
            if (navigator.share) {
                navigator.share({
                    title: '{{event.name}} - BrumOutLoud',
                    text: '{{event.description}}',
                    url: window.location.href
                }).catch(console.error);
            } else {
                // Fallback to clipboard
                navigator.clipboard.writeText(window.location.href).then(() => {
                    alert('Event link copied to clipboard!');
                }).catch(() => {
                    // Further fallback
                    const textArea = document.createElement('textarea');
                    textArea.value = window.location.href;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Event link copied to clipboard!');
                });
            }
        }
    </script>
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

// Enrich event data for template rendering
async function enrichEventForTemplate(eventData, event) {
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

    // Fetch image URL from events listing API to ensure consistency
    let imageUrl = null;
    
    try {
        // Call the events listing API to get the same event and use its image URL
        const eventsResponse = await fetch(`https://${event.headers.host}/.netlify/functions/get-events-firestore-simple?limit=50`);
        if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            const matchingEvent = eventsData.events?.find(e => e.slug === eventData.slug || e.id === eventData.id);
            if (matchingEvent && matchingEvent.image?.url) {
                imageUrl = matchingEvent.image.url;
                console.log('Found matching event in listing API with image:', imageUrl);
            }
        }
    } catch (error) {
        console.log('Failed to fetch from events listing API:', error.message);
    }
    
    if (!imageUrl) {
        // Fallback to original logic if API call fails
        if (eventData.image) {
            imageUrl = typeof eventData.image === 'string' ? eventData.image : eventData.image.url;
                 } else if (eventData.airtableId && process.env.CLOUDINARY_CLOUD_NAME) {
             imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_90,w_1600,h_900,c_fill,fl_progressive/brumoutloud_events/event_${eventData.airtableId}`;
         } else if (eventData.id && eventData.id.startsWith('rec') && process.env.CLOUDINARY_CLOUD_NAME) {
             imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_90,w_1600,h_900,c_fill,fl_progressive/brumoutloud_events/event_${eventData.id}`;
        } else {
            imageUrl = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=600&fit=crop&crop=center&auto=format&q=80';
        }
    }

    // Format description with line breaks
    const formattedDescription = eventData.description ? 
        eventData.description.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>') : 
        '';

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
        imageUrl,
        formattedDescription
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
        
        // Try exact slug match first
        let snapshot = await eventsRef
            .where('slug', '==', slug)
            .where('status', '==', 'approved')
            .limit(1)
            .get();
        
        // Also try uppercase Status field
        if (snapshot.empty) {
            snapshot = await eventsRef
                .where('slug', '==', slug)
                .where('Status', '==', 'Approved')
                .limit(1)
                .get();
        }
        
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const eventData = doc.data();
            console.log("Found event by exact slug:", eventData.name);
            return processEventData({
                id: doc.id,
                ...eventData
            });
        }
        
        // Fallback: partial slug match
        snapshot = await eventsRef
            .where('status', '==', 'approved')
            .orderBy('date', 'desc')
            .limit(40)
            .get();
        
        if (snapshot.empty) {
            // Try uppercase Status
            snapshot = await eventsRef
                .where('Status', '==', 'Approved')
                .orderBy('date', 'desc')
                .limit(40)
                .get();
        }
        
        const docs = snapshot.docs;
        for (const doc of docs) {
            const eventData = doc.data();
            if (eventData.slug && eventData.slug.startsWith(slug)) {
                console.log("Found event by partial slug match:", eventData.name);
                return processEventData({
                    id: doc.id,
                    ...eventData
                });
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching event by slug:', error);
        return null;
    }
}

function processEventData(rawData) {
    console.log("Processing raw event data:", rawData.name, "Raw data keys:", Object.keys(rawData));
    
    // Handle venue data - could be array or string
    let venueName = 'Venue TBC';
    let venueSlug = '';
    
    if (rawData.venueName) {
        venueName = Array.isArray(rawData.venueName) ? rawData.venueName[0] : rawData.venueName;
    } else if (rawData['Venue Name']) {
        venueName = Array.isArray(rawData['Venue Name']) ? rawData['Venue Name'][0] : rawData['Venue Name'];
    }
    
    if (rawData.venueSlug) {
        venueSlug = rawData.venueSlug;
    } else if (rawData['Venue Slug']) {
        venueSlug = rawData['Venue Slug'];
    }
    
    // Handle categories - ensure it's an array
    let categories = [];
    if (rawData.category) {
        categories = Array.isArray(rawData.category) ? rawData.category : [rawData.category];
    } else if (rawData.Category) {
        categories = Array.isArray(rawData.Category) ? rawData.Category : [rawData.Category];
    }
    
    return {
        id: rawData.id,
        name: rawData.name || rawData['Event Name'] || 'Untitled Event',
        slug: rawData.slug || rawData['Slug'] || '',
        description: rawData.description || rawData['Description'] || '',
        date: rawData.date || rawData['Date'] || null,
        category: categories,
        venue: {
            name: venueName,
            slug: venueSlug
        },
        // Handle image data - could be string or object
        image: rawData.image || rawData['Image'] || null,
        airtableId: rawData.airtableId || rawData['Airtable ID'] || null,
        price: rawData.price || rawData['Price'] || null,
        link: rawData.link || rawData['Link'] || null,
        ticketLink: rawData.ticketLink || rawData['Ticket Link'] || null,
        recurringInfo: rawData.recurringInfo || rawData['Recurring Info'] || null,
        boostedListingStartDate: rawData.boostedListingStartDate || null,
        boostedListingEndDate: rawData.boostedListingEndDate || null
    };
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
    
    // Get the event data
    const eventData = await getEventBySlug(slug);
    
    if (!eventData) {
        console.log("Event not found for slug:", slug);
        return {
            statusCode: 404,
            body: 'Event not found'
        };
    }

    console.log("Event data retrieved:", eventData.name);

    // Enrich event data for template
            const enrichedEvent = await enrichEventForTemplate(eventData, event);

    console.log("Enriched event data:", {
        name: enrichedEvent.name,
        hasDescription: !!enrichedEvent.description,
        hasImage: !!enrichedEvent.imageUrl,
        venueInfo: enrichedEvent.venue
    });

    // Force use of embedded template
    console.log('Compiling embedded template');
    const compiledTemplate = Handlebars.compile(embeddedTemplate);
    
    const html = compiledTemplate({ event: enrichedEvent });

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=300'
        },
        body: html
    };
}; 