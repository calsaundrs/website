const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

// Initialize Firebase Admin with error handling
let firebaseInitialized = false;
if (!admin.apps.length) {
    try {
        const requiredVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL', 
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.warn(`⚠️  Missing Firebase environment variables: ${missingVars.join(', ')}`);
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
    }
} else {
    firebaseInitialized = true;
}

let db;
if (firebaseInitialized) {
    db = admin.firestore();
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
        
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const approvedSnapshot = await eventsRef
            .where('status', '==', 'approved')
            .where('startDate', '>=', today)
            .get();

        const ApprovedSnapshot = await eventsRef
            .where('Status', '==', 'Approved')
            .where('startDate', '>=', today)
            .get();

        console.log(`- Found ${approvedSnapshot.size} events with status: 'approved'`);
        console.log(`- Found ${ApprovedSnapshot.size} events with Status: 'Approved'`);

        const allApprovedEvents = [];
        approvedSnapshot.forEach(doc => allApprovedEvents.push({ id: doc.id, ...doc.data() }));
        ApprovedSnapshot.forEach(doc => {
            if (!allApprovedEvents.some(event => event.id === doc.id)) {
                allApprovedEvents.push({ id: doc.id, ...doc.data() });
            }
        });

        console.log(`📅 Found ${allApprovedEvents.length} total approved events`);
        
        const events = [];
        allApprovedEvents.forEach(eventData => {
            const processedEvent = processEventForPublic(eventData, eventData.id);
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