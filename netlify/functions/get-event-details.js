const FirestoreEventService = require('./services/firestore-event-service');
const RecurringEventsManager = require('./services/recurring-events-manager');
const FormattingService = require('./services/formatting-service');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Version: 2026-03-22-v2 - Redesigned event detail page layout

const { withRetry } = require('./services/retry');

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
        const eventData = await withRetry(() => eventService.getEventBySlug(slug), { label: 'Firestore event query' });
        
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
    <!-- Performance: DNS prefetch and preconnect for external resources -->
    <link rel="preconnect" href="https://firestore.googleapis.com">
    <link rel="dns-prefetch" href="https://firestore.googleapis.com">
    <link rel="preconnect" href="https://www.googleapis.com">
    <link rel="dns-prefetch" href="https://www.googleapis.com">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{event.name}} | LGBTQ+ Birmingham & West Midlands Events | Brum Outloud</title>
    <meta name="description" content="{{event.description}}">

    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="{{event.name}} | Brum Outloud">
    <meta property="og:description" content="{{event.description}}">
    <meta property="og:type" content="event">
    <meta property="og:url" content="https://brumoutloud.co.uk/event/{{event.slug}}">
    <meta property="og:image" content="{{event.imageUrl}}">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{event.name}} | Brum Outloud">
    <meta name="twitter:description" content="{{event.description}}">
    <meta name="twitter:image" content="{{event.imageUrl}}">

    <!-- Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": "{{event.name}}",
      "description": "{{event.description}}",
      "startDate": "{{event.date}}",
      "location": {
        "@type": "Place",
        "name": "{{event.venue.name}}"
      },
      "image": "{{event.imageUrl}}",
      "url": "https://brumoutloud.co.uk/event/{{event.slug}}"
    }
    </script>

    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">

    <!-- Styles -->
    <link rel="stylesheet" href="/css/tailwind.css">
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&family=Bungee+Outline&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">

    <style>

        

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

        @media (max-width: 1023px) {
            body.has-ticket-bar { padding-bottom: 5rem; }
        }
    </style>

    <!-- FOUC Prevention Script -->
    <script src="/js/fouc-prevention.js"></script>
</head>
<body>
    <div class="watermark-bg text-[var(--color-toxic)]">EVENT</div>
    <!-- Header -->
    <header class="sticky top-0 z-[100] bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
    <nav class="pt-4 px-4 pb-5 flex justify-between items-center relative z-10 max-w-7xl mx-auto">
        <div class="absolute bottom-0 left-0 w-full h-[3px] progress-pride-bg opacity-80"></div>
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
            <a href="/promoter-submit-new" class="sticker bg-[var(--color-toxic)] !text-black text-sm hover:bg-white transition-colors border-none shadow-[2px_2px_0_#000]">GET LISTED</a>
        </div>
        <div class="lg:hidden">
            <button id="menu-btn" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="menu" class="text-white text-2xl p-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-toxic)]"><i class="fas fa-bars"></i></button>
        </div>
    </nav>
    <div id="menu" class="hidden lg:hidden fixed inset-0 bg-[var(--color-bg)]/95 backdrop-blur-2xl z-50 flex-col items-center justify-center space-y-6">
        <a href="/events" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)] transition-colors">WHAT'S ON</a>
        <a href="/all-venues" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)] transition-colors">VENUES</a>
        <a href="/clubs" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)] transition-colors">CLUBS</a>
        <a href="/birmingham-pride" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)] transition-colors">PRIDE</a>
        <a href="/community" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)] transition-colors">COMMUNITY</a>
        <a href="/contact" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)] transition-colors">CONTACT</a>
        <a href="/promoter-submit-new" class="block mt-4 sticker bg-[var(--color-toxic)] !text-black text-2xl border-none shadow-[4px_4px_0_#000]">GET LISTED</a>
    </div>
