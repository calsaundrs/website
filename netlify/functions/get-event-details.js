const EventService = require('./services/event-service');
const SeriesManager = require('./services/series-manager');
const Handlebars = require('handlebars');

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
    const eventDate = new Date(date);
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
    const eventDate = new Date(date);
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    
    const googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(name)}&dates=${eventDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(description || '')}&location=${encodeURIComponent(venue.name)}`;
    
    return {
        google: googleLink,
        ical: generateIcsDataURI(eventData)
    };
}

exports.handler = async function (event, context) {
    const slug = event.path.split("/").pop();
    
    if (!slug) {
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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    
    <style>
        :root {
            --accent-color: #ff6b6b;
            --accent-color-secondary: #4ecdc4;
        }
        
        .accent-color { color: var(--accent-color); }
        .accent-color-secondary { color: var(--accent-color-secondary); }
        .bg-accent-color { background-color: var(--accent-color); }
        .bg-accent-color-secondary { background-color: var(--accent-color-secondary); }
        
        .heading-gradient {
            background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .card-bg {
            background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
            border: 1px solid #333;
        }
        
        .animate-fade-in {
            animation: fadeIn 0.5s ease-in-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .category-tag {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            display: inline-block;
            margin: 0.125rem;
        }
        
        .recurring-event-tag {
            background: linear-gradient(135deg, #4ecdc4 0%, #6ee7df 100%);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            display: inline-block;
            margin: 0.125rem;
        }
        
        .boosted-listing-tag {
            background: linear-gradient(135deg, #ffd93d 0%, #ffe066 100%);
            color: #333;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            display: inline-block;
            margin: 0.125rem;
        }
        
        .calendar-link {
            display: inline-flex;
            align-items: center;
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, #4ecdc4 0%, #6ee7df 100%);
            color: white;
            text-decoration: none;
            border-radius: 0.5rem;
            font-weight: 600;
            margin: 0.5rem;
            transition: all 0.3s ease;
        }
        
        .calendar-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
        }
        
        .calendar-link.google {
            background: linear-gradient(135deg, #4285f4 0%, #5a9eff 100%);
        }
        
        .calendar-link.ical {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
        }
    </style>
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <!-- Header -->
    <header class="border-b-2 border-gray-800">
        <div class="container mx-auto px-4 py-6">
            <div class="flex justify-between items-center">
                <a href="/" class="font-anton text-4xl heading-gradient">
                    BRUM<span class="accent-color">OUT</span>LOUD
                </a>
                <nav class="hidden md:flex space-x-8">
                    <a href="/events.html" class="text-gray-300 hover:text-white transition-colors">Events</a>
                    <a href="/all-venues.html" class="text-gray-300 hover:text-white transition-colors">Venues</a>
                    <a href="/community.html" class="text-gray-300 hover:text-white transition-colors">Community</a>
                </nav>
            </div>
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

        <!-- Event Details -->
        <div class="grid lg:grid-cols-3 gap-8">
            <!-- Main Event Info -->
            <div class="lg:col-span-2">
                <div class="card-bg rounded-lg p-8 mb-8">
                    <!-- Event Header -->
                    <div class="mb-6">
                        <div class="flex flex-wrap gap-2 mb-4">
                            {{{categoryTags}}}
                            {{#if event.recurringInfo}}
                            <span class="recurring-event-tag">RECURRING</span>
                            {{/if}}
                            {{#if event.promotion.boosted}}
                            <span class="boosted-listing-tag">BOOSTED</span>
                            {{/if}}
                        </div>
                        
                        <h1 class="text-4xl font-bold text-white mb-4">{{event.name}}</h1>
                        
                        <div class="flex items-center text-gray-400 mb-4">
                            <i class="fas fa-calendar-alt mr-2"></i>
                            <span>{{formatDate event.date}}</span>
                        </div>
                        
                        <div class="flex items-center text-gray-400 mb-6">
                            <i class="fas fa-map-marker-alt mr-2"></i>
                            <span>{{event.venue.name}}</span>
                        </div>
                    </div>

                    <!-- Event Image -->
                    {{#if event.image}}
                    <div class="mb-6">
                        <img src="{{event.image.url}}" alt="{{event.name}}" class="w-full h-64 object-cover rounded-lg">
                    </div>
                    {{/if}}

                    <!-- Event Description -->
                    {{#if event.description}}
                    <div class="mb-6">
                        <h2 class="text-2xl font-bold text-white mb-4">About This Event</h2>
                        <p class="text-gray-300 leading-relaxed">{{event.description}}</p>
                    </div>
                    {{/if}}

                    <!-- Calendar Links -->
                    <div class="mb-6">
                        <h2 class="text-2xl font-bold text-white mb-4">Add to Calendar</h2>
                        <div class="flex flex-wrap">
                            <a href="{{calendarLinks.google}}" target="_blank" rel="noopener noreferrer" class="calendar-link google">
                                <i class="fab fa-google mr-2"></i> Google Calendar
                            </a>
                            <a href="{{calendarLinks.ical}}" download="{{event.slug}}.ics" class="calendar-link ical">
                                <i class="fas fa-calendar-plus mr-2"></i> Apple/Outlook/Other
                            </a>
                        </div>
                    </div>

                    <!-- Event Link -->
                    {{#if event.details.link}}
                    <div class="mb-6">
                        <h2 class="text-2xl font-bold text-white mb-4">Event Link</h2>
                        <a href="{{event.details.link}}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center bg-accent-color text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
                            <i class="fas fa-external-link-alt mr-2"></i>
                            Visit Event Page
                        </a>
                    </div>
                    {{/if}}
                </div>

                <!-- Other Instances (for recurring events) -->
                {{#if hasOtherInstances}}
                <div class="card-bg rounded-lg p-8">
                    <h2 class="text-2xl font-bold text-white mb-6">Other Instances</h2>
                    <div class="grid md:grid-cols-2 gap-4">
                        {{#each otherInstances}}
                        <div class="bg-gray-800 rounded-lg p-4">
                            <h3 class="font-semibold text-white mb-2">{{name}}</h3>
                            <p class="text-gray-400 text-sm">{{formatDate date}}</p>
                            <p class="text-gray-400 text-sm">{{venue.name}}</p>
                        </div>
                        {{/each}}
                    </div>
                </div>
                {{/if}}
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-1">
                <div class="card-bg rounded-lg p-6 sticky top-8">
                    <h2 class="text-xl font-bold text-white mb-4">Event Details</h2>
                    
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Date & Time</h3>
                            <p class="text-white">{{formatDate event.date}}</p>
                        </div>
                        
                        <div>
                            <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Venue</h3>
                            <p class="text-white">{{event.venue.name}}</p>
                        </div>
                        
                        {{#if event.details.price}}
                        <div>
                            <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Price</h3>
                            <p class="text-white">{{event.details.price}}</p>
                        </div>
                        {{/if}}
                        
                        {{#if event.details.ageRestriction}}
                        <div>
                            <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Age Restriction</h3>
                            <p class="text-white">{{event.details.ageRestriction}}</p>
                        </div>
                        {{/if}}
                        
                        {{#if event.recurringInfo}}
                        <div>
                            <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recurring Info</h3>
                            <p class="text-white">{{event.recurringInfo}}</p>
                        </div>
                        {{/if}}
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
        // Helper function to format dates
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
        
        // Format all dates on the page
        document.addEventListener('DOMContentLoaded', function() {
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
            event: eventData,
            otherInstances: otherInstances,
            hasOtherInstances: otherInstances.length > 0,
            calendarLinks: generateCalendarLinks(eventData),
            categoryTags: (eventData.category || []).map(tag => 
                `<span class="category-tag">${tag}</span>`
            ).join(''),
            formatDate: (dateString) => {
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



