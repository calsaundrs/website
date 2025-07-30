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
    console.log('=== PROCESSING EVENT ===');
    console.log('Event ID:', eventId);
    console.log('Raw event data:', JSON.stringify(eventData, null, 2));
    
    // TEMPORARY: Return hardcoded data to test if the issue is with data processing
    const event = {
        id: eventId,
        name: 'HARDCODED TEST EVENT NAME',
        slug: eventData.slug || 'test-slug',
        description: 'HARDCODED TEST EVENT DESCRIPTION - This is a test to see if the template replacement works with hardcoded data.',
        date: eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : new Date().toISOString(),
        venue: {
            id: 'test-venue-id',
            name: 'HARDCODED TEST VENUE',
            slug: 'test-venue-slug'
        },
        image: { url: 'https://test-image.jpg' },
        category: ['Test Category'],
        price: null,
        ageRestriction: null,
        organizer: null,
        accessibility: null,
        ticketLink: null,
        eventLink: null,
        facebookEvent: null,
        recurringInfo: null,
        boostedListingStartDate: null,
        boostedListingEndDate: null,
        otherInstances: []
    };
    
    console.log('Returning hardcoded event data:', JSON.stringify(event, null, 2));
    console.log('=== END PROCESSING EVENT ===');
    
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
        // Try multiple possible paths for the template
        const possiblePaths = [
            path.join(__dirname, 'templates', 'event-details-template.html'),
            path.join(process.cwd(), 'netlify', 'functions', 'templates', 'event-details-template.html'),
            path.join(process.cwd(), 'templates', 'event-details-template.html'),
            './templates/event-details-template.html',
            '../templates/event-details-template.html'
        ];
        
        console.log('Attempting to load template from multiple paths...');
        console.log('Current directory:', process.cwd());
        console.log('__dirname:', __dirname);
        
        let template = null;
        let successfulPath = null;
        
        for (const templatePath of possiblePaths) {
            try {
                console.log('Trying path:', templatePath);
                template = fs.readFileSync(templatePath, 'utf8');
                successfulPath = templatePath;
                console.log('Successfully loaded template from:', templatePath);
                break;
            } catch (pathError) {
                console.log('Failed to load from:', templatePath, '-', pathError.message);
            }
        }
        
        if (!template) {
            console.error('Failed to load template from any path');
            return null;
        }
        
        console.log('Template loaded successfully, length:', template.length);
        console.log('Template starts with:', template.substring(0, 200));
        console.log('Template contains event.name placeholder:', template.includes('{{event.name}}'));
        console.log('Template contains event.description placeholder:', template.includes('{{event.description}}'));
        
        return template;
    } catch (error) {
        console.error('Failed to load event template:', error.message);
        console.error('Error stack:', error.stack);
        return null;
    }
}

function generateEventPage(event) {
    console.log('=== GENERATING PAGE FOR EVENT ===');
    console.log('Event ID:', event.id);
    console.log('Event Name:', event.name);
    console.log('Event Description:', event.description);
    console.log('Event Date:', event.date);
    console.log('Event Slug:', event.slug);
    console.log('Event Venue:', event.venue);
    console.log('Event Category:', event.category);
    console.log('Event Image:', event.image);
    console.log('Full Event Object:', JSON.stringify(event, null, 2));
    
    const template = loadEventTemplate();
    if (!template) {
        console.error('Failed to load event template, using fallback');
        return generateFallbackEventPage(event);
    }
    
    console.log('Template loaded successfully');
    
    // Test with hardcoded data to see if template replacement works
    const testEvent = {
        name: 'TEST EVENT NAME',
        description: 'TEST EVENT DESCRIPTION',
        date: '2025-08-01T19:30:00.000Z',
        slug: 'test-event-slug',
        venue: { name: 'Test Venue', slug: 'test-venue' },
        image: { url: 'https://test-image.jpg' },
        category: ['Test Category']
    };
    
    console.log('Testing with hardcoded event data:', JSON.stringify(testEvent, null, 2));
    
    // Replace template placeholders with test event data first
    let testHtmlContent = template
        .replace(/\{\{event\.name\}\}/g, testEvent.name || 'Unnamed Event')
        .replace(/\{\{event\.description\}\}/g, testEvent.description || 'No description available')
        .replace(/\{\{event\.date\}\}/g, formatDate(testEvent.date))
        .replace(/\{\{event\.time\}\}/g, testEvent.time || 'Time TBC')
        .replace(/\{\{event\.venue\.name\}\}/g, testEvent.venue?.name || 'Venue TBC')
        .replace(/\{\{event\.venue\.slug\}\}/g, testEvent.venue?.slug || '')
        .replace(/\{\{event\.imageUrl\}\}/g, testEvent.image?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop&crop=center&auto=format&q=80')
        .replace(/\{\{event\.slug\}\}/g, testEvent.slug || '')
        .replace(/\{\{categoryTags\}\}/g, generateCategoryTags(testEvent.category))
        .replace(/\{\{recurringTag\}\}/g, generateRecurringTag(testEvent))
        .replace(/\{\{boostedTag\}\}/g, generateBoostedTag(testEvent))
        .replace(/\{\{eventDetails\}\}/g, generateEventDetails(testEvent))
        .replace(/\{\{calendarLinks\}\}/g, generateCalendarLinks(testEvent))
        .replace(/\{\{actionButtons\}\}/g, generateActionButtons(testEvent))
        .replace(/\{\{otherInstances\}\}/g, generateOtherInstances(testEvent));
    
    console.log('Test template replacements completed');
    console.log('Test title in HTML:', testHtmlContent.match(/<title>(.*?)<\/title>/)?.[1]);
    console.log('Test description in HTML:', testHtmlContent.match(/<meta name="description" content="(.*?)">/)?.[1]);
    
    // Now replace with actual event data
    let htmlContent = template
        .replace(/\{\{event\.name\}\}/g, event.name || 'Unnamed Event')
        .replace(/\{\{event\.description\}\}/g, event.description || 'No description available')
        .replace(/\{\{event\.date\}\}/g, formatDate(event.date))
        .replace(/\{\{event\.time\}\}/g, event.time || 'Time TBC')
        .replace(/\{\{event\.venue\.name\}\}/g, event.venue?.name || 'Venue TBC')
        .replace(/\{\{event\.venue\.slug\}\}/g, event.venue?.slug || '')
        .replace(/\{\{event\.imageUrl\}\}/g, event.image?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop&crop=center&auto=format&q=80')
        .replace(/\{\{event\.slug\}\}/g, event.slug || '')
        .replace(/\{\{categoryTags\}\}/g, generateCategoryTags(event.category))
        .replace(/\{\{recurringTag\}\}/g, generateRecurringTag(event))
        .replace(/\{\{boostedTag\}\}/g, generateBoostedTag(event))
        .replace(/\{\{eventDetails\}\}/g, generateEventDetails(event))
        .replace(/\{\{calendarLinks\}\}/g, generateCalendarLinks(event))
        .replace(/\{\{actionButtons\}\}/g, generateActionButtons(event))
        .replace(/\{\{otherInstances\}\}/g, generateOtherInstances(event));
    
    console.log('Template replacements completed for:', event.name);
    console.log('Final title in HTML:', htmlContent.match(/<title>(.*?)<\/title>/)?.[1]);
    console.log('Final description in HTML:', htmlContent.match(/<meta name="description" content="(.*?)">/)?.[1]);
    console.log('=== END GENERATING PAGE ===');
    
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