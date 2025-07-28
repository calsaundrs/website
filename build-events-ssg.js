const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

// Initialize Firebase Admin with error handling
let firebaseInitialized = false;
if (!admin.apps.length) {
    try {
        // Check if all required environment variables are present
        const requiredVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL', 
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.warn(`⚠️  Missing Firebase environment variables: ${missingVars.join(', ')}`);
            console.warn('SSG will be skipped. Event pages will not be generated.');
            console.warn('Please set the following environment variables in Netlify:');
            console.warn('- FIREBASE_PROJECT_ID');
            console.warn('- FIREBASE_CLIENT_EMAIL');
            console.warn('- FIREBASE_PRIVATE_KEY');
            console.warn('- CLOUDINARY_CLOUD_NAME (optional)');
            console.warn('');
            console.warn('The site will continue to work with dynamic event pages.');
        } else {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
            firebaseInitialized = true;
            console.log('✅ Firebase initialized successfully');
        }
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error.message);
        console.warn('SSG will be skipped. Event pages will not be generated.');
        console.warn('The site will continue to work with dynamic event pages.');
    }
} else {
    firebaseInitialized = true;
}

const db = admin.firestore();

// Load the event template
async function loadEventTemplate() {
    try {
        const templatePath = path.join(__dirname, 'event-template.html');
        const templateContent = await fs.readFile(templatePath, 'utf8');
        return Handlebars.compile(templateContent);
    } catch (error) {
        console.error('❌ Error loading event template:', error.message);
        throw error;
    }
}

