const path = require('path');
const fs = require('fs').promises;

// Try to load optional dependencies with error handling
let Airtable, base, fetch, Handlebars;

try {
    Airtable = require('airtable');
    fetch = require('node-fetch');
    Handlebars = require('handlebars');
    
    if (process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN && process.env.AIRTABLE_BASE_ID) {
        base = new Airtable({ 
            apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
        }).base(process.env.AIRTABLE_BASE_ID);
    }
} catch (depError) {
    console.error('❌ Dependency loading error:', depError);
}

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
function generateIcsDataURI(event) {
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BrumOutloud//EN',
        'BEGIN:VEVENT',
        'UID:' + new Date().getTime() + ' @brumoutloud.co.uk',
        'DTSTAMP:' + toICSDate(new Date()),
        'DTSTART:' + toICSDate(new Date(event.startTime)),
        'DTEND:' + toICSDate(new Date(event.endTime)),
        'SUMMARY:' + event.title,
        'DESCRIPTION:' + event.description.replace(/\n/g, '\\n'),
        'LOCATION:' + event.location,
        'END:VEVENT',
        'END:VCALENDAR'
    ];
    const icsString = icsContent.join('\r\n');
    return 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsString);
}


/**
 * Renders an error page for failed event lookups
 * @param {string} slug The event slug that failed
 * @param {string} error The error message
 * @returns {object} Response object with error page HTML
 */
