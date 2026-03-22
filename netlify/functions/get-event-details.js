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

    <!-- Hero: Poster + Event Info -->
    <section class="max-w-7xl mx-auto px-6 md:px-12 pt-8 pb-12">
        <!-- Breadcrumb -->
        <nav class="mb-8 text-sm font-bold uppercase tracking-widest">
            <a href="/events" class="text-gray-400 hover:text-[var(--color-toxic)] transition-colors">What's On</a>
            <span class="text-gray-600 mx-2">/</span>
            <span class="text-[var(--color-toxic)]">Event</span>
        </nav>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14">
            <!-- Poster -->
            <div class="lg:col-span-2">
                {{#if event.image}}
                <div class="sticky top-24">
                    <div class="relative group">
                        <div class="absolute -inset-1 bg-gradient-to-br from-[var(--color-purple)] to-[var(--color-pink)] opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                        <img src="{{event.image.url}}" alt="{{event.name}}" class="relative w-full h-auto object-contain bg-black">
                    </div>
                </div>
                {{else}}
                <div class="aspect-[3/4] bg-gradient-to-br from-[var(--color-purple)]/20 to-[var(--color-pink)]/20 flex items-center justify-center">
                    <i class="fas fa-calendar-star text-6xl text-[var(--color-purple)]/30"></i>
                </div>
                {{/if}}
            </div>

            <!-- Event Info -->
            <div class="lg:col-span-3 flex flex-col">
                <!-- Category Tags -->
                <div class="flex flex-wrap gap-2 mb-5">
                    {{{categoryTags}}}
                </div>

                <!-- Title -->
                <h1 class="text-4xl md:text-5xl lg:text-6xl font-black text-white uppercase font-display misprint mb-6 leading-[0.9]">{{event.name}}</h1>

                <!-- Description -->
                {{#if (hasDescription event.description)}}
                <div class="text-gray-300 leading-relaxed text-lg mb-8" style="line-height: 1.8;">
                    {{{formatDescription event.description}}}
                </div>
                {{/if}}

                <!-- Key Details Grid -->
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="bg-white/5 p-4">
                        <div class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1"><i class="fas fa-calendar-day mr-1 text-[var(--color-toxic)]"></i> Date</div>
                        <div class="text-white font-bold text-lg">{{formatDateOnly event.date}}</div>
                    </div>
                    <div class="bg-white/5 p-4">
                        <div class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1"><i class="fas fa-clock mr-1 text-[var(--color-toxic)]"></i> Time</div>
                        <div class="text-white font-bold text-lg">{{formatTime event.date}}</div>
                    </div>
                    <div class="bg-white/5 p-4">
                        <div class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1"><i class="fas fa-map-marker-alt mr-1 text-[var(--color-toxic)]"></i> Venue</div>
                        <div class="text-white font-bold text-lg">{{event.venue.name}}</div>
                    </div>
                    {{#if event.price}}
                    <div class="bg-white/5 p-4">
                        <div class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1"><i class="fas fa-tag mr-1 text-[var(--color-toxic)]"></i> Price</div>
                        <div class="text-white font-bold text-lg">{{event.price}}</div>
                    </div>
                    {{/if}}
                    {{#if event.isRecurring}}
                    <div class="bg-white/5 p-4">
                        <div class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1"><i class="fas fa-redo mr-1 text-[var(--color-toxic)]"></i> Recurs</div>
                        <div class="text-[var(--color-toxic)] font-bold text-lg">{{event.recurringInfo}}</div>
                    </div>
                    {{/if}}
                    {{#if event.ageRestriction}}
                    <div class="bg-white/5 p-4">
                        <div class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1"><i class="fas fa-id-card mr-1 text-[var(--color-toxic)]"></i> Age</div>
                        <div class="text-white font-bold text-lg">{{event.ageRestriction}}</div>
                    </div>
                    {{/if}}
                    {{#if event.organizer}}
                    <div class="bg-white/5 p-4">
                        <div class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1"><i class="fas fa-user mr-1 text-[var(--color-toxic)]"></i> Organizer</div>
                        <div class="text-white font-bold text-lg">{{event.organizer}}</div>
                    </div>
                    {{/if}}
                </div>

                <!-- Action Buttons -->
                <div class="space-y-3 mb-8">
                    {{#if event.details.link}}
                    <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="btn-neo w-full flex items-center justify-center text-lg py-4">
                        <i class="fas fa-ticket-alt mr-2"></i>BUY TICKETS
                    </a>
                    {{/if}}
                    <div class="grid grid-cols-2 gap-3">
                        {{#if event.venue.slug}}
                        <a href="/venue/{{event.venue.slug}}" class="btn-outline flex items-center justify-center text-sm !py-3">
                            <i class="fas fa-store mr-2"></i>VIEW VENUE
                        </a>
                        {{/if}}
                        <button id="share-button" class="btn-outline flex items-center justify-center text-sm !py-3">
                            <i class="fas fa-share-alt mr-2"></i>SHARE
                        </button>
                    </div>
                </div>

                <!-- Add to Calendar -->
                <div class="border-t border-white/10 pt-6">
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3"><i class="fas fa-calendar-plus mr-1 text-[var(--color-toxic)]"></i> Add to Calendar</p>
                    <div class="flex gap-3">
                        <a href="{{calendarLinks.google}}" target="_blank" rel="noopener noreferrer" class="text-sm font-bold uppercase tracking-wider text-gray-300 hover:text-[var(--color-toxic)] transition-colors">
                            <i class="fab fa-google mr-1"></i> Google
                        </a>
                        <span class="text-gray-600">|</span>
                        <a href="{{calendarLinks.ical}}" download="{{event.slug}}.ics" class="text-sm font-bold uppercase tracking-wider text-gray-300 hover:text-[var(--color-toxic)] transition-colors">
                            <i class="fas fa-calendar-plus mr-1"></i> Apple / Outlook
                        </a>
                    </div>
                </div>

                {{#if event.accessibility}}
                <div class="border-t border-white/10 pt-6 mt-6">
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2"><i class="fas fa-universal-access mr-1 text-[var(--color-toxic)]"></i> Accessibility</p>
                    <p class="text-gray-300 text-sm leading-relaxed">{{event.accessibility}}</p>
                </div>
                {{/if}}
            </div>
        </div>
    </section>

    <!-- Other Dates -->
    <main class="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div>
            {{#if hasOtherInstances}}
            <section class="mt-12 max-w-3xl">
                <h2 class="text-2xl font-bold text-white mb-6 uppercase font-display">
                    <span class="text-[var(--color-toxic)] mr-2">///</span> Other Dates
                </h2>
                <div class="space-y-3">
                    {{#each otherInstances}}
                    <a href="/event/{{slug}}" class="block bg-white/5 p-4 flex items-center space-x-4 hover:bg-[var(--color-purple)]/10 transition-all duration-200">
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