// Register Handlebars helpers
function registerHelpers() {
    Handlebars.registerHelper('formatDate', function(dateString) {
        if (!dateString) return 'Date TBC';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    });

    Handlebars.registerHelper('formatShortDate', function(dateString) {
        if (!dateString) return 'Date TBC';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric'
        });
    });

    Handlebars.registerHelper('generateCalendarLinks', function(eventData) {
        const { name, description, venue, date } = eventData;
        
        if (!date) return { google: '#', ical: '#' };
        
        let eventDate;
        try {
            eventDate = new Date(date);
            if (isNaN(eventDate.getTime())) {
                eventDate = new Date();
            }
        } catch (error) {
            eventDate = new Date();
        }
        
        const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
        
        // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ format)
        const formatDateForGoogle = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };
        
        const googleLink = 'https://www.google.com/calendar/render?action=TEMPLATE&text=' + 
            encodeURIComponent(name) + '&dates=' + 
            formatDateForGoogle(eventDate) + '/' + 
            formatDateForGoogle(endDate) + '&details=' + 
            encodeURIComponent(description || '') + '&location=' + 
            encodeURIComponent(venue.name);
        
        // Generate ICS data URI
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//BrumOutloud//EN',
            'BEGIN:VEVENT',
            'UID:' + new Date().getTime() + ' @brumoutloud.co.uk',
            'DTSTAMP:' + formatDateForGoogle(new Date()),
            'DTSTART:' + formatDateForGoogle(eventDate),
            'DTEND:' + formatDateForGoogle(endDate),
            'SUMMARY:' + name,
            'DESCRIPTION:' + (description || '').replace(/\n/g, '\\n'),
            'LOCATION:' + venue.name,
            'END:VEVENT',
            'END:VCALENDAR'
        ];
        const icsString = icsContent.join('\r\n');
        const icalLink = 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsString);
        
        return { google: googleLink, ical: icalLink };
    });

    Handlebars.registerHelper('generateCategoryTags', function(categories) {
        if (!categories || categories.length === 0) return '';
        
        return categories.map(category => 
            `<span class="category-tag">${category}</span>`
        ).join('');
    });

    Handlebars.registerHelper('generateRecurringBadge', function(recurringInfo) {
        if (!recurringInfo) return '';
        
        let patternLabel = 'Recurring Event';
        const info = typeof recurringInfo === 'string' ? JSON.parse(recurringInfo) : recurringInfo;
        
        if (info.type === 'weekly') {
            patternLabel = 'Weekly Event';
        } else if (info.type === 'monthly') {
            patternLabel = 'Monthly Event';
        } else if (info.type === 'daily') {
            patternLabel = 'Daily Event';
        } else if (info.type === 'bi-weekly') {
            patternLabel = 'Bi-Weekly Event';
        } else if (info.type === 'yearly') {
            patternLabel = 'Annual Event';
        }
        
        return `<span class="recurring-event-tag"><i class="fas fa-redo mr-1"></i>${patternLabel}</span>`;
    });

    Handlebars.registerHelper('generateBoostedBadge', function(eventData) {
        if (!eventData.boostedListingStartDate || !eventData.boostedListingEndDate) return '';
        
        const now = new Date();
        const startDate = new Date(eventData.boostedListingStartDate);
        const endDate = new Date(eventData.boostedListingEndDate);
        
        if (now >= startDate && now <= endDate) {
            return `<span class="boosted-listing-tag"><i class="fas fa-star mr-1"></i>Featured</span>`;
        }
        
        return '';
    });

    Handlebars.registerHelper('generateEventSections', function(eventData) {
        let sections = '';
        
        // Price section
        if (eventData.price) {
            sections += `
                <div>
                    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Price</h3>
                    <p class="text-white">${eventData.price}</p>
                </div>
            `;
        }
        
        // Age restriction section
        if (eventData.ageRestriction) {
            sections += `
                <div>
                    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Age Restriction</h3>
                    <p class="text-white">${eventData.ageRestriction}</p>
                </div>
            `;
        }
        
        // Organizer section
        if (eventData.organizer) {
            sections += `
                <div>
                    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Organizer</h3>
                    <p class="text-white">${eventData.organizer}</p>
                </div>
            `;
        }
        
        // Recurring info section
        if (eventData.recurringInfo) {
            const info = typeof eventData.recurringInfo === 'string' ? JSON.parse(eventData.recurringInfo) : eventData.recurringInfo;
            let recurringText = '';
            
            if (info.type === 'weekly') {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const dayNames = info.days.map(day => days[day]).join(', ');
                recurringText = `Every ${dayNames}`;
            } else if (info.type === 'monthly') {
                if (info.monthlyType === 'date') {
                    recurringText = `Monthly on the ${info.dayOfMonth}${getOrdinalSuffix(info.dayOfMonth)}`;
                } else if (info.monthlyType === 'day') {
                    const weeks = ['first', 'second', 'third', 'fourth', 'last'];
                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    recurringText = `${weeks[info.week - 1]} ${days[info.dayOfWeek]} of each month`;
                }
            }
            
            if (recurringText) {
                sections += `
                    <div>
                        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recurring Info</h3>
                        <p class="text-white">${recurringText}</p>
                    </div>
                `;
            }
        }
        
        // Accessibility section
        if (eventData.accessibility) {
            sections += `
                <div>
                    <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Accessibility</h3>
                    <p class="text-white">${eventData.accessibility}</p>
                </div>
            `;
        }
        
        return sections;
    });

    Handlebars.registerHelper('generateTicketButton', function(eventData) {
        if (eventData.ticketLink) {
            return `
                <a href="${eventData.ticketLink}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                    <i class="fas fa-ticket-alt mr-2"></i>Get Tickets
                </a>
            `;
        }
        return '';
    });

    Handlebars.registerHelper('generateEventLinks', function(eventData) {
        if (!eventData.eventLink && !eventData.facebookEvent) return '';
        
        let links = '<div class="mb-6"><h2 class="text-2xl font-bold text-white mb-4"><i class="fas fa-link mr-3 text-accent-color"></i>Event Links</h2><div class="space-y-3">';
        
        if (eventData.eventLink) {
            links += `
                <a href="${eventData.eventLink}" target="_blank" rel="noopener noreferrer" class="btn-secondary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                    <i class="fas fa-external-link-alt mr-2"></i>Event Website
                </a>
            `;
        }
        
        if (eventData.facebookEvent) {
            links += `
                <a href="${eventData.facebookEvent}" target="_blank" rel="noopener noreferrer" class="btn-secondary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                    <i class="fab fa-facebook mr-2"></i>Facebook Event
                </a>
            `;
        }
        
        links += '</div></div>';
        return links;
    });

    Handlebars.registerHelper('generateOtherInstances', function(eventData) {
        if (!eventData.otherInstances || eventData.otherInstances.length === 0) return '';
        
        let instances = '<div class="mb-6"><h2 class="text-2xl font-bold text-white mb-4"><i class="fas fa-calendar-alt mr-3 text-accent-color"></i>Other Instances</h2><div class="space-y-3">';
        
        eventData.otherInstances.forEach(instance => {
            instances += `
                <div class="bg-gray-800/50 p-4 rounded-lg">
                    <div class="flex justify-between items-center">
                        <span class="text-white">${Handlebars.helpers.formatShortDate(instance.date)}</span>
                        <a href="/event/${instance.slug}" class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                            <i class="fas fa-eye mr-1"></i>View
                        </a>
                    </div>
                </div>
            `;
        });
        
        instances += '</div></div>';
        return instances;
    });
}

