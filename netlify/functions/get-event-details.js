const EventService = require('./services/event-service');
const SeriesManager = require('./services/series-manager');
const Handlebars = require('handlebars');

// Version: 2025-07-25-v6 - Temporarily disabled new features for recurring events stability

const eventService = new EventService();
const seriesManager = new SeriesManager();

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
    
    const googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(name)}&dates=${formatDateForGoogle(eventDate)}/${formatDateForGoogle(endDate)}&details=${encodeURIComponent(description || '')}&location=${encodeURIComponent(venue.name)}`;
    
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
        
        // Use the new service to get event data
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
        console.log("Event data structure:", JSON.stringify({
          id: eventData.id,
          name: eventData.name,
          slug: eventData.slug,
          hasDate: !!eventData.date,
          hasSeries: !!eventData.series,
          seriesType: eventData.series?.type,
          venue: eventData.venue?.name
        }, null, 2));

        // Get other instances if this is a series event
        let otherInstances = [];
        if (eventData.series && eventData.series.type === 'recurring') {
            try {
                const seriesWithInstances = await seriesManager.getSeriesWithInstances(
                    eventData.series.id, 
                    { limit: 6, futureOnly: true }
                );
                otherInstances = seriesWithInstances.events.filter(instance => 
                    instance.id !== eventData.id
                );
            } catch (error) {
                console.error('Error getting series instances:', error);
            }
        }

        // Get similar events based on categories (temporarily disabled for stability)
        let similarEvents = [];
        // TODO: Re-enable similar events after fixing recurring events stability

        // Format description and optionally update Airtable (temporarily disabled for recurring events)
        let formattedDescription = eventData.description;
        if (eventData.description && !eventData.series) {
            // TODO: Re-enable description formatting after fixing recurring events stability
        }

        // Embedded template to avoid file system issues in Netlify Functions
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
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    
    <style>
        /* Base Styles */
        body {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #0a0a0a 100%);
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

        .venue-card {
            background: rgba(31, 41, 55, 0.8);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(75, 85, 99, 0.3);
            border-radius: 1rem;
            transition: all 0.3s ease;
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
            display: inline-block;
        }
        .status-badge.approved {
            background: rgba(16, 185, 129, 0.2);
            color: #10B981;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        /* Mobile-specific styles */
        @media (max-width: 768px) {
            .mobile-sticky-bottom {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(17, 24, 39, 0.95);
                backdrop-filter: blur(20px);
                border-top: 1px solid rgba(75, 85, 99, 0.5);
                padding: 1rem;
                z-index: 50;
            }
            
            .mobile-content-padding {
                padding-bottom: 5rem;
            }
        }

        /* Animation */
        .animate-fade-in {
            animation: fadeIn 0.6s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <!-- Header -->
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <!-- Site name with consolidated flag image and fallback -->
            <a href="/" class="flex items-center text-2xl tracking-widest text-white"
               style="font-family: 'Omnes Pro', sans-serif;">
                <span>Brum Outloud</span>
                <!-- Consolidated flag image: tries to load header_flag.png, falls back to emoji placeholder -->
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded" loading="lazy"
                     onerror="this.src='https://placehold.co/24x24/000000/FFFFFF?text=🏳️‍🌈'; this.onerror=null;">
            </a>
            <div class="hidden lg:flex items-center space-x-8">
                <a href="/events.html" class="text-gray-300 hover:text-white">WHAT'S ON</a>
                <a href="/all-venues.html" class="text-gray-300 hover:text-white">VENUES</a>
                <a href="/community.html" class="text-gray-300 hover:text-white">COMMUNITY</a>
                <a href="/contact.html" class="text-gray-300 hover:text-white">CONTACT</a>
                <!-- GET LISTED button styling reverted to original Tailwind classes -->
                <a href="/promoter-tool.html" class="inline-block bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200">GET LISTED</a>
            </div>
            <div class="lg:hidden relative z-[60]">
                <button id="menu-btn" class="text-white text-2xl">
                    <i class="fas fa-bars"></i>
                </button>
            </div>
        </nav>
        <div id="menu" class="hidden lg:hidden fixed inset-0 bg-gray-900 z-50 flex-col items-center justify-center space-y-6">
            <a href="/events.html" class="block text-white text-4xl py-4 hover:text-gray-300">WHAT'S ON</a>
            <a href="/all-venues.html" class="block text-white text-4xl py-4 hover:text-gray-300">VENUES</a>
            <a href="/community.html" class="block text-white text-4xl py-4 hover:text-gray-300">COMMUNITY</a>
            <a href="/contact.html" class="block text-white text-4xl py-4 hover:text-gray-300">CONTACT</a>
            <a href="/promoter-tool.html" class="block mt-4 text-center bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors duration-200 text-2xl px-8 py-4">GET LISTED</a>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8">
        <!-- Breadcrumb -->
        <nav class="mb-8">
            <ol class="flex items-center space-x-2 text-sm text-gray-400">
                <li><a href="/" class="hover:text-white transition-colors">Home</a></li>
                <li><span class="mx-2">/</span></li>
                <li><a href="/events.html" class="hover:text-white transition-colors">Events</a></li>
                <li><span class="mx-2">/</span></li>
                <li class="text-white">{{event.name}}</li>
            </ol>
        </nav>

        <!-- Event Details Card -->
        <div class="venue-card rounded-xl overflow-hidden">
            <!-- Hero Image -->
            <div class="w-full bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center relative" style="aspect-ratio: 500/217;">
                {{#if event.image}}
                <img src="{{event.image.url}}" alt="{{event.name}}" class="w-full h-full object-cover">
                {{else}}
                <i class="fas fa-image text-6xl text-gray-600"></i>
                {{/if}}
                                            <div class="absolute top-4 right-4">
                                <button class="btn-secondary text-white px-3 py-1 rounded-lg text-sm" onclick="shareEvent()">
                                    <i class="fas fa-share mr-1"></i>Share
                                </button>
                            </div>
            </div>
            
            <div class="p-8">
                <!-- Event Header -->
                <div class="mb-8">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="text-center w-20 flex-shrink-0">
                            <div class="text-4xl font-bold text-white">{{formatDay event.date}}</div>
                            <div class="text-sm text-gray-400">{{formatMonth event.date}}</div>
                        </div>
                        <div class="flex-1">
                            <h1 class="text-4xl font-bold text-white mb-2">{{event.name}}</h1>
                            <p class="text-xl text-gray-300 mb-2">
                                <i class="fas fa-map-marker-alt mr-2 text-accent-color"></i>
                                {{event.venue.name}}
                            </p>
                            <p class="text-gray-400">
                                <i class="fas fa-clock mr-2"></i>
                                {{formatDate event.date}}
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 mb-6">
                        {{{categoryTags}}}
                        {{#if event.recurringInfo}}
                        <span class="inline-block bg-teal-400/10 text-teal-300 text-sm px-3 py-1 rounded-full">{{event.recurringInfo}}</span>
                        {{/if}}
                        {{#if event.promotion.boosted}}
                        <span class="inline-block bg-yellow-400/10 text-yellow-300 text-sm px-3 py-1 rounded-full">BOOSTED</span>
                        {{/if}}
                    </div>
                </div>

                <!-- Event Content -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Main Content -->
                    <div class="lg:col-span-2">
                        <div class="venue-card p-6 mb-6">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-info-circle mr-3 text-accent-color"></i>About This Event
                            </h2>
                            <div class="text-gray-300 leading-relaxed mb-4 whitespace-pre-line">
                                {{{event.description}}}
                            </div>
                        </div>

                        <!-- You Might Like Events -->
                        {{#if hasSimilarEvents}}
                        <div class="venue-card p-6 mb-6">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-heart mr-3 text-accent-color"></i>You Might Like
                            </h2>
                            <div class="space-y-4">
                                {{#each similarEvents}}
                                <a href="/event/{{slug}}" class="venue-card p-4 flex items-center space-x-4 hover:bg-gray-800 transition-colors duration-200 block">
                                    <div class="text-center w-20 flex-shrink-0">
                                        <p class="text-2xl font-bold text-white">{{formatDay date}}</p>
                                        <p class="text-lg text-gray-400">{{formatMonth date}}</p>
                                    </div>
                                    <div class="flex-grow">
                                        <h4 class="font-bold text-white text-xl">{{name}}</h4>
                                        <p class="text-sm text-gray-400">{{formatTime date}} • {{venue.name}}</p>
                                        <div class="flex flex-wrap gap-1 mt-2">
                                            {{#each category}}
                                            <span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full">{{this}}</span>
                                            {{/each}}
                                        </div>
                                    </div>
                                    <div class="text-accent-color">
                                        <i class="fas fa-arrow-right"></i>
                                    </div>
                                </a>
                                {{/each}}
                            </div>
                        </div>
                        {{/if}}

                        <!-- Other Events in Series -->
                        {{#if hasOtherInstances}}
                        <div class="venue-card p-6 mb-6">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-calendar mr-3 text-accent-color"></i>Other Events in this Series
                            </h2>
                            <div class="space-y-4">
                                {{#each otherInstances}}
                                <a href="/event/{{slug}}" class="venue-card p-4 flex items-center space-x-4 hover:bg-gray-800 transition-colors duration-200 block">
                                    <div class="text-center w-20 flex-shrink-0">
                                        <p class="text-2xl font-bold text-white">{{formatDay date}}</p>
                                        <p class="text-lg text-gray-400">{{formatMonth date}}</p>
                                    </div>
                                    <div class="flex-grow">
                                        <h4 class="font-bold text-white text-xl">{{name}}</h4>
                                        <p class="text-sm text-gray-400">{{formatTime date}}</p>
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
                        <!-- Date & Time -->
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4">
                                <i class="fas fa-calendar mr-2 text-accent-color"></i>Date & Time
                            </h3>
                            <p class="text-2xl font-semibold text-white">{{formatDateOnly event.date}}</p>
                            <p class="text-xl text-gray-400">{{formatTime event.date}}</p>
                            {{#if event.recurringInfo}}
                            <div class="mt-2">
                                <span class="inline-block bg-teal-400/10 text-teal-300 text-xs font-semibold px-2 py-1 rounded-full">{{event.recurringInfo}}</span>
                            </div>
                            {{/if}}
                        </div>

                                                 <!-- Location -->
                         <div class="venue-card p-6">
                             <h3 class="text-xl font-bold text-white mb-4">
                                 <i class="fas fa-map-marker-alt mr-2 text-accent-color"></i>Location
                             </h3>
                             <div class="space-y-3">
                                 <div>
                                     <h4 class="font-semibold text-white">{{event.venue.name}}</h4>
                                     {{#if event.venue.address}}
                                     <p class="text-gray-400 text-sm">{{event.venue.address}}</p>
                                     {{/if}}
                                 </div>
                                 {{#if event.venue.phone}}
                                 <div class="flex items-center gap-2 text-gray-400 text-sm">
                                     <i class="fas fa-phone"></i>
                                     <span>{{event.venue.phone}}</span>
                                 </div>
                                 {{/if}}
                                 {{#if event.venue.website}}
                                 <div class="flex items-center gap-2 text-gray-400 text-sm">
                                     <i class="fas fa-globe"></i>
                                     <a href="{{event.venue.website}}" target="_blank" rel="noopener noreferrer" class="text-accent-color hover:underline">Visit Website</a>
                                 </div>
                                 {{/if}}
                                 <button class="btn-secondary text-white w-full py-2 px-4 rounded-lg text-sm" onclick="getDirections()">
                                     <i class="fas fa-map-marker-alt mr-1"></i>Get Directions
                                 </button>
                             </div>
                         </div>



                        <!-- Action Buttons -->
                        <div class="venue-card p-6">
                            <div class="space-y-3">
                                {{#if event.details.link}}
                                <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold">
                                    <i class="fas fa-ticket-alt mr-2"></i>Get Tickets / Info
                                </a>
                                {{else}}
                                <button class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold" onclick="contactOrganizer()">
                                    <i class="fas fa-envelope mr-2"></i>Contact Organizer
                                </button>
                                {{/if}}
                            </div>
                        </div>

                        <!-- Add to Calendar -->
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-calendar-plus mr-2 text-accent-color"></i>Add to Calendar
                            </h3>
                            <div class="space-y-3">
                                <a href="{{calendarLinks.google}}" target="_blank" rel="noopener noreferrer" class="btn-secondary text-white w-full py-2 px-4 rounded-lg text-sm flex items-center justify-center">
                                    <i class="fab fa-google mr-2"></i>Google Calendar
                                </a>
                                <a href="{{calendarLinks.ical}}" download="{{event.slug}}.ics" class="btn-secondary text-white w-full py-2 px-4 rounded-lg text-sm flex items-center justify-center">
                                    <i class="fas fa-calendar-plus mr-2"></i>Apple/Outlook/Other
                                </a>
                            </div>
                        </div>

                        <!-- Share Event -->
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-share-alt mr-2 text-accent-color"></i>Share This Event
                            </h3>
                            <button class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold" onclick="shareEvent()">
                                <i class="fas fa-share-alt mr-2"></i>Share Event
                            </button>
                        </div>

                                                <!-- Event Details -->
                        {{#if event.details.price}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4">
                                <i class="fas fa-info-circle mr-2 text-accent-color"></i>Event Details
                            </h3>
                            <div class="space-y-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-gray-400">Price:</span>
                                    <span class="text-white font-semibold">{{event.details.price}}</span>
                                </div>
                                {{#if event.details.ageRestriction}}
                                <div class="flex items-center justify-between">
                                    <span class="text-gray-400">Age Restriction:</span>
                                    <span class="text-white font-semibold">{{event.details.ageRestriction}}</span>
                                </div>
                                {{/if}}
                            </div>
                        </div>
                        {{/if}}
                    </div>
                </div>
            </div>
        </div>

        <!-- Mobile Action Buttons - Sticky Bottom -->
        <div class="mobile-sticky-bottom md:hidden">
            <div class="flex gap-2">
                {{#if event.details.link}}
                <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white flex-1 py-3 px-4 rounded-lg font-bold text-sm">
                    <i class="fas fa-ticket-alt mr-1"></i>Get Tickets
                </a>
                {{else}}
                <button class="btn-primary text-white flex-1 py-3 px-4 rounded-lg font-bold text-sm" onclick="shareEvent()">
                    <i class="fas fa-share mr-1"></i>Share Event
                </button>
                {{/if}}
                <button class="btn-secondary text-white px-4 py-3 rounded-lg font-bold text-sm" onclick="addToCalendar()">
                    <i class="fas fa-calendar-plus"></i>
                </button>
                {{#if event.details.link}}
                <button class="btn-secondary text-white px-4 py-3 rounded-lg font-bold text-sm" onclick="shareEvent()">
                    <i class="fas fa-share"></i>
                </button>
                {{/if}}
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="border-t-2 border-gray-800 p-8 mt-16">
        <div class="container mx-auto grid md:grid-cols-2">
            <div>
                <h3 class="font-anton text-5xl leading-tight text-white">BE SEEN,<br>BE HEARD.</h3>
                <div class="flex space-x-6 text-2xl mt-6 text-gray-400">
                    <a href="https://www.instagram.com/brumoutloud/" target="_blank" rel="noopener noreferrer" class="hover:accent-color"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-8 mt-8 md:mt-0">
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">Explore</h4>
                    <ul>
                        <li class="mb-2"><a href="/events.html" class="text-gray-400 hover:text-white">Events</a></li>
                        <li class="mb-2"><a href="/all-venues.html" class="text-gray-400 hover:text-white">Venues</a></li>
                        <li class="mb-2"><a href="/promoter-tool" class="text-gray-400 hover:text-white">Promoter Tools</a></li>
                        <li class="mb-2"><a href="/admin/settings" class="text-gray-400 hover:text-white">ADMIN</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">About</h4>
                    <ul>
                        <li class="mb-2"><a href="/community.html" class="text-gray-400 hover:text-white">Community & FAQ</a></li>
                        <li class="mb-2"><a href="/contact" class="text-gray-400 hover:text-white">Contact</a></li>
                        <li class="mb-2"><a href="/privacy-policy.html" class="text-gray-400 hover:text-white">Privacy Policy</a></li>
                        <li class="mb-2"><a href="/terms-and-conditions.html" class="text-gray-400 hover:text-white">Terms and Conditions</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>

    <script>
        // Helper functions for date formatting
        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        }
        
        function formatDateOnly(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric'
            });
        }
        
        function formatTime(dateString) {
            const date = new Date(dateString);
            return date.toLocaleTimeString('en-GB', { 
                hour: 'numeric',
                minute: '2-digit'
            });
        }
        
        function formatDay(dateString) {
            const date = new Date(dateString);
            return date.getDate();
        }
        
        function formatMonth(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
        }

        // Event action functions
        function shareEvent() {
            if (navigator.share) {
                navigator.share({
                    title: '{{event.name}}',
                    text: '{{event.description}}',
                    url: window.location.href
                });
            } else {
                // Fallback: copy to clipboard
                navigator.clipboard.writeText(window.location.href).then(() => {
                    alert('Event link copied to clipboard!');
                });
            }
        }

                 function getDirections() {
             const venue = '{{event.venue.name}}';
             const address = '{{event.venue.address}}' || '';
             const query = encodeURIComponent(venue + ' ' + address);
             window.open(\`https://www.google.com/maps/search/?api=1&query=\${query}\`, '_blank');
         }

        function addToCalendar() {
            // Open calendar options
            const googleLink = '{{calendarLinks.google}}';
            const icalLink = '{{calendarLinks.ical}}';
            
            if (confirm('Choose calendar option:\\n\\nOK - Google Calendar\\nCancel - Download ICS file')) {
                window.open(googleLink, '_blank');
            } else {
                window.location.href = icalLink;
            }
        }

        function contactOrganizer() {
            // This could open a contact form or email
            alert('Contact organizer functionality will be implemented soon!');
        }

        // Mobile menu functionality
        document.addEventListener('DOMContentLoaded', function() {
            const menuBtn = document.getElementById('menu-btn');
            const menu = document.getElementById('menu');
            
            if (menuBtn && menu) {
                menuBtn.addEventListener('click', function() {
                    menu.classList.toggle('hidden');
                    menu.classList.toggle('flex');
                });
            }

            // Format all dates on the page
            const dateElements = document.querySelectorAll('[data-date]');
            dateElements.forEach(element => {
                const dateString = element.getAttribute('data-date');
                element.textContent = formatDate(dateString);
            });
        });
    </script>
</body>
</html>`;
        const template = Handlebars.compile(templateContent);

        // Prepare template data
        const templateData = {
            event: {
                ...eventData,
                description: formattedDescription
            },
            otherInstances: otherInstances,
            hasOtherInstances: otherInstances.length > 0,
            similarEvents: similarEvents,
            hasSimilarEvents: similarEvents.length > 0,
            calendarLinks: generateCalendarLinks(eventData),
            categoryTags: (eventData.category || []).map(tag => 
                `<span class="inline-block bg-blue-100/20 text-blue-300 text-sm px-3 py-1 rounded-full">${tag}</span>`
            ).join(''),
            formatDate: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return 'Date TBC';
                    }
                    return date.toLocaleDateString('en-GB', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                } catch (error) {
                    return 'Date TBC';
                }
            },
            formatDateOnly: (dateString) => {
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
            },
            formatTime: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return 'Time TBC';
                    }
                    return date.toLocaleTimeString('en-GB', { 
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                } catch (error) {
                    return 'Time TBC';
                }
            },
            formatDay: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return '--';
                    }
                    return date.getDate();
                } catch (error) {
                    return '--';
                }
            },
            formatMonth: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return '---';
                    }
                    return date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
                } catch (error) {
                    return '---';
                }
            }
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