</header>


    <!-- Ambient Hero Background -->
    {{#if event.imageUrl}}
    <div class="absolute top-0 left-0 w-full h-[90vh] md:h-[80vh] z-0 overflow-hidden pointer-events-none">
        <div class="absolute inset-0 bg-[#0d0115]/80 z-10 mix-blend-multiply"></div>
        <div class="absolute inset-0 bg-gradient-to-b from-[#0d0115]/50 via-[#0d0115]/80 to-[#0d0115] z-20"></div>
        <img src="{{event.imageUrl}}" alt="" class="w-full h-full object-cover blur-[100px] opacity-70 scale-125 transform-gpu saturate-200">
    </div>
    {{/if}}

    <!-- Top Bar & Main Content -->
    <main class="relative z-10 pt-8 pb-20">
        <div class="max-w-6xl mx-auto px-6 md:px-12">
            
            <!-- Breadcrumb -->
            <nav class="mb-10 text-sm font-bold uppercase tracking-widest relative z-20">
                <a href="/events" class="text-gray-400 hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">What's On</a>
                <span class="text-gray-600 mx-2">/</span>
                <span class="text-[var(--color-toxic)]">Event</span>
            </nav>

            <!-- Split Hero Layout -->
            <div class="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
                
                <!-- Left: Poster -->
                {{#if event.imageUrl}}
                <div class="w-full lg:w-5/12 flex-shrink-0 relative group">
                    <div class="absolute -inset-3 bg-gradient-to-br from-[var(--color-purple)] to-[var(--color-pink)] opacity-20 blur-2xl group-hover:opacity-50 transition-opacity duration-700"></div>
                    <div class="brutalist-card !p-0 !border-4 !border-white overflow-hidden shadow-glow transform transition-transform duration-500 hover:-translate-y-2 group-hover:shadow-[8px_8px_0_var(--color-toxic)]">
                        <img src="{{event.imageUrl}}" alt="Promo image for {{event.name}} at {{event.venue.name}}" class="w-full h-auto object-cover bg-black" style="max-height: 85vh;">
                    </div>
                </div>
                {{/if}}

                <!-- Right: Content & Typography -->
                <div class="w-full lg:flex-1 pt-2 lg:pt-4">
                    <!-- Category Tags -->
                    <div class="flex flex-wrap gap-2 mb-6">
                        {{#each event.category}}
                        <span class="category-tag bg-[var(--color-pink)] text-white !border-[var(--color-pink)] !text-[10px] !px-3 shadow-[2px_2px_0_#000]">{{this}}</span>
                        {{/each}}
                        {{#if event.ageRestriction}}
                        <span class="category-tag bg-[var(--color-toxic)] text-black !border-[var(--color-toxic)] !text-[10px] !px-3 shadow-[2px_2px_0_#000]">{{event.ageRestriction}}</span>
                        {{/if}}
                    </div>

                    <!-- Title -->
                    <h1 class="text-[clamp(3.5rem,7vw,7rem)] font-black text-white uppercase font-display misprint leading-[0.85] mb-10 shadow-glow">{{event.name}}</h1>

                    <!-- Core Info Pills Layout -->
                    <div class="flex flex-wrap items-center gap-3 text-base md:text-lg mb-12">
                        <div class="border-2 border-[var(--color-toxic)] px-4 py-2 font-bold uppercase tracking-widest text-[var(--color-toxic)] text-sm shadow-[2px_2px_0_#000] bg-black/60 backdrop-blur flex items-center gap-3">
                            <i class="fas fa-calendar-day opacity-80 text-lg"></i> {{event.formattedDate}}
                        </div>
                        <div class="border-2 border-[var(--color-toxic)] px-4 py-2 font-bold uppercase tracking-widest text-white text-sm shadow-[2px_2px_0_#000] bg-black/60 backdrop-blur flex items-center gap-3">
                            <i class="fas fa-clock opacity-80 text-[var(--color-toxic)] text-lg"></i> {{event.time}}
                        </div>
                        <div class="border-2 border-white px-4 py-2 font-bold uppercase tracking-widest text-white text-sm shadow-[2px_2px_0_#000] bg-black/60 backdrop-blur flex items-center gap-3">
                            <i class="fas fa-map-marker-alt text-[var(--color-pink)] opacity-80 text-lg"></i> {{event.venue.name}}
                        </div>
                        {{#if event.price}}
                        <div class="border-2 border-[var(--color-pink)] px-4 py-2 font-bold uppercase tracking-widest text-[var(--color-pink)] text-sm shadow-[2px_2px_0_#000] bg-black/60 backdrop-blur flex items-center gap-3">
                            <i class="fas fa-ticket-alt opacity-80 text-lg"></i> {{event.price}}
                        </div>
                        {{/if}}
                    </div>

                    <!-- Action Blocks -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                        {{#if event.ticketLink}}
                        <a href="{{event.ticketLink}}" target="_blank" rel="noopener noreferrer" class="brutalist-card !p-5 !bg-[var(--color-toxic)] !text-black flex items-center justify-center group hover:!bg-white transition-all text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white">
                            <div class="flex items-center gap-4 font-display font-black text-2xl uppercase tracking-widest misprint">
                                <i class="fas fa-ticket-alt group-hover:-translate-y-1 group-hover:scale-110 transition-transform duration-300 transform-gpu text-3xl"></i> TICKETS
                            </div>
                        </a>
                        {{/if}}
                        
                        <button id="share-button" class="brutalist-card !p-5 !bg-[var(--color-purple)] !text-white flex items-center justify-center group cursor-pointer hover:!bg-[var(--color-pink)] transition-all text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white {{#unless event.ticketLink}}sm:col-span-2{{/unless}}">
                            <div class="flex items-center gap-4 font-display font-black text-2xl uppercase tracking-widest misprint">
                                <i class="fas fa-share-alt group-hover:-translate-y-1 group-hover:scale-110 transition-transform duration-300 transform-gpu text-3xl"></i> SHARE
                            </div>
                        </button>
                    </div>
                </div>
            </div>

    <!-- Description -->
    <!-- Description -->
    <section class="max-w-6xl mx-auto pb-12 mt-12 pt-12 border-t border-white/5">
        {{#if (hasDescription event.description)}}
        <div class="max-w-4xl aeo-glass-card p-8 md:p-12 mb-12 relative overflow-hidden group">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-purple)] to-[var(--color-pink)]"></div>
            <h2 class="text-3xl font-black text-white mb-6 uppercase font-display tracking-widest">
                <span class="text-[var(--color-toxic)] mr-2">///</span> ABOUT
            </h2>
            <div class="text-gray-200 leading-relaxed text-lg font-medium" style="line-height: 1.8;">
                {{{formatDescription event.description}}}
            </div>
        </div>
        {{/if}}

        <!-- Secondary Info -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Venue -->
            <div class="brutalist-card bg-black border-2 border-white/10 !p-6 hover:border-[var(--color-purple)] focus-within:border-[var(--color-purple)] transition-colors">
                <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
                    <i class="fas fa-map-marker-alt mr-2 text-[var(--color-toxic)]"></i> VENUE
                </h3>
                <p class="text-white font-bold text-xl mb-2 font-display uppercase">{{event.venue.name}}</p>
                {{#if event.venue.address}}
                <p class="text-gray-400 text-sm mb-4">{{event.venue.address}}</p>
                {{/if}}
                {{#if event.venue.slug}}
                <a href="/venue/{{event.venue.slug}}" class="inline-flex items-center text-[var(--color-pink)] font-black text-xs uppercase tracking-widest hover:text-white transition-colors group">
                    <span class="border-b-2 border-transparent group-hover:border-white transition-colors pb-1">View Venue Profile</span> <i class="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </a>
                {{/if}}
            </div>

            <!-- Calendar -->
            <div class="brutalist-card bg-black border-2 border-white/10 !p-6 hover:border-[var(--color-purple)] transition-colors">
                <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
                    <i class="fas fa-calendar-plus mr-2 text-[var(--color-toxic)]"></i> CALENDAR
                </h3>
                <div class="flex flex-col gap-3">
                    {{#if event.googleCalendarUrl}}
                    <a href="{{event.googleCalendarUrl}}" target="_blank" rel="noopener noreferrer" class="text-white font-bold text-sm bg-white/5 border border-white/10 px-4 py-3 hover:bg-[var(--color-toxic)] hover:text-black hover:border-[var(--color-toxic)] transition-all flex items-center">
                        <i class="fab fa-google mr-3"></i> Add to Google
                    </a>
                    {{/if}}
                    {{#if event.icalUrl}}
                    <a href="{{event.icalUrl}}" download="{{event.slug}}.ics" class="text-white font-bold text-sm bg-white/5 border border-white/10 px-4 py-3 hover:bg-[var(--color-pink)] hover:text-white hover:border-[var(--color-pink)] transition-all flex items-center">
                        <i class="fas fa-calendar-alt mr-3"></i> Apple / Outlook
                    </a>
                    {{/if}}
                </div>
            </div>

            <!-- Extra Details -->
            <div class="brutalist-card bg-black border-2 border-white/10 !p-6 hover:border-[var(--color-purple)] transition-colors">
                <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
                    <i class="fas fa-info-circle mr-2 text-[var(--color-toxic)]"></i> DETAILS
                </h3>
                <div class="space-y-4 text-sm">
                    {{#if event.isRecurring}}
                    <p class="text-[var(--color-toxic)] font-bold flex items-start"><i class="fas fa-redo mt-1 w-5 shrink-0"></i> <span>{{event.recurringInfo}}</span></p>
                    {{/if}}
                    {{#if event.organizer}}
                    <p class="text-white font-bold flex items-start"><i class="fas fa-user-circle mt-1 w-5 text-gray-400 shrink-0"></i> <span>{{event.organizer}}</span></p>
                    {{/if}}
                    {{#if event.accessibility}}
                    <p class="text-gray-300 flex items-start"><i class="fas fa-universal-access mt-1 w-5 text-[var(--color-toxic)] shrink-0"></i> <span>{{event.accessibility}}</span></p>
                    {{/if}}
                </div>
            </div>
        </div>

        <!-- Other Dates -->
        {{#if event.otherInstances}}
        <div class="mt-16 pt-12 border-t border-white/10">
            <div class="sticker bg-[var(--color-purple)] text-white text-[10px] mb-4 inline-block transform -rotate-1 uppercase tracking-widest font-black">MORE LIKE THIS</div>
            <h2 class="text-3xl font-black text-white mb-6 uppercase font-display misprint">
                Other Dates
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {{#each event.otherInstances}}
                <a href="/event/{{this.slug}}" class="brutalist-card !border-2 !border-white/20 bg-black hover:!border-[var(--color-toxic)] !p-0 flex transition-all duration-300 group hover:-translate-y-1 hover:shadow-glow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-toxic)]">
                    <div class="bg-[var(--color-toxic)] text-black w-20 flex flex-col justify-center items-center flex-shrink-0 group-hover:bg-white transition-colors border-r-2 border-white/20">
                        <p class="text-3xl font-black font-display misprint">{{this.dayOfMonth}}</p>
                        <p class="text-xs uppercase font-black tracking-widest">{{this.monthAbbr}}</p>
                    </div>
                    <div class="p-4 flex-grow flex items-center justify-between">
                        <div>
                            <h4 class="font-black text-white uppercase font-display leading-tight group-hover:text-[var(--color-toxic)] transition-colors">{{this.name}}</h4>
                            <p class="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider"><i class="fas fa-clock text-[var(--color-pink)] mr-1"></i> {{this.time}}</p>
                        </div>
                        <div class="text-[var(--color-toxic)] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ml-2">
                            <i class="fas fa-chevron-right text-xl"></i>
                        </div>
                    </div>
                </a>
                {{/each}}
            </div>
        </div>
        {{/if}}
    </section>
    </main>

    <!-- Sticky mobile bar: Tickets + Share -->
    <div class="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-black border-t-4 border-[var(--color-toxic)] p-3 flex gap-2">
        {{#if event.ticketLink}}
        <a href="{{event.ticketLink}}" target="_blank" rel="noopener noreferrer" class="bg-[var(--color-toxic)] text-black font-bold uppercase tracking-wider border-[3px] border-[var(--color-light)] shadow-[4px_4px_0_var(--color-purple)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--color-pink)] transition-all flex-1 flex items-center justify-center">
            <i class="fas fa-ticket-alt mr-2"></i>TICKETS
        </a>
        {{/if}}
        <button id="share-button-mobile" class="bg-[var(--color-pink)] text-white font-bold uppercase tracking-wider px-4 py-3 border-3 border-[var(--color-light)] shadow-[4px_4px_0_var(--color-purple)] flex items-center justify-center cursor-pointer {{#unless event.ticketLink}}flex-1{{/unless}}">
            <i class="fas fa-share-alt mr-2"></i>SHARE
        </button>
    </div>

    <!-- Footer -->
    <footer class="bg-black border-t-4 border-[var(--color-light)] mt-16 pb-20 lg:pb-0">
    <div class="h-[6px] progress-pride-bg"></div>
    <div class="container mx-auto px-6 py-12 max-w-7xl">
        <div class="grid md:grid-cols-3 gap-12">
            <div>
                <div class="font-display font-black text-4xl misprint leading-none mb-6">
                    BRUM<br><span class="text-[var(--color-purple)]">OUT</span>LOUD
                </div>
                <p class="text-gray-400 text-sm leading-relaxed mb-6">Birmingham's home for LGBTQ+ events, venues, and community.</p>
                <div class="flex gap-4">
                    <a href="https://www.instagram.com/brumoutloud/" target="_blank" rel="noopener noreferrer" class="text-2xl hover:text-[var(--color-toxic)] transition-colors"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
            
            <div>
                <h3 class="font-bold text-xs uppercase tracking-[0.2em] text-[var(--color-toxic)] mb-6">EXPLORE</h3>
                <ul class="space-y-4 font-bold text-sm uppercase tracking-widest">
                    <li><a href="/events" class="hover:text-[var(--color-toxic)] transition-colors">What's On</a></li>
                    <li><a href="/all-venues" class="hover:text-[var(--color-toxic)] transition-colors">Venues</a></li>
                    <li><a href="/clubs" class="hover:text-[var(--color-toxic)] transition-colors">Clubs & Groups</a></li>
                    <li><a href="/birmingham-pride" class="hover:text-[var(--color-toxic)] transition-colors">Pride Guide</a></li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-xs uppercase tracking-[0.2em] text-[var(--color-pink)] mb-6">INFO</h3>
                <ul class="space-y-4 font-bold text-sm uppercase tracking-widest">
                    <li><a href="/community" class="hover:text-[var(--color-toxic)] transition-colors">Community</a></li>
                    <li><a href="/contact" class="hover:text-[var(--color-toxic)] transition-colors">Contact</a></li>
                    <li><a href="/promoter-submit-new" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-[var(--color-toxic)] decoration-2">Get Listed</a></li>
                </ul>
            </div>
        </div>

        <div class="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
            <p class="text-xs uppercase tracking-widest font-bold opacity-50">&copy; 2026 BRUM OUTLOUD.</p>
            <div class="flex gap-6 text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">
                <a href="/privacy-policy" class="hover:opacity-100">Privacy</a>
                <a href="/terms-and-conditions" class="hover:opacity-100">Terms</a>
                <a href="/accessibility" class="hover:opacity-100">Accessibility</a>
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
    <script src="/js/main.js"></script>
</body>
</html>
`;

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
            return FormattingService.formatDescription(description);
        });

        // Compile the template
        const template = Handlebars.compile(templateContent);

        // Generate JSON-LD schema
        const eventSchema = {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": eventData.name,
            "description": eventData.description || "LGBTQ+ Event in Birmingham",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "eventStatus": "https://schema.org/EventScheduled",
            "location": {
                "@type": "Place",
                "name": eventData.venue?.name || "Birmingham",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": eventData.venue?.address || "",
                    "addressLocality": "Birmingham",
                    "addressRegion": "West Midlands",
                    "addressCountry": "GB"
                }
            },
            "startDate": eventData.date,
            "url": "https://www.brumoutloud.co.uk/event/" + eventData.slug,
            "organizer": {
                "@type": "Organization",
                "name": "Brum Outloud",
                "url": "https://www.brumoutloud.co.uk"
            }
        };

        // Google Search Console flags missing 'image' as a non-critical
        // structured-data issue. Always provide one — fall back to the site's
        // OG image so the schema is valid even for imageless events.
        eventSchema.image = eventData.image?.url
            || 'https://www.brumoutloud.co.uk/progressflag.svg.png';

        if (eventData.details?.link || eventData.details?.price) {
            const offers = {
                "@type": "Offer",
                "priceCurrency": "GBP",
                "availability": "https://schema.org/InStock"
            };

            if (eventData.details?.link) {
                offers.url = eventData.details.link;
            }

            // Parse price from freeform strings like "£10", "£5-£10", "Free", "£8 adv / £10 door"
            const priceStr = eventData.details?.price;
            if (priceStr) {
                const match = String(priceStr).match(/(\d+(?:\.\d+)?)/);
                if (match) {
                    offers.price = match[1];
                } else if (/free|gratis/i.test(priceStr)) {
                    offers.price = "0";
                } else {
                    offers.price = "0";
                }
            } else {
                offers.price = "0";
            }

            // validFrom — when the offer became available. Prefer createdAt/submittedAt/approvedAt,
            // fall back to 7 days before the event start.
            const validFromSource = eventData.createdAt || eventData.submittedAt || eventData.approvedAt;
            if (validFromSource) {
                try {
                    const d = validFromSource.toDate ? validFromSource.toDate() : new Date(validFromSource);
                    if (!isNaN(d.getTime())) {
                        offers.validFrom = d.toISOString();
                    }
                } catch (e) { /* ignore */ }
            }
            if (!offers.validFrom && eventData.date) {
                try {
                    const d = new Date(eventData.date);
                    d.setDate(d.getDate() - 7);
                    if (!isNaN(d.getTime())) offers.validFrom = d.toISOString();
                } catch (e) { /* ignore */ }
            }

            eventSchema.offers = offers;
        }

        if (eventData.date) {
            try {
                const startDate = new Date(eventData.date);
                if (!isNaN(startDate.getTime())) {
                    // Normalise to ISO 8601 so the schema is always valid
                    eventSchema.startDate = startDate.toISOString();
                    const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000); // default 4h duration
                    eventSchema.endDate = endDate.toISOString();
                }
            } catch (e) {
                // Ignore date parsing errors — startDate keeps its raw value
            }
        }

        // Escape '<' to prevent closing the <script> tag early (XSS).
        const eventJsonLd = JSON.stringify(eventSchema).replace(/</g, '\\u003c');

        // Prepare template data
        const templateData = {
            event: eventData,
            otherInstances: otherInstances,
            similarEvents: similarEvents,
            hasOtherInstances: otherInstances.length > 0,
            calendarLinks: generateCalendarLinks(eventData),
            categoryTags: (eventData.category || []).map(tag => {
                const safe = String(tag).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                return '<span class="category-tag">' + safe + '</span>';
            }).join(''),
            eventJsonLd: eventJsonLd
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
            statusCode: 503,
            headers: {
                'Content-Type': 'text/html',
                'Retry-After': '300'
            },
            body: 'Service temporarily unavailable. Please try again later.'
        };
    }
};