function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

// Fetch all approved events from Firestore
async function getAllEvents() {
    try {
        if (!firebaseInitialized) {
            console.log('⚠️  Firebase not initialized. Cannot fetch events.');
            return [];
        }
        
        console.log('📅 Fetching all approved events from Firestore...');
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .get();
        
        console.log(`📅 Found ${snapshot.size} approved events`);
        
        const events = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const processedEvent = processEventForPublic(data, doc.id);
            if (processedEvent && processedEvent.slug) {
                events.push(processedEvent);
            }
        });
        
        console.log(`📅 Processed ${events.length} events with valid slugs`);
        return events;
        
    } catch (error) {
        console.error('❌ Error fetching events:', error);
        throw error;
    }
}

// Process event data for public display
function processEventForPublic(eventData, eventId) {
    // Extract image URL from various possible formats
    let imageUrl = null;
    
    // 1. First try Cloudinary public ID
    const cloudinaryId = eventData.cloudinaryPublicId;
    if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${cloudinaryId}`;
    } else {
        // 2. Try to find any image field that might contain a Cloudinary URL
        const possibleImageFields = ['image', 'Image', 'Promo Image', 'promoImage'];
        for (const field of possibleImageFields) {
            const imageData = eventData[field];
            if (imageData) {
                // Check if it's already a Cloudinary URL
                if (typeof imageData === 'string' && imageData.includes('cloudinary.com')) {
                    imageUrl = imageData;
                    break;
                }
                // Check if it's an object with a Cloudinary URL
                if (imageData && typeof imageData === 'object' && imageData.url && imageData.url.includes('cloudinary.com')) {
                    imageUrl = imageData.url;
                    break;
                }
            }
        }
        
        // 3. If still no image, generate a consistent placeholder based on event name
        if (!imageUrl) {
            const eventName = eventData.name || 'Event';
            const encodedName = encodeURIComponent(eventName);
            imageUrl = `https://placehold.co/1200x675/1e1e1e/EAEAEA?text=${encodedName}`;
        }
    }
    
    // Process venue data
    let venueData = null;
    if (eventData.venueId) {
        venueData = {
            id: eventData.venueId,
            name: eventData.venueName || 'Venue TBC',
            slug: eventData.venueSlug || ''
        };
    } else if (eventData.venue) {
        venueData = {
            id: eventData.venue.id || '',
            name: eventData.venue.name || 'Venue TBC',
            slug: eventData.venue.slug || ''
        };
    }
    
    const event = {
        id: eventId,
        name: eventData.name || eventData['Event Name'] || 'Unnamed Event',
        slug: eventData.slug || eventData['Event Slug'] || '',
        description: eventData.description || eventData['Description'] || '',
        date: eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : null,
        venue: venueData,
        image: imageUrl ? { url: imageUrl } : null,
        category: eventData.category || eventData['Category'] || [],
        price: eventData.price || eventData['Price'] || null,
        ageRestriction: eventData.ageRestriction || eventData['Age Restriction'] || null,
        organizer: eventData.organizer || eventData['Organizer'] || null,
        accessibility: eventData.accessibility || eventData['Accessibility'] || null,
        ticketLink: eventData.ticketLink || eventData['Ticket Link'] || null,
        eventLink: eventData.eventLink || eventData['Event Link'] || null,
        facebookEvent: eventData.facebookEvent || eventData['Facebook Event'] || null,
        recurringInfo: eventData.recurringInfo || null,
        boostedListingStartDate: eventData.boostedListingStartDate || null,
        boostedListingEndDate: eventData.boostedListingEndDate || null,
        otherInstances: [] // Will be populated for recurring events
    };
    
    if (!event.category || event.category.length === 0) {
        event.category = ['Event'];
    }
    
    return event;
}