async function renderErrorPage(slug, error) {
    // Use embedded HTML template matching the design system
    const errorPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Not Found | Brum Outloud</title>
    <meta name="description" content="Sorry, this event could not be found.">
    <link rel="icon" type="image/png" href="/faviconV2.png">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    
    <style>
        /* Design System Styles */
        body {
            background-color: #121212;
            color: #EAEAEA;
            font-family: 'Poppins', sans-serif;
        }
        .font-anton {
            font-family: 'Anton', sans-serif;
            letter-spacing: 0.05em;
        }
        .accent-color { color: #B564F7; }
        .bg-accent-color { background-color: #B564F7; }
        .accent-color-secondary { color: #FADCD9; }
        .bg-accent-color-secondary { background-color: #FADCD9; }
        .card-bg {
            background-color: #1e1e1e; 
            border: 1px solid #2e2e2e;
            border-radius: 1.25rem; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .nav-cta {
            background-color: #FADCD9; 
            color: #333333; 
            font-weight: bold;
            padding: 0.75rem 1.5rem; 
            border-radius: 0.5rem; 
            transition: opacity 0.3s ease;
        }
        .nav-cta:hover { opacity: 0.9; }
        .animate-fade-in {
            animation: fadeInUp 0.5s ease-out forwards;
            opacity: 0;
        }
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .heading-gradient {
            background: linear-gradient(180deg, #FFFFFF 50%, #d1c7b8 100%);
            -webkit-background-clip: text; 
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
    </style>
</head>
<body class="antialiased min-h-screen">
    <!-- Header with navigation matching design system -->
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="font-anton text-2xl tracking-widest text-white">
                BRUM OUT LOUD
            </a>
            <div class="hidden lg:flex items-center space-x-8">
                <a href="/events.html" class="text-gray-300 hover:text-white font-semibold">WHAT'S ON</a>
                <a href="/all-venues.html" class="text-gray-300 hover:text-white font-semibold">VENUES</a>
                <a href="/community.html" class="text-gray-300 hover:text-white font-semibold">COMMUNITY</a>
                <a href="/contact.html" class="text-gray-300 hover:text-white font-semibold">CONTACT</a>
                <a href="/promoter-tool.html" class="nav-cta">GET LISTED</a>
            </div>
        </nav>
    </header>

    <!-- Main content -->
    <main class="container mx-auto px-8 py-8 flex-grow">
        <div class="text-center mb-8 animate-fade-in">
            <!-- Hero section with design system typography -->
            <h1 class="font-anton text-6xl md:text-7xl lg:text-8xl leading-none tracking-wider heading-gradient mb-4">
                EVENT <span class="accent-color">NOT FOUND</span>
            </h1>
            <p class="text-xl text-gray-300 max-w-2xl mx-auto">
                Sorry, we couldn't find the event details you were looking for.
            </p>
        </div>

        <!-- Error details card using design system -->
        <div class="max-w-4xl mx-auto">
            <div class="card-bg p-8 mb-8 animate-fade-in">
                <div class="text-center mb-6">
                    <div class="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-gray-800 text-accent-color mb-4">
                        <i class="fas fa-search fa-2x"></i>
                    </div>
                    <h2 class="font-anton text-3xl text-white mb-2">Event Lookup Failed</h2>
                </div>
                
                <!-- Event slug info -->
                <div class="bg-gray-900/50 rounded-lg p-4 mb-6">
                    <p class="text-sm font-semibold accent-color-secondary mb-2">Requested Event Slug:</p>
                    <code class="bg-gray-800 px-3 py-2 rounded text-accent-color font-mono text-sm">${slug || 'unknown'}</code>
                </div>

                <!-- Error details (collapsible) -->
                ${error ? 
                '<details class="group mb-6">' +
                    '<summary class="flex items-center justify-between cursor-pointer list-none">' +
                        '<span class="font-semibold text-lg accent-color-secondary">Technical Details</span>' +
                        '<span class="text-2xl accent-color transition-transform transform group-open:rotate-45">+</span>' +
                    '</summary>' +
                    '<div class="mt-4 bg-red-900/20 border border-red-500/50 rounded-lg p-4">' +
                        '<pre class="text-red-300 text-xs overflow-auto whitespace-pre-wrap">' + error + '</pre>' +
                    '</div>' +
                '</details>'
                : ''}

                <!-- Possible reasons -->
                <div class="mb-8">
                    <h3 class="font-semibold text-lg accent-color-secondary mb-4">This might happen if:</h3>
                    <ul class="text-gray-300 space-y-2">
                        <li class="flex items-start">
                            <i class="fas fa-calendar-times text-accent-color mr-3 mt-1 flex-shrink-0"></i>
                            <span>The event has been moved or cancelled</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-link text-accent-color mr-3 mt-1 flex-shrink-0"></i>
                            <span>The URL contains a typo or is outdated</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-clock text-accent-color mr-3 mt-1 flex-shrink-0"></i>
                            <span>The event is no longer available</span>
                        </li>
                        <li class="flex items-start">
                            <i class="fas fa-database text-accent-color mr-3 mt-1 flex-shrink-0"></i>
                            <span>There's a temporary server issue</span>
                        </li>
                    </ul>
                </div>

                <!-- Action buttons -->
                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                    <a href="/events.html" class="bg-accent-color text-white font-bold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-3 group">
                        <i class="fas fa-calendar-alt"></i>
                        <span>View All Events</span>
                        <i class="fas fa-arrow-right transition-transform group-hover:translate-x-1"></i>
                    </a>
                    <a href="/" class="bg-gray-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-600 transition-colors inline-flex items-center justify-center gap-3">
                        <i class="fas fa-home"></i>
                        <span>Go Home</span>
                    </a>
                </div>
            </div>

            <!-- Helpful links card -->
            <div class="card-bg p-8 animate-fade-in">
                <h3 class="font-anton text-2xl text-white mb-6 text-center">Looking for Something Else?</h3>
                <div class="grid md:grid-cols-3 gap-4">
                    <a href="/events.html" class="block p-4 bg-gray-900/50 rounded-lg hover:bg-gray-800 transition-colors group">
                        <div class="text-center">
                            <i class="fas fa-calendar-check text-2xl accent-color mb-2"></i>
                            <h4 class="font-semibold text-white group-hover:accent-color">Browse Events</h4>
                            <p class="text-sm text-gray-400">See what's happening</p>
                        </div>
                    </a>
                    <a href="/all-venues.html" class="block p-4 bg-gray-900/50 rounded-lg hover:bg-gray-800 transition-colors group">
                        <div class="text-center">
                            <i class="fas fa-map-marker-alt text-2xl accent-color mb-2"></i>
                            <h4 class="font-semibold text-white group-hover:accent-color">Find Venues</h4>
                            <p class="text-sm text-gray-400">Discover places</p>
                        </div>
                    </a>
                    <a href="/contact.html" class="block p-4 bg-gray-900/50 rounded-lg hover:bg-gray-800 transition-colors group">
                        <div class="text-center">
                            <i class="fas fa-question-circle text-2xl accent-color mb-2"></i>
                            <h4 class="font-semibold text-white group-hover:accent-color">Get Help</h4>
                            <p class="text-sm text-gray-400">Contact support</p>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer matching design system -->
    <footer class="bg-gray-800 text-gray-300 py-8 mt-16">
        <div class="container mx-auto px-8 text-center">
            <p>&copy; 2024 Brum Outloud. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;

    return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: errorPageHtml
    };
}

/**
 * Returns an embedded HTML template for event details
 * Used as fallback when template file is not found
 * @returns {string} HTML template string
 */
function getEmbeddedEventTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{eventName}} | Brum Outloud</title>
    <meta name="description" content="{{descriptionMeta}}">
    <link rel="canonical" href="{{pageUrlCanonical}}">
    <link rel="icon" type="image/png" href="/faviconV2.png">
    <script type="application/ld+json">
    {{{schemaMarkup}}}
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    <script src="/js/main.js" defer></script>
</head>
<body class="antialiased bg-gray-900 text-white">
    <!-- Header -->
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="flex items-center text-2xl tracking-widest text-white" style="font-family: 'Omnes Pro', sans-serif;">
                <span>Brum Outloud</span>
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded" onerror="this.src='https://placehold.co/24x24/000000/FFFFFF?text=🏳️‍🌈'; this.onerror=null;">
            </a>
            <div class="hidden lg:flex items-center space-x-8">
                <a href="/events.html" class="text-gray-300 hover:text-white">WHAT'S ON</a>
                <a href="/all-venues.html" class="text-gray-300 hover:text-white">VENUES</a>
                <a href="/community.html" class="text-gray-300 hover:text-white">COMMUNITY</a>
                <a href="/contact.html" class="text-gray-300 hover:text-white">CONTACT</a>
                <a href="/promoter-tool.html" class="inline-block bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200">GET LISTED</a>
            </div>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-8 py-8">
        <!-- Event Header -->
        <div class="mb-8">
            <h1 class="text-4xl lg:text-6xl font-anton mb-4">{{eventName}}</h1>
            <div class="flex flex-wrap items-center gap-4 text-lg text-gray-300">
                <div class="flex items-center">
                    <i class="fas fa-calendar mr-2 text-purple-400"></i>
                    <span>{{eventDateFormatted}}</span>
                </div>
                <div class="flex items-center">
                    <i class="fas fa-clock mr-2 text-purple-400"></i>
                    <span>{{eventTimeFormatted}}</span>
                </div>
            </div>
        </div>

        <!-- Event Image -->
        <div class="mb-8">
            <div class="hero-image-container">
                <img src="{{imageUrl}}" alt="{{eventName}}" class="hero-image-fg">
                <img src="{{imageUrl}}" alt="" class="hero-image-bg" aria-hidden="true">
            </div>
        </div>

        <!-- Event Details Grid -->
        <div class="grid lg:grid-cols-3 gap-8">
            <!-- Main Content -->
            <div class="lg:col-span-2">
                <!-- Description -->
                <div class="mb-8">
                    <h2 class="text-2xl font-bold mb-4">About This Event</h2>
                    <div class="prose prose-invert max-w-none">
                        <p>{{{description}}}</p>
                    </div>
                </div>

                <!-- Categories -->
                {{#if tagsHtml}}
                <div class="mb-8">
                    <h3 class="text-xl font-bold mb-4">Categories</h3>
                    <div class="flex flex-wrap gap-2">
                        {{{tagsHtml}}}
                    </div>
                </div>
                {{/if}}
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-1">
                <div class="card-bg p-6 rounded-xl">
                    <!-- Venue -->
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-2">Venue</h3>
                        {{{venueHtml}}}
                    </div>

                    <!-- Event Details -->
                    {{#if hasEventDetails}}
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-4">Event Details</h3>
                        <ul class="space-y-2">
                            {{{addressHtml}}}
                            {{{priceHtml}}}
                            {{{ageRestrictionHtml}}}
                            {{{linkHtml}}}
                        </ul>
                    </div>
                    {{/if}}

                    <!-- Ticket Link -->
                    {{#if ticketLink}}
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-4">Get Tickets</h3>
                        <a href="{{ticketLink}}" target="_blank" rel="noopener noreferrer" class="w-full bg-accent-color hover:opacity-90 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 block text-center group">
                            <i class="fas fa-ticket-alt mr-2"></i>
                            <span>Buy Tickets</span>
                            <i class="fas fa-external-link-alt ml-2 text-sm transition-transform group-hover:translate-x-1"></i>
                        </a>
                    </div>
                    {{/if}}

                    <!-- Calendar Links -->
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-4">Add to Calendar</h3>
                        <div class="space-y-3">
                            {{{calendarLinksHtml}}}
                        </div>
                    </div>

                    <!-- Share Event -->
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-4">Share Event</h3>
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="shareOnFacebook()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm">
                                <i class="fab fa-facebook-f mr-1"></i> Facebook
                            </button>
                            <button onclick="shareOnTwitter()" class="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm">
                                <i class="fab fa-twitter mr-1"></i> Twitter
                            </button>
                            <button onclick="copyLink()" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm col-span-2">
                                <i class="fas fa-link mr-1"></i> Copy Link
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Other Instances -->
        {{#if otherInstancesHTML}}
        <div class="mt-16">
            <h2 class="text-3xl font-anton mb-8">Other Dates</h2>
            <div class="space-y-4">
                {{{otherInstancesHTML}}}
            </div>
        </div>
        {{/if}}

        <!-- Suggested Events -->
        {{{suggestedEventsHtml}}}
    </main>

    <!-- Footer -->
    <footer class="bg-gray-800 text-gray-300 py-8 mt-16">
        <div class="container mx-auto px-8 text-center">
            <p>&copy; 2024 Brum Outloud. All rights reserved.</p>
        </div>
    </footer>

    <style>
        /* Design System Colors */
        :root {
            --accent-primary: #B564F7;
            --accent-secondary: #FADCD9;
            --bg-card: #1e1e1e;
            --bg-surface: #121212;
            --text-primary: #EAEAEA;
            --border-subtle: #2e2e2e;
        }

        /* Hero Image Styles */
        .hero-image-container { position: relative; width: 100%; aspect-ratio: 16 / 9; background-color: var(--bg-card); overflow: hidden; border-radius: 1.25rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .hero-image-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; filter: blur(24px) brightness(0.5); transform: scale(1.1); transition: opacity 0.4s ease; }
        .hero-image-container:hover .hero-image-bg { opacity: 1; }
        .hero-image-fg { position: relative; width: 100%; height: 100%; object-fit: cover; z-index: 10; transition: all 0.4s ease; }
        .hero-image-container:hover .hero-image-fg { object-fit: contain; transform: scale(0.9); }
        
        /* Card Styles */
        .card-bg { background-color: var(--bg-card); border: 1px solid var(--border-subtle); }
        
        /* Button Styles */
        .calendar-btn { 
            display: flex; 
            align-items: center; 
            justify-content: space-between;
            padding: 0.75rem 1rem; 
            background-color: #374151; 
            color: white; 
            text-decoration: none; 
            border-radius: 0.75rem; 
            transition: all 0.2s ease;
            border: 1px solid transparent;
            font-weight: 500;
        }
        .calendar-btn:hover { 
            background-color: #4B5563; 
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .google-cal:hover { background-color: #4285f4; border-color: #4285f4; }
        .ical-download:hover { background-color: var(--accent-primary); border-color: var(--accent-primary); }
        
        /* Design System Classes */
        .accent-color { color: var(--accent-primary); }
        .bg-accent-color { background-color: var(--accent-primary); }
        .accent-color-secondary { color: var(--accent-secondary); }
    </style>

    <script>
        // Share functionality
        function shareOnFacebook() {
            const url = encodeURIComponent(window.location.href);
            const title = encodeURIComponent(document.title);
            window.open('https://www.facebook.com/sharer/sharer.php?u=' + url, '_blank', 'width=600,height=400');
        }

        function shareOnTwitter() {
            const url = encodeURIComponent(window.location.href);
            const title = encodeURIComponent(document.title);
            window.open('https://twitter.com/intent/tweet?url=' + url + '&text=' + title, '_blank', 'width=600,height=400');
        }

        async function copyLink() {
            try {
                await navigator.clipboard.writeText(window.location.href);
                // Show feedback
                const btn = event.target.closest('button');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check mr-1"></i> Copied!';
                btn.style.backgroundColor = '#10b981';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.backgroundColor = '';
                }, 2000);
            } catch (err) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = window.location.href;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Link copied to clipboard!');
            }
        }
    </script>
</body>
</html>`;
}

/**
 * Generates the HTML for all "Add to Calendar" links.
 * @param {object} event The event data object.
 * @returns {string} HTML string containing multiple <a> tags.
 */
function generateAddToCalendarLinks(event) {
    const googleLink = 'https://www.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(event.title) + '&dates=' + toICSDate(new Date(event.startTime)) + '/' + toICSDate(new Date(event.endTime)) + '&details=' + encodeURIComponent(event.description) + '&location=' + encodeURIComponent(event.location);
    const icalDataUri = generateIcsDataURI(event);
    const safeTitle = event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Return properly styled buttons matching design system
    return '<a href="' + googleLink + '" target="_blank" rel="noopener noreferrer" class="calendar-btn google-cal">' +
        '<i class="fab fa-google mr-2"></i>' +
        '<span>Google Calendar</span>' +
        '<i class="fas fa-external-link-alt ml-auto text-xs opacity-70"></i>' +
        '</a>' +
        '<a href="' + icalDataUri + '" download="' + safeTitle + '.ics" class="calendar-btn ical-download">' +
        '<i class="fas fa-calendar-plus mr-2"></i>' +
        '<span>Apple/Outlook/Other</span>' +
        '<i class="fas fa-download ml-auto text-xs opacity-70"></i>' +
        '</a>';
}

exports.handler = async function (event, context) {
    console.log('🔍 Event details handler started');
    console.log('📍 Event path:', event.path);
    console.log('🔑 Environment check:', {
        hasAirtableToken: !!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
        hasBaseId: !!process.env.AIRTABLE_BASE_ID,
        baseUrl: process.env.URL || 'https://www.brumoutloud.co.uk'
    });

    const baseUrl = process.env.URL || 'https://www.brumoutloud.co.uk';
    const slug = event.path.split("/").pop();
    
    if (!slug) {
        console.error('❌ No slug provided in path');
        return { statusCode: 400, body: 'Error: Event slug not provided.' };
    }
    
    console.log('🏷️ Extracted slug:', slug);

    // Check if dependencies and Airtable credentials are available
    if (!Airtable || !Handlebars || !base) {
        console.error('❌ Missing dependencies or Airtable credentials:', {
            hasAirtable: !!Airtable,
            hasHandlebars: !!Handlebars,
            hasBase: !!base,
            hasToken: !!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
            hasBaseId: !!process.env.AIRTABLE_BASE_ID
        });
        
        // Return a user-friendly error page
        return await renderErrorPage(slug, 'Server configuration error - missing dependencies or credentials');
    }

    try {
        const dateMatch = slug.match(/\d{4}-\d{2}-\d{2}$/);
        let eventRecords = [];

        console.log("🔄 Attempting to fetch event records from Airtable for slug:", slug);
        
        try {
            if (dateMatch) {
                const dateFromSlug = dateMatch[0];
                console.log('📅 Date-specific event search for:', dateFromSlug);
                const formula = `AND({Slug} = "${slug}", DATETIME_FORMAT(Date, 'YYYY-MM-DD') = '${dateFromSlug}')`;
                console.log('🔍 Using formula:', formula);
                eventRecords = await base('Events').select({ 
                    maxRecords: 1, 
                    filterByFormula: formula 
                }).firstPage();
            } else {
                console.log('🔍 Standard event search');
                const formula = `{Slug} = "${slug}"`;
                console.log('🔍 Using formula:', formula);
                eventRecords = await base('Events').select({ 
                    maxRecords: 1, 
                    filterByFormula: formula 
                }).firstPage();
                
                if (!eventRecords || eventRecords.length === 0) {
                    console.log("⚠️ Standalone event not found, checking for recurring event.");
                    const escapedSlug = slug.replace(/"/g, '"');
                    const recurringFormula = `AND({Slug} = "${escapedSlug}", {Recurring Info})`;
                    console.log('🔍 Recurring formula:', recurringFormula);
                    eventRecords = await base('Events').select({ 
                        maxRecords: 1, 
                        filterByFormula: recurringFormula 
                    }).firstPage();
                    
                    if (!eventRecords || eventRecords.length === 0) {
                        console.log("❌ Event not found after checking recurring info.");
                        return await renderErrorPage(slug, 'Event not found - checked both standard and recurring events');
                    }
                }
            }
        } catch (airtableError) {
            console.error('❌ Airtable query error:', airtableError);
            return await renderErrorPage(slug, `Database query failed: ${airtableError.message}`);
        }
        console.log("Event records fetched. Count:", eventRecords.length);

        const eventRecord = eventRecords[0];
        if (!eventRecord) {
            console.log("❌ Event record is null or undefined.");
            return await renderErrorPage(slug, 'Event record not found in database');
        }
        const fields = eventRecord.fields;
        const eventName = fields['Event Name'];
        const recurringInfo = fields['Recurring Info'];
        const categoryTags = fields['Category'] || [];
        const tagsHtml = categoryTags.map(tag => `<span class="inline-block bg-gray-700 text-gray-300 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full">${tag}</span>`).join('');

        let parentEventName = fields['Parent Event Name'];
        let filterFormula = null;
        let allFutureInstances = [];
        let finalVenueSlug = '';
        let venueWebsiteHtml = '';
        let venueSocialHtml = '';
        
        

        if (parentEventName) {
            const parentNameForQuery = parentEventName.replace(/"/g, '\"');
            filterFormula = `AND({Parent Event Name} = "${parentNameForQuery}", IS_AFTER({Date}, DATEADD(TODAY(),-1,'days')))`
        } else if (recurringInfo) {
            const eventNameForQuery = eventName.replace(/"/g, '\"');
            filterFormula = `AND({Event Name} = "${eventNameForQuery}", {Recurring Info}, IS_AFTER({Date}, DATEADD(TODAY(),-1,'days')))`
        }

        if (filterFormula) {
            const futureInstanceRecords = await base('Events').select({
                filterByFormula: filterFormula,
                sort: [{ field: 'Date', direction: 'asc' }]
            }).all();
            allFutureInstances = futureInstanceRecords.map(rec => rec.fields);
        }

        let venueNameForDisplay = fields['Venue Name'] ? fields['Venue Name'][0] : (fields['VenueText'] || 'TBC');
        let venueHtml = `<p class="text-2xl font-semibold">${venueNameForDisplay}</p>`;

        const venueId = fields['Venue'] ? fields['Venue'][0] : null;

        if (venueId) {
            try {
                const venueRecord = await base('Venues').find(venueId);
                const status = venueRecord.get('Listing Status');
                const name = venueRecord.get('Name');
                const website = venueRecord.get('Website');
                const facebook = venueRecord.get('Facebook');
                const instagram = venueRecord.get('Instagram');
                const twitter = venueRecord.get('Twitter');
                finalVenueSlug = venueRecord.get('Slug') || '';
                venueNameForDisplay = name || venueNameForDisplay;
                if (status === 'Listed' && finalVenueSlug) {
                    venueHtml = `<a href="/venue/${finalVenueSlug}" class="text-2xl font-semibold hover:text-white underline">${venueNameForDisplay}</a>`;
                } else {
                    venueHtml = `<p class="text-2xl font-semibold">${venueNameForDisplay}</p>`;
                }

                if (website) {
                    venueWebsiteHtml = `<a href="${website}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline"><i class="fas fa-globe mr-2"></i> Website</a>`;
                }
                if (facebook) {
                    venueSocialHtml += `<a href="${facebook}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline"><i class="fab fa-facebook-square mr-2"></i> Facebook</a>`;
                }
                if (instagram) {
                    venueSocialHtml += `<a href="${instagram}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline"><i class="fab fa-instagram mr-2"></i> Instagram</a>`;
                }
                if (twitter) {
                    venueSocialHtml += `<a href="${twitter}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline"><i class="fab fa-twitter-square mr-2"></i> Twitter</a>`;
                }

            } catch (venueError) { console.error("Could not fetch linked venue, falling back to text.", venueError); }
        }

        let addressHtml = fields['Address'] ? `<li><i class="fas fa-map-pin text-accent-color mr-3"></i> <strong>Address:</strong> ${fields['Address']}</li>` : '';
        let priceHtml = fields['Price'] ? `<li><i class="fas fa-tag text-accent-color mr-3"></i> <strong>Price:</strong> ${fields['Price']}</li>` : '';
        let ageRestrictionHtml = fields['Age Restriction'] ? `<li><i class="fas fa-user-friends text-accent-color mr-3"></i> <strong>Age:</strong> ${fields['Age Restriction']}</li>` : '';
        let linkHtml = fields['Link'] ? `<li><i class="fas fa-link text-accent-color mr-3"></i> <strong>Link:</strong> <a href="${fields['Link']}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">More Info</a></li>` : '';

        let suggestedEventsHtml = '';
        const primaryEventCategories = fields['Category'] || [];
        const currentEventId = eventRecord.id;

        if (primaryEventCategories.length > 0) {
            const categoryFilterString = primaryEventCategories.map(cat => `FIND("${cat.replace(/"/g, '\"')}", ARRAYJOIN({Category}, ","))`).join(', ');

            const suggestedEventsFilter = `AND({Status} = 'Approved', IS_AFTER({Date}, TODAY()), NOT(RECORD_ID() = '${currentEventId}'), OR(${categoryFilterString}))`;

            const suggestedRecords = await base('Events').select({
                filterByFormula: suggestedEventsFilter,
                sort: [{ field: 'Date', direction: 'asc' }],
                maxRecords: 6,
                fields: ['Event Name', 'Date', 'Promo Image', 'Slug', 'Venue Name', 'VenueText']
            }).all();

            if (suggestedRecords.length > 0) {
                const suggestedCardsHtml = suggestedRecords.map(suggEvent => {
                    const suggEventName = suggEvent.get('Event Name');
                    const suggEventDate = new Date(suggEvent.get('Date'));
                    const suggImageUrl = suggEvent.get('Promo Image') ? suggEvent.get('Promo Image')[0].url : 'https://placehold.co/400x600/1e1e1e/EAEAEA?text=Event';
                    const suggEventSlug = suggEvent.get('Slug');

                    return `<a href="/event/${suggEventSlug}" class="suggested-card aspect-[2/3] w-10/12 md:w-5/12 lg:w-[32%] flex-shrink-0 relative overflow-hidden flex flex-col justify-end snap-start"><div class="absolute inset-0 bg-cover bg-center" style="background-image: url('${suggImageUrl}')"></div><div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent"></div><div class="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-center p-2 rounded-lg z-20"><p class="font-bold text-xl leading-none">${suggEventDate.getDate()}</p><p class="text-sm uppercase">${suggEventDate.toLocaleDateString('en-GB', { month: 'short' })}</p></div><div class="relative z-10 p-4"><h4 class="font-extrabold text-white text-2xl">${suggEventName}</h4></div></a>`;
                }).join('');

                suggestedEventsHtml = `<div class="mt-16 suggested-events-section"><h2 class="font-anton text-4xl mb-8">Don't Miss These...</h2><div class="suggested-carousel flex overflow-x-auto gap-6 snap-x snap-mandatory pr-6">${suggestedCardsHtml}</div></div>`;
            }
        }

        const eventDate = new Date(fields['Date']);
        const description = fields['Description'] || 'No description provided.';
        const pageUrl = `https://brumoutloud.co.uk${event.path}`;
        const imageUrl = fields['Promo Image'] ? fields['Promo Image'][0].url : 'https://placehold.co/1200x675/1a1a1a/f5efe6?text=Brum+Out+Loud';

        const calendarData = {
            title: eventName,
            description: `${description.replace(/\n/g, '\n')}\n\nFind out more: ${pageUrl}`,
            location: venueNameForDisplay,
            startTime: eventDate.toISOString(),
            endTime: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            isRecurring: (parentEventName || recurringInfo) && allFutureInstances.length > 1,
            recurringDates: allFutureInstances.map(i => i.Date)
        };

        const otherInstancesToDisplay = allFutureInstances.filter(inst => inst.Date !== fields['Date']);

        const otherInstancesHTML = otherInstancesToDisplay.slice(0, 5).map(instance => {
            const d = new Date(instance.Date);
            const day = d.toLocaleDateString('en-GB', { day: 'numeric' });
            const month = d.toLocaleDateString('en-GB', { month: 'short' });
            return `<a href="/event/${instance.Slug}" class="card-bg p-4 flex items-center space-x-4 hover:bg-gray-800 transition-colors duration-200 block"><div class="text-center w-20 flex-shrink-0"><p class="text-2xl font-bold text-white">${day}</p><p class="text-lg text-gray-400">${month}</p></div><div class="flex-grow"><h4 class="font-bold text-white text-xl">${instance['Event Name']}</h4><p class="text-sm text-gray-400">${d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' })}</p></div><div class="text-accent-color"><i class="fas fa-arrow-right"></i></div></a>`;
        }).join('');

        // Try multiple possible template paths for different deployment environments
        const possibleTemplatePaths = [
            path.resolve(__dirname, './templates/event-details-template.html'),
            path.resolve(__dirname, '../templates/event-details-template.html'),
            path.resolve(__dirname, 'templates/event-details-template.html'),
            path.join(__dirname, 'templates', 'event-details-template.html'),
            path.join(process.cwd(), 'netlify', 'functions', 'templates', 'event-details-template.html')
        ];
        
        let templatePath = null;
        let htmlTemplate = null;
        
        for (const tryPath of possibleTemplatePaths) {
            try {
                console.log(`📄 Trying template path: ${tryPath}`);
                htmlTemplate = await fs.readFile(tryPath, 'utf8');
                templatePath = tryPath;
                console.log(`✅ Template file found at: ${templatePath}`);
                break;
            } catch (pathError) {
                console.log(`❌ Template not found at: ${tryPath}`);
                continue;
            }
        }
        // Check if we found a template
        if (!htmlTemplate || !templatePath) {
            console.error("❌ No template file found in any of the attempted paths");
            console.log("🔄 Using embedded fallback template");
            
            // Use embedded template as fallback
            htmlTemplate = getEmbeddedEventTemplate();
        }
        
        console.log("✅ Template ready. Length:", htmlTemplate.length);
        console.log("📝 Template source:", templatePath ? `File: ${templatePath}` : 'Embedded fallback');

        console.log("🔄 Preparing data for Handlebars template.");
        const data = {
            eventName: eventName,
            descriptionMeta: description.substring(0, 150).replace(/\n/g, ' ') + '...',
            pageUrlCanonical: `${baseUrl}/event/${slug}`,
            schemaMarkup: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Event",
                "name": eventName,
                "startDate": eventDate.toISOString(),
                "endDate": new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
                "eventStatus": "https://schema.org/EventScheduled",
                "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                "location": {
                    "@type": "Place",
                    "name": venueNameForDisplay,
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": "Birmingham",
                        "addressRegion": "England",
                        "addressCountry": "UK"
                    }
                },
                "image": [imageUrl],
                "description": description.replace(/\n/g, ' ').replace(/"/g, '"'),
                "url": `${baseUrl}/event/${slug}`,
                "offers": {
                    "@type": "Offer",
                    "url": fields['Link'] || `${baseUrl}/event/${slug}`,
                    "price": "0",
                    "priceCurrency": "GBP",
                    "availability": "https://schema.org/InStock"
                }
            }),
            imageUrl: imageUrl,
            eventDateFormatted: eventDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
            eventTimeFormatted: eventDate.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }),
            venueHtml: venueHtml,
            tagsHtml: tagsHtml,
            description: description.replace(/\n/g, '<br>'),
            ticketLink: fields['Link'],
            calendarLinksHtml: generateAddToCalendarLinks(calendarData),
            otherInstancesHTML: otherInstancesHTML,
            suggestedEventsHtml: suggestedEventsHtml,
            venueNameForDisplay: venueNameForDisplay,
            venueSlug: finalVenueSlug,
            addressHtml: addressHtml,
            priceHtml: priceHtml,
            ageRestrictionHtml: ageRestrictionHtml,
            linkHtml: linkHtml,
            venueWebsiteHtml: venueWebsiteHtml,
            venueSocialHtml: venueSocialHtml,
            hasEventDetails: !!(addressHtml || priceHtml || ageRestrictionHtml || linkHtml)
        };

        console.log("🔄 Compiling Handlebars template...");
        try {
            const template = Handlebars.compile(htmlTemplate);
            console.log("✅ Template compiled successfully");
            
            console.log("🔄 Rendering template with data...");
            htmlTemplate = template(data);
            console.log("✅ Template rendered successfully");
        } catch (templateError) {
            console.error("❌ Error compiling or rendering Handlebars template:", templateError);
            console.error("📊 Template error details:", {
                name: templateError.name,
                message: templateError.message,
                stack: templateError.stack
            });
            return await renderErrorPage(slug, `Template rendering error: ${templateError.message}`);
        }

        console.log("Final htmlTemplate length:", htmlTemplate.length);
        const response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60'
            },
            body: htmlTemplate
        };
        console.log("Returning response:", response);
        return response;

    } catch (error) {
        console.error("❌ Caught error in handler:", error);
        console.error("📊 Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack,
            slug: slug || 'unknown'
        });
        
        return await renderErrorPage(slug, `Server error: ${error.message}`);
    }
};