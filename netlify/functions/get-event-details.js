const FirestoreEventService = require('./services/firestore-event-service');
const RecurringEventsManager = require('./services/recurring-events-manager');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Version: 2026-03-22-v2 - Redesigned event detail page layout

const eventService = new FirestoreEventService();
const recurringManager = new RecurringEventsManager();

/**
 * Converts a date object to an ISO string suitable for ICS files (YYYYMMDDTHHMMSSZ).
 * @param {Date} date The date to convert.
 * @returns {string} The formatted date string.
 */
function toICSDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generates a Data URI for an .ics file. This works server-side.
 * @param {object} event The event data object.
 * @returns {string} A Data URI containing the ICS file content.
 */
function generateIcsDataURI(eventData) {
    const { name, description, venue, date } = eventData;
    
    // Validate date and provide fallback
    let eventDate;
    try {
        eventDate = new Date(date);
        if (isNaN(eventDate.getTime())) {
            console.warn('Invalid date for event in ICS:', name, 'date:', date);
            eventDate = new Date(); // Fallback to current date
        }
    } catch (error) {
        console.warn('Error parsing date for event in ICS:', name, 'date:', date, 'error:', error.message);
        eventDate = new Date(); // Fallback to current date
    }
    
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
    
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BrumOutloud//EN',
        'BEGIN:VEVENT',
        'UID:' + new Date().getTime() + ' @brumoutloud.co.uk',
        'DTSTAMP:' + toICSDate(new Date()),
        'DTSTART:' + toICSDate(eventDate),
        'DTEND:' + toICSDate(endDate),
        'SUMMARY:' + name,
        'DESCRIPTION:' + (description || '').replace(/\n/g, '\\n'),
        'LOCATION:' + venue.name,
        'END:VEVENT',
        'END:VCALENDAR'
    ];
    const icsString = icsContent.join('\r\n');
    return 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsString);
}

function generateCalendarLinks(eventData) {
    const { name, description, venue, date } = eventData;
    
    // Validate date and provide fallback
    let eventDate;
    try {
        eventDate = new Date(date);
        if (isNaN(eventDate.getTime())) {
            console.warn('Invalid date for event:', name, 'date:', date);
            eventDate = new Date(); // Fallback to current date
        }
    } catch (error) {
        console.warn('Error parsing date for event:', name, 'date:', date, 'error:', error.message);
        eventDate = new Date(); // Fallback to current date
    }
    
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    
    // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ format)
    const formatDateForGoogle = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const googleLink = 'https://www.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(name) + '&dates=' + formatDateForGoogle(eventDate) + '/' + formatDateForGoogle(endDate) + '&details=' + encodeURIComponent(description || '') + '&location=' + encodeURIComponent(venue.name);
    
    return {
        google: googleLink,
        ical: generateIcsDataURI(eventData)
    };
}