// Generate a single event page
async function generateEventPage(event, template) {
    try {
        const eventDir = path.join(__dirname, 'event');
        await fs.mkdir(eventDir, { recursive: true });
        
        const filePath = path.join(eventDir, `${event.slug}.html`);
        
        // Generate calendar links
        const calendarLinks = Handlebars.helpers.generateCalendarLinks(event);
        
        // Prepare template data
        const templateData = {
            event: {
                ...event,
                googleCalendarUrl: calendarLinks.google,
                icalUrl: calendarLinks.ical
            }
        };
        
        // Render the template
        const html = template(templateData);
        
        // Write the file
        await fs.writeFile(filePath, html, 'utf8');
        console.log(`✅ Generated event page: ${event.slug}.html`);
        
        return filePath;
        
    } catch (error) {
        console.error(`❌ Error generating event page for ${event.slug}:`, error.message);
        throw error;
    }
}

// Generate all event pages
async function generateAllEventPages() {
    try {
        if (!firebaseInitialized) {
            console.log('⚠️  Firebase not initialized. Skipping event page generation.');
            return;
        }
        
        console.log('🚀 Starting event page generation...');
        
        // Load template and register helpers
        const template = await loadEventTemplate();
        registerHelpers();
        
        // Fetch all events
        const events = await getAllEvents();
        
        if (events.length === 0) {
            console.log('⚠️  No events found. No pages will be generated.');
            return;
        }
        
        console.log(`📝 Generating ${events.length} event pages...`);
        
        // Generate pages for each event
        const generatedPages = [];
        for (const event of events) {
            try {
                const filePath = await generateEventPage(event, template);
                generatedPages.push(filePath);
            } catch (error) {
                console.error(`❌ Failed to generate page for event ${event.slug}:`, error.message);
            }
        }
        
        console.log(`✅ Successfully generated ${generatedPages.length} event pages`);
        
        // Create a fallback mechanism
        await createFallbackMechanism();
        
        return generatedPages;
        
    } catch (error) {
        console.error('❌ Error in event page generation:', error);
        throw error;
    }
}

// Create fallback mechanism for dynamic event pages
async function createFallbackMechanism() {
    try {
        const fallbackContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Not Found - BrumOutLoud</title>
    <meta name="description" content="Event not found or no longer available.">
    
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
        .btn-primary {
            background: linear-gradient(135deg, #E83A99 0%, #8B5CF6 100%);
            border: 1px solid rgba(232, 58, 153, 0.3);
            transition: all 0.3s ease;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #D61F69 0%, #7C3AED 100%);
            transform: translateY(-1px);
        }
    </style>
</head>
<body>
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
        <div class="max-w-2xl mx-auto text-center">
            <div class="mb-8">
                <i class="fas fa-calendar-times text-6xl text-accent-color mb-4"></i>
                <h1 class="text-4xl font-bold text-white mb-4">Event Not Found</h1>
                <p class="text-gray-400 mb-8">This event may have been removed or the URL may be incorrect.</p>
            </div>
            
            <div class="space-y-4">
                <a href="/events" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                    <i class="fas fa-calendar-alt mr-2"></i>Browse All Events
                </a>
                <a href="/" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                    <i class="fas fa-home mr-2"></i>Go Home
                </a>
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
        
        const fallbackPath = path.join(__dirname, 'event', '404.html');
        await fs.writeFile(fallbackPath, fallbackContent, 'utf8');
        console.log('✅ Created event fallback page');
        
    } catch (error) {
        console.error('❌ Error creating fallback mechanism:', error);
    }
}

// Main execution
async function main() {
    try {
        console.log('🚀 Starting Event SSG Build Process...');
        console.log('📅 Building static event pages...');
        
        const generatedPages = await generateAllEventPages();
        
        if (generatedPages && generatedPages.length > 0) {
            console.log(`✅ Event SSG Build Complete! Generated ${generatedPages.length} event pages.`);
        } else {
            console.log('⚠️  No event pages were generated.');
        }
        
    } catch (error) {
        console.error('❌ Event SSG Build failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    generateAllEventPages,
    processEventForPublic,
    getAllEvents
}; 