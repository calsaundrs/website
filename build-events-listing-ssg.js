const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

// Initialize Firebase Admin if not already initialized
let firebaseInitialized = false;
let db;

try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
    }
    db = admin.firestore();
    firebaseInitialized = true;
    console.log('✅ Firebase initialized for events listing SSG');
} catch (error) {
    console.log('⚠️ Firebase initialization failed, will skip events listing SSG:', error.message);
    firebaseInitialized = false;
}

// Helper function to extract image URL (reused from other functions)
function extractImageUrl(data) {
    // Check for any field that contains 'cloudinary' in the URL first
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.includes('cloudinary')) {
            console.log('Found cloudinary string in field', key, ':', value);
            return { url: value };
        }
        if (typeof value === 'object' && value && value.url && value.url.includes('cloudinary')) {
            console.log('Found cloudinary object in field', key, ':', value);
            return value;
        }
    }
    
    // Try generating Cloudinary URL from airtableId as fallback (pattern: brumoutloud_events/event_[airtableId])
    if (data.airtableId && process.env.CLOUDINARY_CLOUD_NAME) {
        // High quality settings: w_1600 for retina, h_900 for 16:9 ratio, q_90 for high quality, c_fill for better cropping, fl_progressive for faster loading
        const cloudinaryUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_90,w_1600,h_900,c_fill,fl_progressive/brumoutloud_events/event_${data.airtableId}`;
        console.log('Trying high-quality airtableId-based Cloudinary URL:', cloudinaryUrl);
        return { url: cloudinaryUrl };
    }
    
    return null;
}

// Function to get all approved events with images
async function getAllApprovedEvents() {
    try {
        if (!firebaseInitialized) {
            console.log('⚠️ Firebase not initialized. Cannot fetch events.');
            return [];
        }
        
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .orderBy('date', 'asc')
            .get();
        
        const events = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        snapshot.forEach(doc => {
            const eventData = doc.data();
            
            // Filter out past events
            const eventDate = new Date(eventData.date || eventData.startDate);
            if (eventDate < today) {
                return; // Skip past events
            }
            
            // Extract image URL
            const imageData = extractImageUrl(eventData);
            
            // Only include events with images
            if (imageData && imageData.url) {
                events.push({
                    id: doc.id,
                    name: eventData.name || eventData['Event Name'] || 'Unnamed Event',
                    slug: eventData.slug || '',
                    date: eventData.date || eventData.startDate,
                    venue: eventData.venue || eventData['Venue Name'] || 'TBC',
                    venueSlug: eventData.venueSlug || '',
                    description: eventData.description || eventData['Description'] || '',
                    image: imageData,
                    category: eventData.category || eventData['Category'] || [],
                    featured: eventData.featured || false,
                    link: eventData.link || eventData['Event Link'] || ''
                });
            }
        });
        
        console.log(`Found ${events.length} approved events with images for SSG`);
        return events;
        
    } catch (error) {
        console.error('Error fetching events for SSG:', error);
        throw error;
    }
}

// Function to generate the events listing HTML
async function generateEventsListingPage() {
    try {
        console.log('🚀 Starting Events Listing SSG...');
        
        if (!firebaseInitialized) {
            console.log('⚠️ Firebase not initialized. Skipping events listing SSG.');
            return {
                success: false,
                reason: 'Firebase not initialized - missing environment variables'
            };
        }
        
        // Read the current events.html template
        const templatePath = path.join(__dirname, 'events.html');
        let templateContent = await fs.readFile(templatePath, 'utf8');
        
        // Get all events
        const events = await getAllApprovedEvents();
        
        // Generate featured events (first 3 featured events or first 3 events)
        const featuredEvents = events.filter(e => e.featured).slice(0, 3);
        if (featuredEvents.length < 3) {
            const remainingSlots = 3 - featuredEvents.length;
            const nonFeatured = events.filter(e => !e.featured).slice(0, remainingSlots);
            featuredEvents.push(...nonFeatured);
        }
        
        // Generate event cards HTML
        const eventCardsHtml = events.map(event => {
            const eventDate = new Date(event.date);
            const formattedDate = eventDate.toLocaleDateString('en-GB', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short' 
            });
            const formattedTime = eventDate.toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const categoryTags = Array.isArray(event.category) ? 
                event.category.map(cat => `<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full">${cat}</span>`).join('') :
                '';
            
            return `
                <div class="event-card rounded-xl overflow-hidden relative flex flex-col group cursor-pointer hover:scale-105 transition-transform duration-300" onclick="window.location.href='/event/${event.slug}'">
                    <div class="relative">
                        <img src="${event.image.url}" alt="${event.name}" class="w-full h-48 object-cover">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div class="absolute top-3 left-3">
                            <span class="bg-accent-color text-white text-xs px-2 py-1 rounded-full font-semibold">${formattedDate}</span>
                        </div>
                        ${event.featured ? '<div class="absolute top-3 right-3"><span class="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-semibold">FEATURED</span></div>' : ''}
                    </div>
                    <div class="p-6 flex flex-col flex-grow">
                        <h3 class="text-xl font-bold text-white mb-2 text-left group-hover:text-accent-color transition-colors">${event.name}</h3>
                        <p class="text-gray-400 text-sm mb-2 text-left">
                            <i class="fas fa-clock mr-1"></i>${formattedTime} • <i class="fas fa-map-marker-alt mr-1"></i>${event.venue}
                        </p>
                        <p class="text-gray-300 text-sm mb-4 text-left line-clamp-2">${event.description}</p>
                        <div class="flex gap-1 mb-4 overflow-hidden">
                            ${categoryTags}
                        </div>
                        <div class="flex justify-between items-center mt-auto">
                            <span class="btn-primary text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-eye mr-1"></i>View Event
                            </span>
                            <button class="btn-secondary text-white px-3 py-2 rounded-lg text-sm" onclick="event.stopPropagation(); window.location.href='/venue/${event.venueSlug}'">
                                <i class="fas fa-map-marker-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');
        
        // Generate featured slideshow HTML
        const featuredSlideshowHtml = featuredEvents.map((event, index) => {
            const eventDate = new Date(event.date);
            const formattedDate = eventDate.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
            });
            
            return `
                <div class="slide ${index === 0 ? 'active' : ''}">
                    <div class="featured-tag"><i class="fas fa-star"></i> FEATURED BANNER</div>
                    <div class="slide-overlay"></div>
                    <div class="slide-inner-content">
                        <div class="slide-text-content">
                            <p class="featured-banner-label">Featured Event</p>
                            <h3 class="slide-title">${event.name}</h3>
                            <p class="slide-venue">${event.venue}</p>
                            <p class="slide-description">${event.description}</p>
                            <a href="/event/${event.slug}" class="cta-button">View Event</a>
                        </div>
                        <div class="slide-poster-container">
                            <img class="slide-poster-image" src="${event.image.url}" alt="${event.name} Poster">
                        </div>
                    </div>
                </div>`;
        }).join('');
        
        const featuredDotsHtml = featuredEvents.map((_, index) => 
            `<span class="dot ${index === 0 ? 'active' : ''}" data-slide="${index}"></span>`
        ).join('');
        
        // Replace placeholders in template with static content
        templateContent = templateContent
            .replace('<!-- EVENTS_GRID_SSG_PLACEHOLDER -->', eventCardsHtml)
            .replace('<!-- FEATURED_SLIDESHOW_SSG_PLACEHOLDER -->', featuredSlideshowHtml)
            .replace('<!-- FEATURED_DOTS_SSG_PLACEHOLDER -->', featuredDotsHtml)
            .replace(/<!-- SSG_TIMESTAMP -->/g, new Date().toISOString());
        
        // Remove or replace JavaScript loading logic with static notice
        templateContent = templateContent.replace(
            /async function initializePage\(\) \{[\s\S]*?\}\s*initializePage\(\);/,
            '// Events loaded statically via SSG - no dynamic loading needed'
        );
        
        // Write the static file
        await fs.writeFile(templatePath, templateContent, 'utf8');
        
        console.log(`✅ Generated static events listing with ${events.length} events`);
        
        return {
            success: true,
            totalEvents: events.length,
            featuredEvents: featuredEvents.length,
            outputFile: templatePath
        };
        
    } catch (error) {
        console.error('❌ Error generating events listing SSG:', error);
        throw error;
    }
}

// Main execution
if (require.main === module) {
    generateEventsListingPage()
        .then(result => {
            if (result.success) {
                console.log('🎉 Events listing SSG completed successfully');
                console.log(`📊 Stats: ${result.totalEvents} events, ${result.featuredEvents} featured`);
            } else {
                console.log(`⚠️ Events listing SSG skipped: ${result.reason}`);
            }
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Events listing SSG failed:', error);
            process.exit(1);
        });
}

module.exports = { generateEventsListingPage }; 