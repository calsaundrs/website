const FirestoreEventService = require('./services/firestore-event-service');
const RecurringEventsManager = require('./services/recurring-events-manager');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Version: 2025-01-27-v1 - Firestore-based event details function

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
        console.log("All event fields:", Object.keys(eventData));
        console.log("Raw event data:", JSON.stringify(eventData, null, 2));

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

        // Format description
        let formattedDescription = eventData.description;
        if (eventData.description && !eventData.series) {
            // TODO: Add description formatting if needed
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
                <a href="/community" class="hover:text-[var(--color-toxic)] transition-colors">COMMUNITY / SAFE SPACE</a>
                <a href="/contact" class="hover:text-[var(--color-toxic)] transition-colors">CONTACT</a>
                <a href="/get-listed" class="sticker bg-[var(--color-toxic)] !text-black text-sm hover:bg-white transition-colors">GET LISTED</a>
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
            <a href="/community" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">COMMUNITY</a>
            <a href="/contact" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">CONTACT</a>
            <a href="/get-listed" class="block mt-4 sticker bg-[var(--color-toxic)] !text-black text-2xl">GET LISTED</a>
        </div>
    </header>

    <!-- Hero Section - Full Bleed -->
    <section class="relative w-full" style="min-height: 35vh;">
        <!-- Hero Image -->
        <div class="absolute inset-0">
            {{#if event.image}}
            <img src="{{event.image.url}}" alt="{{event.name}}" class="w-full h-full object-cover" style="filter: contrast(1.1) brightness(0.6) blur(8px); transform: scale(1.05);">
            {{else}}
            <div class="w-full h-full bg-gradient-to-br from-[var(--color-purple)]/30 to-[var(--color-pink)]/30"></div>
            {{/if}}
            <div class="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] from-15% via-[var(--color-bg)]/95 via-50% to-[var(--color-bg)]/60"></div>
        </div>

        <!-- Hero Overlay Content -->
        <div class="relative z-10 flex flex-col justify-end h-full px-6 md:px-12 pb-12 pt-32" style="min-height: 35vh;">
            <div class="max-w-7xl mx-auto w-full">
                <!-- Breadcrumb -->
                <nav class="mb-6 text-sm font-bold uppercase tracking-widest">
                    <a href="/events" class="text-gray-400 hover:text-[var(--color-toxic)] transition-colors">What's On</a>
                    <span class="text-gray-600 mx-2">/</span>
                    <span class="text-white">Event</span>
                </nav>

                <!-- Date + Title -->
                <div class="flex items-end gap-6 mb-6">
                    <div class="text-center flex-shrink-0 border-r-2 border-[var(--color-toxic)] pr-6 hidden sm:block">
                        <div class="text-5xl md:text-6xl font-black text-[var(--color-toxic)] font-display">{{formatDay event.date}}</div>
                        <div class="text-sm text-gray-300 uppercase font-bold tracking-widest">{{formatMonth event.date}}</div>
                    </div>
                    <div class="flex-1">
                        <h1 class="text-4xl md:text-5xl lg:text-6xl font-black text-white uppercase font-display misprint mb-3">{{event.name}}</h1>
                        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-lg">
                            <p class="text-[var(--color-toxic)] font-bold">
                                <i class="fas fa-map-marker-alt mr-2"></i>{{event.venue.name}}
                            </p>
                            <p class="text-gray-300 font-bold">
                                <i class="fas fa-clock mr-2"></i>{{formatDate event.date}}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Category Tags -->
                <div class="flex flex-wrap gap-2">
                    {{{categoryTags}}}
                </div>
            </div>
        </div>
    </section>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14">

            <!-- Primary Content -->
            <div class="lg:col-span-2 space-y-10">
                {{#if (hasDescription event.description)}}
                <section>
                    <h2 class="text-2xl font-bold text-white mb-5 uppercase font-display">
                        <span class="text-[var(--color-toxic)] mr-2">///</span> About This Event
                    </h2>
                    <div class="text-gray-300 leading-relaxed text-lg max-w-none" style="line-height: 1.8;">
                        {{{formatDescription event.description}}}
                    </div>
                </section>
                {{/if}}

                <!-- Other Events in Series -->
                {{#if hasOtherInstances}}
                <section>
                    <h2 class="text-2xl font-bold text-white mb-5 uppercase font-display">
                        <span class="text-[var(--color-toxic)] mr-2">///</span> Other Dates
                    </h2>
                    <div class="space-y-3">
                        {{#each otherInstances}}
                        <a href="/event/{{slug}}" class="block border-2 border-[#f3e8ff]/20 p-4 flex items-center space-x-4 hover:border-[var(--color-toxic)] hover:bg-white/5 transition-all duration-200">
                            <div class="text-center w-16 flex-shrink-0">
                                <p class="text-2xl font-bold text-[var(--color-toxic)]">{{formatDay date}}</p>
                                <p class="text-sm text-gray-400 uppercase font-bold">{{formatMonth date}}</p>
                            </div>
                            <div class="flex-grow">
                                <h4 class="font-bold text-white text-lg">{{name}}</h4>
                                <p class="text-sm text-gray-400">{{formatTime date}}</p>
                            </div>
                            <div class="text-[var(--color-toxic)]">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        </a>
                        {{/each}}
                    </div>
                </section>
                {{/if}}
            </div>

            <!-- Sidebar -->
            <aside class="space-y-6">
                {{#if event.image}}
                <div class="neo-card overflow-hidden">
                    <img src="{{event.image.url}}" alt="{{event.name}}" class="w-full h-auto object-contain">
                </div>
                {{/if}}

                <!-- Tickets CTA -->
                {{#if event.details.link}}
                <div class="neo-card p-6">
                    <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="btn-neo w-full flex items-center justify-center text-lg">
                        <i class="fas fa-ticket-alt mr-2"></i>BUY TICKETS
                    </a>
                </div>
                {{/if}}

                <!-- Event Details -->
                <div class="neo-card p-6">
                    <h3 class="text-lg font-bold text-white mb-4 uppercase font-display">Details</h3>
                    <dl class="space-y-3 text-sm">
                        <div class="flex items-start justify-between gap-4">
                            <dt class="text-gray-400 font-bold uppercase tracking-wider"><i class="fas fa-calendar-day mr-1 text-[var(--color-toxic)]"></i> Date</dt>
                            <dd class="text-white font-semibold text-right">{{formatDateOnly event.date}}</dd>
                        </div>
                        <div class="flex items-start justify-between gap-4">
                            <dt class="text-gray-400 font-bold uppercase tracking-wider"><i class="fas fa-clock mr-1 text-[var(--color-toxic)]"></i> Time</dt>
                            <dd class="text-white font-semibold text-right">{{formatTime event.date}}</dd>
                        </div>
                        {{#if event.isRecurring}}
                        <div class="flex items-start justify-between gap-4">
                            <dt class="text-gray-400 font-bold uppercase tracking-wider"><i class="fas fa-redo mr-1 text-[var(--color-toxic)]"></i> Recurs</dt>
                            <dd class="text-[var(--color-toxic)] font-semibold text-right">{{event.recurringInfo}}</dd>
                        </div>
                        {{/if}}
                        {{#if event.price}}
                        <div class="flex items-start justify-between gap-4">
                            <dt class="text-gray-400 font-bold uppercase tracking-wider"><i class="fas fa-tag mr-1 text-[var(--color-toxic)]"></i> Price</dt>
                            <dd class="text-white font-semibold text-right">{{event.price}}</dd>
                        </div>
                        {{/if}}
                        {{#if event.ageRestriction}}
                        <div class="flex items-start justify-between gap-4">
                            <dt class="text-gray-400 font-bold uppercase tracking-wider"><i class="fas fa-id-card mr-1 text-[var(--color-toxic)]"></i> Age</dt>
                            <dd class="text-white font-semibold text-right">{{event.ageRestriction}}</dd>
                        </div>
                        {{/if}}
                        {{#if event.organizer}}
                        <div class="flex items-start justify-between gap-4">
                            <dt class="text-gray-400 font-bold uppercase tracking-wider"><i class="fas fa-user mr-1 text-[var(--color-toxic)]"></i> Organizer</dt>
                            <dd class="text-white font-semibold text-right">{{event.organizer}}</dd>
                        </div>
                        {{/if}}
                    </dl>
                </div>

                <!-- Location -->
                <div class="neo-card p-6">
                    <h3 class="text-lg font-bold text-white mb-4 uppercase font-display">
                        <i class="fas fa-map-marker-alt mr-2 text-[var(--color-toxic)]"></i>Venue
                    </h3>
                    <p class="text-white font-bold text-lg mb-1">{{event.venue.name}}</p>
                    {{#if event.venue.address}}
                    <p class="text-gray-400 text-sm mb-4">{{event.venue.address}}</p>
                    {{/if}}
                    {{#if event.venue.slug}}
                    <a href="/venue/{{event.venue.slug}}" class="btn-outline w-full flex items-center justify-center text-sm !py-2">
                        <i class="fas fa-external-link-alt mr-2"></i>VIEW VENUE
                    </a>
                    {{/if}}
                </div>

                <!-- Add to Calendar -->
                <div class="neo-card p-6">
                    <h3 class="text-lg font-bold text-white mb-4 uppercase font-display">
                        <i class="fas fa-calendar-plus mr-2 text-[var(--color-toxic)]"></i>Calendar
                    </h3>
                    <div class="space-y-3">
                        <a href="{{calendarLinks.google}}" target="_blank" rel="noopener noreferrer" class="btn-outline w-full flex items-center justify-center text-sm !py-2">
                            <i class="fab fa-google mr-2"></i>GOOGLE CALENDAR
                        </a>
                        <a href="{{calendarLinks.ical}}" download="{{event.slug}}.ics" class="btn-outline w-full flex items-center justify-center text-sm !py-2">
                            <i class="fas fa-calendar-plus mr-2"></i>APPLE / OUTLOOK
                        </a>
                    </div>
                </div>

                <!-- Share -->
                <div class="neo-card p-6">
                    <button id="share-button" class="btn-outline w-full flex items-center justify-center">
                        <i class="fas fa-share-alt mr-2"></i>SHARE EVENT
                    </button>
                </div>

                {{#if event.accessibility}}
                <div class="neo-card p-6">
                    <h3 class="text-lg font-bold text-white mb-3 uppercase font-display">
                        <i class="fas fa-universal-access mr-2 text-[var(--color-toxic)]"></i>Accessibility
                    </h3>
                    <p class="text-gray-300 text-sm leading-relaxed">{{event.accessibility}}</p>
                </div>
                {{/if}}
            </aside>
        </div>
    </main>

    <!-- Sticky mobile ticket bar -->
    {{#if event.details.link}}
    <div class="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-black border-t-4 border-[var(--color-toxic)] p-3">
        <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="btn-neo w-full flex items-center justify-center">
            <i class="fas fa-ticket-alt mr-2"></i>BUY TICKETS
        </a>
    </div>
    {{/if}}

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
        const shareButton = document.getElementById('share-button');
        if (shareButton) {
            shareButton.addEventListener('click', () => {
                const shareData = { title: '{{event.name}}', url: window.location.href };
                if (navigator.share) {
                    navigator.share(shareData).catch(err => console.error('Share failed:', err));
                } else {
                    navigator.clipboard.writeText(window.location.href).then(() => {
                        const originalContent = shareButton.innerHTML;
                        shareButton.innerHTML = '<i class="fas fa-check mr-2"></i>LINK COPIED!';
                        setTimeout(() => { shareButton.innerHTML = originalContent; }, 2000);
                    }).catch(err => console.error('Copy failed:', err));
                }
            });
        }
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