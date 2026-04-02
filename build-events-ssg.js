const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');
const FormattingService = require('./netlify/functions/services/formatting-service');

// Add fetch for Node.js (if not available)
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

// Fetch all approved events from API
async function getAllEvents() {
    try {
        console.log('📅 Fetching all approved events from API...');
        
        const response = await fetch('https://brumoutloud.co.uk/.netlify/functions/get-events');
        if (!response.ok) {
            throw new Error(`API responded with ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log(`📅 API Response type: ${typeof responseData}`);
        console.log(`📅 API Response:`, JSON.stringify(responseData).substring(0, 200) + '...');
        
        // Handle both array and object response formats
        let allEvents;
        if (Array.isArray(responseData)) {
            allEvents = responseData;
        } else if (responseData && Array.isArray(responseData.events)) {
            allEvents = responseData.events;
        } else {
            console.warn('⚠️ API did not return an array or events array, using empty array');
            return [];
        }
        
        console.log(`📅 Found ${allEvents.length} total events from API`);
        
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        const events = [];
        allEvents.forEach(eventData => {
            // Only include events that are today or in the future
            try {
                const eventDateObj = new Date(eventData.date);
                today.setHours(0,0,0,0);
                if (!isNaN(eventDateObj) && eventDateObj >= today) {
                    const processedEvent = processEventForPublic(eventData, eventData.id);
                    if (processedEvent && processedEvent.slug) {
                        events.push(processedEvent);
                    }
                }
            } catch (e) {
                console.warn('Skipping event with unparsable date', eventData.date);
            }
        });
        
        console.log(`📅 Processed ${events.length} events with valid slugs`);
        return events;
        
    } catch (error) {
        console.error('❌ Error fetching events from API:', error);
        console.log('⚠️ Using empty events array as fallback...');
        return [];
    }
}

function processEventForPublic(eventData, eventId) {
    // This function remains the same as in the Netlify function
    // but is included here for completeness of the script.
    const eventName = eventData.name || 'Unnamed Event';
    
    // Robust slug generation
    let eventSlug = eventData.slug || '';
    if (!eventSlug && eventName) {
        eventSlug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    const eventDescription = eventData.description || '';
    const eventDate = eventData.date ? (typeof eventData.date.toDate === 'function' ? eventData.date.toDate().toISOString() : new Date(eventData.date).toISOString()) : null;

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
    
    // Correctly process venue data from raw fields
    const venueData = { id: '', name: 'Venue TBC', slug: '' };
    if (eventData.venueName && Array.isArray(eventData.venueName) && eventData.venueName.length > 0) {
        venueData.name = eventData.venueName[0];
    } else if (typeof eventData.venueName === 'string') {
        venueData.name = eventData.venueName;
    }

    if (eventData.venueSlug) {
        venueData.slug = eventData.venueSlug;
    } else if (venueData.name !== 'Venue TBC') {
        venueData.slug = venueData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    const event = {
        id: eventId,
        name: eventName,
        slug: eventSlug,
        description: eventDescription,
        date: eventDate,
        venue: venueData,
        image: imageUrl ? { url: imageUrl } : null,
        category: eventData.category || ['Event'],
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
        otherInstances: [] 
    };

    return event;
}

async function generateEventPage(event, template) {
    try {
        const eventDir = path.join('event');
        await fs.mkdir(eventDir, { recursive: true });
        
        const filePath = path.join(eventDir, `${event.slug}.html`);
        
        const templateData = { event };
        const html = template(templateData);
        
        await fs.writeFile(filePath, html, 'utf8');
        console.log(`✅ Generated event page: ${event.slug}.html`);
        
        return filePath;
        
    } catch (error) {
        console.error(`❌ Error generating event page for ${event.slug}:`, error.message);
        throw error;
    }
}


async function main() {
    try {
        console.log('🚀 Starting Event SSG Build Process...');
        const templatePath = path.join(__dirname, 'event-template.html');
        const templateContent = await fs.readFile(templatePath, 'utf8');

        // Register formatting helper
        Handlebars.registerHelper('formatDescription', function(description) {
            return FormattingService.formatDescription(description);
        });

        const template = Handlebars.compile(templateContent);

        const events = await getAllEvents();
        
        if (events.length === 0) {
            console.log('⚠️  No events found. No pages will be generated.');
            return;
        }
        
        console.log(`📝 Generating ${events.length} event pages...`);
        
        for (const event of events) {
            await generateEventPage(event, template);
        }
        
        console.log(`✅ Successfully generated ${events.length} event pages`);
        
    } catch (error) {
        console.error('❌ Event SSG Build failed:', error);
        process.exit(1);
    }
}

main(); 