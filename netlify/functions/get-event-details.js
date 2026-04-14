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
    <meta property="og:image" content="{{event.image.url}}">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{event.name}} | Brum Outloud">
    <meta name="twitter:description" content="{{event.description}}">
    <meta name="twitter:image" content="{{event.image.url}}">

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
      "image": "{{event.image.url}}",
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


    <!-- The Viewport Vault Layout -->
    <main class="w-full bg-[#050505] flex flex-col lg:flex-row lg:h-[calc(100vh-85px)] lg:overflow-hidden border-t border-white/10">
        
        <!-- Left Panel: The Poster Vault -->
        <div class="w-full lg:w-1/2 relative min-h-[50vh] lg:min-h-full h-full bg-black flex items-center justify-center p-8 lg:p-12 xl:p-16 border-b lg:border-b-0 lg:border-r border-white/10 z-10">
            {{#if event.image}}
            <!-- Clean, unfiltered image source, fully visible -->
            <img src="{{event.image.url}}" alt="Event Poster" class="w-full h-full object-contain filter drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {{else}}
            <div class="w-full h-full flex items-center justify-center bg-[#111]">
                <span class="text-white/40 tracking-widest text-sm uppercase">NO IMAGE AVAILABLE</span>
            </div>
            {{/if}}
        </div>

        <!-- Right Panel: The Data Terminal -->
        <div class="w-full lg:w-1/2 flex flex-col relative bg-[#050505] h-full overflow-y-auto">
            
            <!-- Flexible internal container to push CTAs to bottom -->
            <div class="flex-grow flex flex-col w-full">
                
                <!-- Breadcrumbs / Top alignment -->
                <nav class="w-full px-8 py-6 flex items-center justify-between text-xs font-medium uppercase tracking-[0.2em] text-white/50 border-b border-white/10">
                    <a href="/events" class="hover:text-white transition-colors">BACK TO EVENTS</a>
                    <span class="text-[var(--color-toxic)] tracking-[0.2em]">{{event.category.[0]}}</span>
                </nav>

                <!-- Massive Title Block -->
                <div class="w-full px-8 py-12 xl:py-20 border-b border-white/10 flex-grow flex flex-col justify-center">
                    <h1 class="text-white font-black text-5xl sm:text-6xl md:text-7xl xl:text-8xl uppercase leading-[0.8] tracking-[-0.04em] m-0 font-display break-words">
                        {{event.name}}
                    </h1>
                    
                    <!-- Auxiliary Tags -->
                    <div class="flex flex-wrap gap-2 lg:gap-3 mt-10 xl:mt-12 opacity-80">
                        {{#each event.category}}
                        <span class="text-white border border-white/20 px-4 py-2 font-bold text-[10px] xl:text-xs uppercase tracking-[0.25em]">{{this}}</span>
                        {{/each}}
                        {{#if event.ageRestriction}}
                        <span class="text-[var(--color-toxic)] border border-[var(--color-toxic)] px-4 py-2 font-bold text-[10px] xl:text-xs uppercase tracking-[0.25em]">{{event.ageRestriction}}</span>
                        {{/if}}
                    </div>
                </div>

                <!-- Architectural Metadata Table -->
                <div class="w-full grid grid-cols-1 sm:grid-cols-3 border-b border-white/10 bg-[#050505]">
                    <!-- Date -->
                    <div class="px-8 py-8 md:py-10 border-b sm:border-b-0 sm:border-r border-white/10 flex flex-col justify-center">
                        <span class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-3 font-display">DATE</span>
                        <span class="text-white text-lg xl:text-xl font-black uppercase tracking-tight">{{formatDateOnly event.date}}</span>
                    </div>
                    <!-- Time -->
                    <div class="px-8 py-8 md:py-10 border-b sm:border-b-0 sm:border-r border-white/10 flex flex-col justify-center">
                        <span class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-3 font-display">TIME</span>
                        <span class="text-white text-lg xl:text-xl font-black uppercase tracking-tight">{{formatTime event.date}}</span>
                    </div>
                    <!-- Location -->
                    <div class="px-8 py-8 md:py-10 flex flex-col justify-center relative group">
                        <span class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-3 font-display">LOCATION</span>
                        <span class="text-white text-lg xl:text-xl font-black uppercase tracking-tight truncate pr-6">{{event.venue.name}}</span>
                        {{#if event.venue.slug}}
                        <a href="/venue/{{event.venue.slug}}" class="absolute inset-0 z-10" aria-label="View Venue"></a>
                        <i class="fas fa-arrow-right absolute right-8 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-white transition-colors"></i>
                        {{/if}}
                    </div>
                </div>

                <!-- Architectural Description -->
                {{#if (hasDescription event.description)}}
                <div class="w-full px-8 py-12 lg:py-16 border-b border-white/10 bg-[#050505]">
                    <h2 class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-6 font-display">ABOUT EVENT</h2>
                    <div class="text-white/90 leading-relaxed text-sm md:text-base font-medium">
                        {{{formatDescription event.description}}}
                    </div>
                </div>
                {{/if}}

                <!-- Architectural Secondary Info -->
                <div class="w-full grid grid-cols-1 lg:grid-cols-2 border-b border-white/10 bg-[#050505]">
                    <!-- Venue Details -->
                    <div class="px-8 py-8 md:py-12 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col">
                        <h3 class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-4 font-display">VENUE DETAILS</h3>
                        <p class="text-[var(--color-toxic)] font-black text-xl mb-2 font-display uppercase">{{event.venue.name}}</p>
                        {{#if event.venue.address}}
                        <p class="text-white/60 text-sm mb-6">{{event.venue.address}}</p>
                        {{/if}}
                        {{#if event.venue.slug}}
                        <a href="/venue/{{event.venue.slug}}" class="text-white text-xs font-bold uppercase tracking-widest hover:text-[var(--color-toxic)] transition-colors mt-auto w-max py-2 border-b border-white/20 hover:border-[var(--color-toxic)]">View Venue Profile <i class="fas fa-arrow-right ml-1"></i></a>
                        {{/if}}
                    </div>

                    <!-- Calendar & Metadata -->
                    <div class="px-8 py-8 md:py-12 flex flex-col gap-8">
                        <div>
                            <h3 class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-4 font-display">CALENDAR</h3>
                            <div class="flex flex-col gap-3">
                                {{#if event.googleCalendarUrl}}
                                <a href="{{event.googleCalendarUrl}}" target="_blank" rel="noopener noreferrer" class="text-white text-xs font-bold uppercase tracking-[0.1em] hover:text-[var(--color-toxic)] transition-colors flex items-center"><i class="fab fa-google mr-3 text-white/40"></i> Add to Google</a>
                                {{/if}}
                                {{#if event.icalUrl}}
                                <a href="{{event.icalUrl}}" download="{{event.slug}}.ics" class="text-white text-xs font-bold uppercase tracking-[0.1em] hover:text-[var(--color-pink)] transition-colors flex items-center"><i class="fas fa-calendar-alt mr-3 text-white/40"></i> Apple / Outlook</a>
                                {{/if}}
                            </div>
                        </div>

                        {{#if event.organizer}}
                        <div>
                            <h3 class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-2 font-display">ORGANIZER</h3>
                            <p class="text-white text-sm font-medium">{{event.organizer}}</p>
                        </div>
                        {{/if}}

                        {{#if event.accessibility}}
                        <div>
                            <h3 class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-2 font-display">ACCESSIBILITY</h3>
                            <p class="text-white text-sm font-medium">{{event.accessibility}}</p>
                        </div>
                        {{/if}}
                        
                        {{#if event.isRecurring}}
                        <div>
                            <h3 class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-2 font-display">RECURRING</h3>
                            <p class="text-[var(--color-toxic)] text-sm font-bold">{{event.recurringInfo}}</p>
                        </div>
                        {{/if}}
                    </div>
                </div>

                <!-- Other Dates (If recurring) -->
                {{#if otherInstances}}
                <div class="w-full px-8 py-10 lg:py-12 bg-[#050505]">
                    <h3 class="text-white/40 text-[10px] xl:text-xs font-bold uppercase tracking-[0.2em] mb-6 font-display">OTHER DATES</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {{#each otherInstances}}
                        <a href="/event/{{this.slug}}" class="flex items-center border border-white/10 hover:border-white transition-colors bg-[#0A0A0A] group">
                            <div class="bg-white/5 text-white px-4 py-3 border-r border-white/10 font-black font-display text-xl group-hover:bg-[var(--color-toxic)] group-hover:text-black transition-colors">{{this.dayOfMonth}}</div>
                            <div class="px-4 py-2 flex flex-col">
                                <span class="text-xs font-bold uppercase tracking-[0.1em] text-white/80">{{this.monthShort}} {{this.year}}</span>
                                <span class="text-[10px] text-white/40 uppercase tracking-widest">{{this.time}}</span>
                            </div>
                        </a>
                        {{/each}}
                    </div>
                </div>
                {{/if}}

            </div> <!-- END left/right flexible center content -->

            <!-- Absolute Bottom Geometry CTAs (Sticks to bottom of terminal) -->
            <div class="w-full flex flex-col sm:flex-row flex-shrink-0">
                <button id="share-button" class="flex-1 py-8 lg:py-10 bg-[var(--color-toxic)] text-black font-black text-2xl lg:text-3xl font-display uppercase tracking-tighter hover:bg-white transition-colors border-t border-white/10">
                    SHARE
                </button>
                
                {{#if event.details.link}}
                <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="flex-1 py-8 lg:py-10 bg-[var(--color-pink)] text-black font-black text-2xl lg:text-3xl font-display uppercase tracking-tighter hover:bg-white transition-colors flex items-center justify-center border-t border-white/10 sm:border-l border-black/20">
                    TICKETS
                </a>
                {{/if}}
            </div>

        </div>
    </main>

    <!-- Sticky mobile bar: Tickets + Share -->
    <div class="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-black border-t-4 border-[var(--color-toxic)] p-3 flex gap-2">
        {{#if event.details.link}}
        <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="bg-[var(--color-toxic)] text-black font-bold uppercase tracking-wider border-[3px] border-[var(--color-light)] shadow-[4px_4px_0_var(--color-purple)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--color-pink)] transition-all flex-1 flex items-center justify-center">
            <i class="fas fa-ticket-alt mr-2"></i>TICKETS
        </a>
        {{/if}}
        <button id="share-button-mobile" class="bg-[var(--color-pink)] text-white font-bold uppercase tracking-wider px-4 py-3 border-3 border-[var(--color-light)] shadow-[4px_4px_0_var(--color-purple)] flex items-center justify-center cursor-pointer {{#unless event.details.link}}flex-1{{/unless}}">
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