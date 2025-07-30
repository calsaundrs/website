const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let firebaseInitialized = false;
let db = null;

try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        try {
            admin.app();
            firebaseInitialized = true;
        } catch (error) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
            firebaseInitialized = true;
        }
        
        if (firebaseInitialized) {
            db = admin.firestore();
        }
    }
} catch (error) {
    console.log('Firebase init failed:', error.message);
}

function formatDate(dateString) {
    if (!dateString) return 'Date TBC';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date TBC';
    
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    return date.toLocaleDateString('en-GB', options);
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

function processEventForPublic(eventData, eventId) {
    // Use standardized field names - no more legacy mapping
    const eventName = eventData.name || 'Unnamed Event';
    const eventSlug = eventData.slug || '';
    const eventDescription = eventData.description || '';
    const eventDate = eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : null;
    
    // Extract image URL using standardized fields
    let imageUrl = null;
    if (eventData.cloudinaryPublicId) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${eventData.cloudinaryPublicId}`;
    } else if (eventData.promoImage) {
        imageUrl = typeof eventData.promoImage === 'string' ? eventData.promoImage : 
                  (eventData.promoImage.url || eventData.promoImage[0]?.url);
    } else if (eventData.image) {
        imageUrl = typeof eventData.image === 'string' ? eventData.image : 
                  (eventData.image.url || eventData.image[0]?.url);
    }
    
    // Extract venue data using standardized fields
    let venueData = {
        id: '',
        name: 'Venue TBC',
        slug: ''
    };
    
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
        name: eventName,
        slug: eventSlug,
        description: eventDescription,
        date: eventDate,
        venue: venueData,
        image: imageUrl ? { url: imageUrl } : null,
        category: eventData.category || [],
        price: eventData.price || null,
        ageRestriction: eventData.ageRestriction || null,
        organizer: eventData.organizer || null,
        accessibility: eventData.accessibility || null,
        ticketLink: eventData.ticketLink || null,
        eventLink: eventData.eventLink || null,
        facebookEvent: eventData.facebookEvent || null,
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

async function getAllEvents() {
    if (!firebaseInitialized) {
        return [];
    }
    
    try {
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .get();
        
        console.log('Found ' + snapshot.size + ' approved events');
        
        const events = [];
        snapshot.forEach(function(doc) {
            const data = doc.data();
            const processedEvent = processEventForPublic(data, doc.id);
            if (processedEvent && processedEvent.slug) {
                events.push(processedEvent);
            }
        });
        
        console.log('Processed ' + events.length + ' events with valid slugs');
        return events;
        
    } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
    }
}

// Load the event template
function loadEventTemplate() {
    try {
        const templatePath = path.join(__dirname, 'templates', 'event-details-template.html');
        return fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
        console.error('Failed to load event template:', error.message);
        return null;
    }
}

function generateEventPage(event) {
    const template = loadEventTemplate();
    if (!template) {
        console.error('Failed to load event template, using fallback');
        return generateFallbackEventPage(event);
    }
    
    // Replace template placeholders with event data
    let htmlContent = template
        .replace(/\{\{event\.name\}\}/g, event.name || 'Unnamed Event')
        .replace(/\{\{event\.description\}\}/g, event.description || 'No description available')
        .replace(/\{\{event\.date\}\}/g, formatDate(event.date))
        .replace(/\{\{event\.time\}\}/g, event.time || 'Time TBC')
        .replace(/\{\{event\.venue\.name\}\}/g, event.venue?.name || 'Venue TBC')
        .replace(/\{\{event\.venue\.slug\}\}/g, event.venue?.slug || '')
        .replace(/\{\{event\.imageUrl\}\}/g, event.imageUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop&crop=center&auto=format&q=80')
        .replace(/\{\{event\.slug\}\}/g, event.slug || '')
        .replace(/\{\{categoryTags\}\}/g, generateCategoryTags(event.categories))
        .replace(/\{\{recurringTag\}\}/g, generateRecurringTag(event))
        .replace(/\{\{boostedTag\}\}/g, generateBoostedTag(event))
        .replace(/\{\{eventDetails\}\}/g, generateEventDetails(event))
        .replace(/\{\{calendarLinks\}\}/g, generateCalendarLinks(event))
        .replace(/\{\{actionButtons\}\}/g, generateActionButtons(event))
        .replace(/\{\{otherInstances\}\}/g, generateOtherInstances(event));
    
    return htmlContent;
}

function generateFallbackEventPage(event) {
    return '<!DOCTYPE html>' +
        '<html lang="en">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + event.name + ' - Brum Out Loud</title>' +
        '<meta name="description" content="' + (event.description || 'Event details') + '">' +
        '<link href="https://cdn.tailwindcss.com" rel="stylesheet">' +
        '<meta property="og:title" content="' + event.name + '">' +
        '<meta property="og:description" content="' + (event.description || 'Event details') + '">' +
        '<meta property="og:image" content="' + event.imageUrl + '">' +
        '<meta property="og:url" content="https://www.brumoutloud.co.uk/event/' + event.slug + '">' +
        '<meta name="twitter:card" content="summary_large_image">' +
        '</head>' +
        '<body class="bg-gray-100">' +
        '<div class="container mx-auto px-4 py-8">' +
        '<h1 class="text-3xl font-bold text-gray-800 mb-4">' + event.name + '</h1>' +
        '<p class="text-gray-600 mb-4">' + (event.description || 'No description available') + '</p>' +
        '<p class="text-gray-700 mb-4">Date: ' + formatDate(event.date) + '</p>' +
        '<a href="/events.html" class="text-blue-600 hover:text-blue-800">← Back to Events</a>' +
        '</div>' +
        '</body>' +
        '</html>';
}

function generateCategoryTags(categories) {
    if (!categories || categories.length === 0) return '';
    
    return categories.map(category => 
        '<span class="category-tag">' + category + '</span>'
    ).join('');
}

function generateRecurringTag(event) {
    if (!event.recurringInfo) return '';
    return '<span class="recurring-event-tag">RECURRING</span>';
}

function generateBoostedTag(event) {
    if (!event.boostedListingStartDate || !event.boostedListingEndDate) return '';
    return '<span class="boosted-listing-tag">BOOSTED</span>';
}

function generateEventDetails(event) {
    let details = '';
    
    if (event.date) {
        details += '<div class="mb-4"><strong>Date:</strong> ' + formatDate(event.date) + '</div>';
    }
    if (event.time) {
        details += '<div class="mb-4"><strong>Time:</strong> ' + event.time + '</div>';
    }
    if (event.venue?.name) {
        details += '<div class="mb-4"><strong>Venue:</strong> <a href="/venue/' + (event.venue.slug || '') + '">' + event.venue.name + '</a></div>';
    }
    if (event.price) {
        details += '<div class="mb-4"><strong>Price:</strong> ' + event.price + '</div>';
    }
    if (event.ageRestriction) {
        details += '<div class="mb-4"><strong>Age Restriction:</strong> ' + event.ageRestriction + '</div>';
    }
    
    return details;
}

function generateCalendarLinks(event) {
    if (!event.date) return '';
    
    const eventDate = new Date(event.date);
    const endDate = new Date(eventDate.getTime() + (3 * 60 * 60 * 1000)); // 3 hours later
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${eventDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.venue?.name || '')}`;
    
    const icalData = `BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ADTSTART:${eventDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z%0ADTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z%0ASUMMARY:${encodeURIComponent(event.name)}%0ADESCRIPTION:${encodeURIComponent(event.description || '')}%0ALOCATION:${encodeURIComponent(event.venue?.name || '')}%0AEND:VEVENT%0AEND:VCALENDAR`;
    
    return `
        <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" class="calendar-link google">
            <i class="fab fa-google mr-2"></i> Google Calendar
        </a>
        <a href="data:text/calendar;charset=utf8,${icalData}" download="${event.slug}.ics" class="calendar-link ical">
            <i class="fas fa-calendar-plus mr-2"></i> Apple/Outlook/Other
        </a>
    `;
}

function generateActionButtons(event) {
    let buttons = '';
    
    if (event.ticketLink) {
        buttons += `<a href="${event.ticketLink}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold text-center block mb-3">
            <i class="fas fa-ticket-alt mr-2"></i>Get Tickets
        </a>`;
    }
    
    buttons += `<a href="/events.html" class="btn-secondary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
        <i class="fas fa-arrow-left mr-2"></i>Back to Events
    </a>`;
    
    return buttons;
}

function generateOtherInstances(event) {
    if (!event.otherInstances || event.otherInstances.length === 0) return '';

    const instancesHtml = event.otherInstances.map(instance => {
        const instanceDate = new Date(instance.date);
        const endDate = new Date(instanceDate.getTime() + (3 * 60 * 60 * 1000)); // 3 hours later

        const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${instanceDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.venue?.name || '')}`;
        const icalData = `BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ADTSTART:${instanceDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z%0ADTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z%0ASUMMARY:${encodeURIComponent(event.name)}%0ADESCRIPTION:${encodeURIComponent(event.description || '')}%0ALOCATION:${encodeURIComponent(event.venue?.name || '')}%0AEND:VEVENT%0AEND:VCALENDAR`;

        return `
            <div class="other-instance">
                <p>Other instance on ${formatDate(instance.date)} at ${instance.time || 'Time TBC'}</p>
                <div class="calendar-links">
                    <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" class="calendar-link google">
                        <i class="fab fa-google mr-2"></i> Google Calendar
                    </a>
                    <a href="data:text/calendar;charset=utf8,${icalData}" download="${event.slug}-${instance.date.replace(/[-:]/g, '')}.ics" class="calendar-link ical">
                        <i class="fas fa-calendar-plus mr-2"></i> Apple/Outlook/Other
                    </a>
                </div>
            </div>
        `;
    }).join('');

    return `
        <h3 class="text-xl font-bold text-gray-800 mb-4">Other Instances</h3>
        ${instancesHtml}
    `;
}

async function generateAllEventPages() {
    const events = await getAllEvents();
    const generatedPages = [];
    
    console.log('Generating ' + events.length + ' event pages...');
    
    for (const event of events) {
        try {
            const htmlContent = generateEventPage(event);
            const fileName = event.slug + '.html';
            
            generatedPages.push({
                fileName: fileName,
                content: htmlContent,
                event: event
            });
            
            console.log('Generated: ' + fileName);
        } catch (error) {
            console.error('Failed to generate page for event ' + event.slug + ':', error.message);
        }
    }
    
    console.log('Successfully generated ' + generatedPages.length + ' event pages');
    return generatedPages;
}

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Event SSG Build: Starting function');
        
        const generatedPages = await generateAllEventPages();
        
        console.log('Event SSG Build: Build completed');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Event pages built successfully',
                output: 'Generated ' + generatedPages.length + ' event pages',
                generatedFiles: generatedPages.length,
                firebaseStatus: firebaseInitialized ? 'initialized' : 'not_initialized',
                hasEvents: generatedPages.length > 0,
                environment: process.env.NETLIFY ? 'production' : 'development',
                firebaseVars: {
                    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET',
                    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT SET',
                    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'NOT SET'
                },
                generatedPages: generatedPages.map(function(page) {
                    return {
                        fileName: page.fileName,
                        eventName: page.event.name,
                        eventSlug: page.event.slug
                    };
                })
            })
        };

    } catch (error) {
        console.error('Event SSG Build: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to start event SSG build',
                details: error.message
            })
        };
    }
}; 