exports.handler = async function (event, context) {
    console.log("get-event-details function called");
    console.log("Event path:", event.path);
    console.log("Event queryStringParameters:", event.queryStringParameters);
    
    // Extract slug from query parameters (as configured in netlify.toml)
    let slug = event.queryStringParameters?.slug;
    
    // Fallback: try to extract from path if not in query params
    if (!slug) {
        slug = event.path.split("/").pop();
    }
    
    console.log("Extracted slug:", slug);
    
    if (!slug) {
        console.log("No slug provided");
        return { 
            statusCode: 400, 
            body: 'Error: Event slug not provided.' 
        };
    }

    try {
        console.log("Attempting to fetch event with slug:", slug);
        
        // Use the new Firestore service to get event data
        const eventData = await eventService.getEventBySlug(slug);
        
        if (!eventData) {
            console.log("No event found with slug:", slug);
            return { 
                statusCode: 404, 
                body: 'Event not found.' 
            };
        }

        console.log("Event found:", eventData.name);
        console.log("Event date:", eventData.date, "Type:", typeof eventData.date);
        console.log("Event description:", eventData.description);
        console.log("Event details:", eventData.details);
        console.log("Description length:", eventData.description ? eventData.description.length : 0);
        console.log("Description type:", typeof eventData.description);
        console.log("Details type:", typeof eventData.details);

        // Get other instances if this is a recurring event
        let otherInstances = [];
        if (eventData.isRecurring && eventData.recurringGroupId) {
            try {
                const instances = await recurringManager.getRecurringSeriesInstances(
                    eventData.recurringGroupId, 
                    { limit: 6, futureOnly: true }
                );
                otherInstances = instances.filter(instance => 
                    instance.id !== eventData.id
                );
            } catch (error) {
                console.error('Error getting recurring instances:', error);
            }
        }

        // Get similar events based on categories
        let similarEvents = [];
        if (eventData.category && eventData.category.length > 0) {
            try {
                similarEvents = await eventService.getSimilarEvents(
                    eventData.category, 
                    eventData.id, 
                    3
                );
            } catch (error) {
                console.error('Error getting similar events:', error);
            }
        }

                // Use embedded template matching the design system
        const templateContent = `<!DOCTYPE html>
<html lang="en">
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
    {{#if event.image}}
    <meta property="og:image" content="{{event.image.url}}">
    {{/if}}
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{event.name}}">
    <meta name="twitter:description" content="{{event.description}}">
    {{#if event.image}}
    <meta name="twitter:image" content="{{event.image.url}}">
    {{/if}}
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    
    <!-- Styles -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    
    <style>
        :root {
            --color-bg: #0D0115;
            --color-light: #f3e8ff;
            --color-toxic: #CCFF00;
            --color-purple: #9B5DE5;
            --color-pink: #E83A99;
        }
        body {
            background: var(--color-bg);
            color: var(--color-light);
            font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
            min-height: 100vh;
            margin: 0;
            padding: 0;
        }
        .font-display { font-family: 'Syne', sans-serif; }
        .misprint { letter-spacing: -0.03em; line-height: 0.95; }

        .progress-pride-bg {
            background: linear-gradient(90deg, #000000 0%, #784F17 8%, #55CDFC 16%, #F7A8B8 24%, #FFFFFF 32%, #FFF430 40%, #FF8C00 48%, #E40303 56%, #FF8C00 64%, #FFF430 72%, #008026 80%, #004DFF 88%, #750787 100%);
        }

        .neo-card {
            background-color: #000000;
            border: 4px solid var(--color-light);
            box-shadow: 6px 6px 0 var(--color-purple);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .neo-card:hover {
            transform: translate(-2px, -2px);
            box-shadow: 10px 10px 0 var(--color-pink);
        }

        .btn-neo {
            background: var(--color-toxic);
            color: #000;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border: 3px solid var(--color-light);
            box-shadow: 4px 4px 0 var(--color-purple);
            transition: all 0.2s ease;
            padding: 0.75rem 1.5rem;
            cursor: pointer;
        }
        .btn-neo:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0 var(--color-pink);
        }

        .btn-outline {
            background: transparent;
            color: var(--color-light);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border: 3px solid var(--color-light);
            padding: 0.75rem 1.5rem;
            transition: all 0.2s ease;
            cursor: pointer;
        }
        .btn-outline:hover {
            background: var(--color-purple);
            border-color: var(--color-purple);
        }

        .sticker {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border: 2px solid currentColor;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            transform: rotate(-2deg);
        }

        .category-tag {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border: 2px solid var(--color-toxic);
            color: var(--color-toxic);
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        /* Add bottom padding on mobile when sticky ticket bar is visible */
        @media (max-width: 1023px) {
            body.has-ticket-bar { padding-bottom: 5rem; }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="sticky top-0 z-[100] transition-all duration-300">
        <nav class="bg-black pt-4 px-4 pb-5 flex justify-between items-center relative z-10 shadow-[4px_4px_0_var(--color-toxic)]">
            <div class="absolute bottom-0 left-0 w-full h-[6px] progress-pride-bg"></div>
            <div class="font-display font-black text-2xl md:text-3xl misprint leading-none flex items-center">
                <a href="/" class="hover:opacity-80 transition-opacity">BRUM<br><span class="text-[var(--color-purple)]">OUT</span>LOUD</a>
            </div>
            <div class="hidden lg:flex items-center space-x-8 font-bold text-sm uppercase tracking-widest">
                <a href="/events" class="hover:text-[var(--color-toxic)] transition-colors">WHAT'S ON</a>
                <a href="/all-venues" class="hover:text-[var(--color-toxic)] transition-colors">VENUES</a>
                <a href="/clubs" class="hover:text-[var(--color-toxic)] transition-colors">CLUBS</a>
                <a href="/birmingham-pride" class="hover:text-[var(--color-toxic)] transition-colors">PRIDE</a>
                <a href="/community" class="hover:text-[var(--color-toxic)] transition-colors">COMMUNITY</a>
                <a href="/contact" class="hover:text-[var(--color-toxic)] transition-colors">CONTACT</a>
                <a href="/promoter-submit-new" class="sticker bg-[var(--color-toxic)] !text-black text-sm hover:bg-white transition-colors">GET LISTED</a>
            </div>
            <div class="lg:hidden relative z-[60]">
                <button id="menu-btn" class="text-white text-2xl">
                    <i class="fas fa-bars"></i>
                </button>
            </div>
        </nav>
        <div id="menu" class="hidden lg:hidden fixed inset-0 bg-black z-50 flex flex-col items-center justify-center space-y-6">
            <a href="/events" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">WHAT'S ON</a>
            <a href="/all-venues" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">VENUES</a>
            <a href="/clubs" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">CLUBS</a>
            <a href="/birmingham-pride" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">PRIDE</a>
            <a href="/community" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">COMMUNITY</a>
            <a href="/contact" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">CONTACT</a>
            <a href="/promoter-submit-new" class="block mt-4 sticker bg-[var(--color-toxic)] !text-black text-2xl">GET LISTED</a>
        </div>
    </header>

    <!-- Top Bar: Key Info -->
    <section class="max-w-5xl mx-auto px-6 md:px-12 pt-8">
        <!-- Breadcrumb -->
        <nav class="mb-6 text-sm font-bold uppercase tracking-widest">
            <a href="/events" class="text-gray-400 hover:text-[var(--color-toxic)] transition-colors">What's On</a>
            <span class="text-gray-600 mx-2">/</span>
            <span class="text-[var(--color-toxic)]">Event</span>
        </nav>

        <!-- Category Tags -->
        <div class="flex flex-wrap gap-2 mb-4">
            {{{categoryTags}}}
        </div>

        <!-- Title -->
        <h1 class="text-4xl md:text-5xl lg:text-7xl font-black text-white uppercase font-display misprint leading-[0.9] mb-6">{{event.name}}</h1>

        <!-- Key Info Strip -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-lg mb-6">
            <span class="text-[var(--color-toxic)] font-bold">
                <i class="fas fa-calendar-day mr-2"></i>{{formatDateOnly event.date}}
            </span>
            <span class="text-white font-bold">
                <i class="fas fa-clock mr-2 text-[var(--color-toxic)]"></i>{{formatTime event.date}}
            </span>
            <span class="text-white font-bold">
                <i class="fas fa-map-marker-alt mr-2 text-[var(--color-toxic)]"></i>{{event.venue.name}}
            </span>
            {{#if event.price}}
            <span class="text-white font-bold">
                <i class="fas fa-tag mr-2 text-[var(--color-toxic)]"></i>{{event.price}}
            </span>
            {{/if}}
            {{#if event.ageRestriction}}
            <span class="text-white font-bold">
                <i class="fas fa-id-card mr-2 text-[var(--color-toxic)]"></i>{{event.ageRestriction}}
            </span>
            {{/if}}
        </div>

        <!-- Primary Actions -->
        <div class="flex flex-wrap gap-3 mb-10">
            {{#if event.details.link}}
            <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="btn-neo flex items-center justify-center text-lg px-8 py-4">
                <i class="fas fa-ticket-alt mr-2"></i>GET TICKETS
            </a>
            {{/if}}
            <button id="share-button" class="bg-[var(--color-pink)] text-white font-bold uppercase tracking-wider px-8 py-4 text-lg border-3 border-[var(--color-light)] shadow-[4px_4px_0_var(--color-purple)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--color-toxic)] transition-all cursor-pointer flex items-center">
                <i class="fas fa-share-alt mr-2"></i>SHARE
            </button>
        </div>
    </section>

    <!-- Poster -->
    {{#if event.image}}
    <section class="max-w-5xl mx-auto px-6 md:px-12 mb-12">
        <div class="relative group">
            <div class="absolute -inset-1 bg-gradient-to-br from-[var(--color-purple)] to-[var(--color-pink)] opacity-40 group-hover:opacity-70 transition-opacity duration-300"></div>
            <img src="{{event.image.url}}" alt="{{event.name}}" class="relative w-full h-auto object-contain bg-black">
        </div>
    </section>
    {{/if}}

    <!-- Description -->
    <main class="max-w-5xl mx-auto px-6 md:px-12 py-12">
        {{#if (hasDescription event.description)}}
        <div class="max-w-3xl">
            <h2 class="text-2xl font-bold text-white mb-6 uppercase font-display">
                <span class="text-[var(--color-toxic)] mr-2">///</span> About This Event
            </h2>
            <div class="text-gray-300 leading-relaxed text-lg" style="line-height: 1.8;">
                {{{formatDescription event.description}}}
            </div>
        </div>
        {{/if}}

        <!-- Secondary Info -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-12 border-t border-white/10">
            <!-- Venue -->
            <div>
                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
                    <i class="fas fa-map-marker-alt mr-1 text-[var(--color-toxic)]"></i> Venue
                </h3>
                <p class="text-white font-bold text-lg mb-1">{{event.venue.name}}</p>
                {{#if event.venue.address}}
                <p class="text-gray-400 text-sm mb-3">{{event.venue.address}}</p>
                {{/if}}
                {{#if event.venue.slug}}
                <a href="/venue/{{event.venue.slug}}" class="text-[var(--color-toxic)] font-bold text-sm uppercase tracking-wider hover:underline">
                    View Venue <i class="fas fa-arrow-right ml-1"></i>
                </a>
                {{/if}}
            </div>

            <!-- Calendar -->
            <div>
                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
                    <i class="fas fa-calendar-plus mr-1 text-[var(--color-toxic)]"></i> Save to Calendar
                </h3>
                <div class="flex flex-col gap-2">
                    <a href="{{calendarLinks.google}}" target="_blank" rel="noopener noreferrer" class="text-white font-bold hover:text-[var(--color-toxic)] transition-colors">
                        <i class="fab fa-google mr-2"></i>Google Calendar
                    </a>
                    <a href="{{calendarLinks.ical}}" download="{{event.slug}}.ics" class="text-white font-bold hover:text-[var(--color-toxic)] transition-colors">
                        <i class="fas fa-calendar-plus mr-2"></i>Apple / Outlook
                    </a>
                </div>
            </div>

            <!-- Extra Details -->
            <div>
                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
                    <i class="fas fa-info-circle mr-1 text-[var(--color-toxic)]"></i> Details
                </h3>
                <div class="space-y-2 text-sm">
                    {{#if event.isRecurring}}
                    <p class="text-[var(--color-toxic)] font-bold"><i class="fas fa-redo mr-2"></i>{{event.recurringInfo}}</p>
                    {{/if}}
                    {{#if event.organizer}}
                    <p class="text-white font-bold"><i class="fas fa-user mr-2 text-gray-400"></i>{{event.organizer}}</p>
                    {{/if}}
                    {{#if event.accessibility}}
                    <p class="text-gray-300"><i class="fas fa-universal-access mr-2 text-[var(--color-toxic)]"></i>{{event.accessibility}}</p>
                    {{/if}}
                </div>
            </div>
        </div>

        <!-- Other Dates -->
        {{#if hasOtherInstances}}
        <section class="mt-12 pt-12 border-t border-white/10">
            <h2 class="text-2xl font-bold text-white mb-6 uppercase font-display">
                <span class="text-[var(--color-toxic)] mr-2">///</span> Other Dates
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {{#each otherInstances}}
                <a href="/event/{{slug}}" class="block bg-white/5 p-5 flex items-center space-x-4 hover:bg-[var(--color-purple)]/10 transition-all duration-200 group">
                    <div class="text-center w-16 flex-shrink-0">
                        <p class="text-2xl font-bold text-[var(--color-toxic)]">{{formatDay date}}</p>
                        <p class="text-sm text-gray-400 uppercase font-bold">{{formatMonth date}}</p>
                    </div>
                    <div class="flex-grow">
                        <h4 class="font-bold text-white text-lg">{{name}}</h4>
                        <p class="text-sm text-gray-400">{{formatTime date}}</p>
                    </div>
                    <div class="text-[var(--color-toxic)] group-hover:translate-x-1 transition-transform">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </a>
                {{/each}}
            </div>
        </section>
        {{/if}}
    </main>

    <!-- Sticky mobile bar: Tickets + Share -->
    <div class="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-black border-t-4 border-[var(--color-toxic)] p-3 flex gap-2">
        {{#if event.details.link}}
        <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="btn-neo flex-1 flex items-center justify-center">
            <i class="fas fa-ticket-alt mr-2"></i>TICKETS
        </a>
        {{/if}}
        <button id="share-button-mobile" class="bg-[var(--color-pink)] text-white font-bold uppercase tracking-wider px-4 py-3 border-3 border-[var(--color-light)] shadow-[4px_4px_0_var(--color-purple)] flex items-center justify-center cursor-pointer {{#unless event.details.link}}flex-1{{/unless}}">
            <i class="fas fa-share-alt mr-2"></i>SHARE
        </button>
    </div>

    <!-- Footer -->
    <footer class="bg-black border-t-4 border-[var(--color-light)] mt-16">
        <div class="h-[6px] progress-pride-bg"></div>
        <div class="container mx-auto px-6 py-12">
            <div class="grid md:grid-cols-3 gap-12">
                <div>
                    <div class="font-display font-black text-4xl misprint leading-none mb-6">
                        BRUM<br><span class="text-[var(--color-purple)]">OUT</span>LOUD
                    </div>
                    <p class="text-gray-400 text-sm leading-relaxed mb-6">Birmingham's home for LGBTQ+ events, venues, and community.</p>
                </div>
                <div>
                    <h4 class="font-bold text-sm mb-4 text-[var(--color-toxic)] uppercase tracking-widest">Explore</h4>
                    <div class="flex flex-col gap-3 font-bold text-sm uppercase tracking-widest">
                        <a href="/events" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Events</a>
                        <a href="/all-venues" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Venues</a>
                        <a href="/community" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Community</a>
                        <a href="/contact" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Contact</a>
                        <a href="/promoter-tool" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Promoter Tools</a>
                        <a href="/admin/settings" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Admin</a>
                    </div>
                </div>
                <div class="md:text-right">
                    <div class="flex md:justify-end gap-4 mb-4">
                        <a href="https://www.instagram.com/brumoutloud/" target="_blank" rel="noopener noreferrer" class="text-3xl hover:text-[var(--color-toxic)] transition-colors">
                            <i class="fab fa-instagram"></i>
                        </a>
                    </div>
                    <div class="sticker bg-white !text-black text-xs mb-4">EST. 2024</div>
                    <p class="font-bold text-sm text-[var(--color-purple)] uppercase tracking-widest">© 2026 BRUM OUTLOUD</p>
                    <p class="text-xs opacity-50 mt-1">Built in Digbeth. Powered by Riot.</p>
                </div>
            </div>
        </div>
    </footer>

    <script>
        // Mobile menu toggle
        const menuBtn = document.getElementById('menu-btn');
        const menu = document.getElementById('menu');
        if (menuBtn && menu) {
            menuBtn.addEventListener('click', () => {
                menu.classList.toggle('hidden');
                menu.classList.toggle('flex');
            });
        }

        // Add body class if sticky ticket bar exists
        if (document.querySelector('.fixed.bottom-0')) {
            document.body.classList.add('has-ticket-bar');
        }

        // Share button functionality
        function handleShare(btn) {
            const shareData = { title: '{{event.name}}', url: window.location.href };
            if (navigator.share) {
                navigator.share(shareData).catch(err => console.error('Share failed:', err));
            } else {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    const originalContent = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check mr-2"></i>COPIED!';
                    setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
                }).catch(err => console.error('Copy failed:', err));
            }
        }
        document.querySelectorAll('#share-button, #share-button-mobile').forEach(btn => {
            btn.addEventListener('click', () => handleShare(btn));
        });
    </script>
</body>
</html>`;

        // Register Handlebars helpers
        Handlebars.registerHelper('formatDay', function(dateString) {
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) {
                    return '--';
                }
                return date.getDate();
            } catch (error) {
                return '--';
            }
        });
        
        Handlebars.registerHelper('formatMonth', function(dateString) {
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) {
                    return '---';
                }
                return date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
            } catch (error) {
                return '---';
            }
        });
        
        Handlebars.registerHelper('formatTime', function(dateString) {
            try {
                if (!dateString) return 'Time TBC';
                const dateStr = typeof dateString === 'string' ? dateString : '';
                // No time component in the date string
                if (!dateStr.includes('T')) return 'Time TBC';
                // Midnight UTC = no meaningful time was set
                if (dateStr.includes('T00:00')) return 'Time TBC';
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return 'Time TBC';
                const formatted = date.toLocaleTimeString('en-GB', { 
                    hour: 'numeric',
                    minute: '2-digit'
                });
                // Final safety check
                return (formatted === '0:00' || formatted === '00:00') ? 'Time TBC' : formatted;
            } catch (error) {
                return 'Time TBC';
            }
        });
        
        Handlebars.registerHelper('formatDate', function(dateString) {
            try {
                if (!dateString) return 'Date TBC';
                const dateStr = typeof dateString === 'string' ? dateString : '';
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return 'Date TBC';
                // Check if this event has a meaningful time
                const hasNoTime = !dateStr.includes('T') || dateStr.includes('T00:00');
                const options = { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric'
                };
                if (!hasNoTime) {
                    options.hour = 'numeric';
                    options.minute = '2-digit';
                }
                return date.toLocaleDateString('en-GB', options);
            } catch (error) {
                return 'Date TBC';
            }
        });
        
        Handlebars.registerHelper('formatDateOnly', function(dateString) {
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) {
                    return 'Date TBC';
                }
                return date.toLocaleDateString('en-GB', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric'
                });
            } catch (error) {
                return 'Date TBC';
            }
        });
        
        Handlebars.registerHelper('hasValidLink', function(link) {
            return link && link !== null && link !== '';
        });
        
        Handlebars.registerHelper('hasDescription', function(description) {
            return description && description !== null && description !== '' && description.trim() !== '';
        });
        
        Handlebars.registerHelper('formatDescription', function(description) {
            if (!description) return '';
            
            // Convert line breaks to HTML
            return description
                .replace(/\n\n/g, '</p><p>') // Double line breaks become new paragraphs
                .replace(/\n/g, '<br>') // Single line breaks become <br> tags
                .replace(/^/, '<p>') // Start with <p>
                .replace(/$/, '</p>'); // End with </p>
        });

        // Compile the template
        const template = Handlebars.compile(templateContent);

        // Prepare template data
        const templateData = {
            event: eventData,
            otherInstances: otherInstances,
            similarEvents: similarEvents,
            hasOtherInstances: otherInstances.length > 0,
            calendarLinks: generateCalendarLinks(eventData),
            categoryTags: (eventData.category || []).map(tag =>
                '<span class="category-tag">' + tag + '</span>'
            ).join('')
        };

        // Render the page
        const html = template(templateData);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
            body: html
        };

    } catch (error) {
        console.error('Error in get-event-details:', error);
        
        return {
            statusCode: 500,
            body: 'Internal server error. Please try again later.'
        };
    }
};