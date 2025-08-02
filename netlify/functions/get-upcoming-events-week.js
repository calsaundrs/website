const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

exports.handler = async function (event, context) {
    console.log('🎬 Getting upcoming events for current week for reels generator');
    
    try {
        // Calculate date range for current week (next 7 days)
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(now);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        endOfWeek.setHours(23, 59, 59, 999);

        console.log(`📅 Fetching events from ${startOfWeek.toISOString()} to ${endOfWeek.toISOString()}`);

        // Query Firestore for approved events in the next week
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .where('date', '>=', startOfWeek)
            .where('date', '<=', endOfWeek)
            .orderBy('date', 'asc')
            .limit(20) // Limit to prevent too many events
            .get();

        console.log(`📊 Found ${snapshot.size} events for the week`);

        const events = [];
        snapshot.forEach(doc => {
            const eventData = doc.data();
            
            // Extract and optimize event data for reels generation
            const processedEvent = {
                id: doc.id,
                name: eventData.name || 'Untitled Event',
                description: eventData.description || '',
                date: eventData.date.toDate(),
                dayOfWeek: eventData.date.toDate().toLocaleDateString('en-GB', { weekday: 'long' }),
                time: eventData.date.toDate().toLocaleTimeString('en-GB', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                }),
                venue: {
                    id: eventData.venueId || null,
                    name: eventData.venueName || 'TBA',
                    address: eventData.venueAddress || '',
                    slug: eventData.venueSlug || ''
                },
                category: eventData.category || [],
                image: extractImageUrl(eventData),
                slug: eventData.slug || '',
                ticketLink: eventData.ticketLink || eventData.link || '',
                priceInfo: eventData.priceInfo || eventData.price || 'Free',
                ageRestriction: eventData.ageRestriction || '18+',
                // Add formatted data for video templates
                shortDescription: truncateText(eventData.description || '', 100),
                hashtags: generateHashtags(eventData.category || [], eventData.venueName || ''),
                formattedDate: formatDateForVideo(eventData.date.toDate())
            };

            events.push(processedEvent);
        });

        console.log(`✅ Processed ${events.length} events for reels generation`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                events: events,
                dateRange: {
                    start: startOfWeek.toISOString(),
                    end: endOfWeek.toISOString()
                },
                totalEvents: events.length,
                generatedAt: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('❌ Error fetching events for reels:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to fetch events for reels generation',
                message: error.message
            })
        };
    }
};

// Helper function to extract image URL from event data
function extractImageUrl(eventData) {
    // Priority order for image sources
    if (eventData.cloudinaryPublicId) {
        return `https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_1080,h_1080,c_fill,g_center/${eventData.cloudinaryPublicId}`;
    }
    
    if (eventData.image && eventData.image.url) {
        return eventData.image.url;
    }
    
    if (eventData.promoImage) {
        return eventData.promoImage;
    }
    
    // Fallback to a placeholder that works well for videos
    return `https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_1080,h_1080,c_fill,g_center,b_rgb:E83A99/v1/placeholder_event.jpg`;
}

// Helper function to truncate text for video use
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Helper function to generate hashtags
function generateHashtags(categories, venueName) {
    const hashtags = ['#BrumOutLoud', '#LGBTQ', '#Birmingham'];
    
    // Add category-based hashtags
    categories.forEach(category => {
        hashtags.push(`#${category.replace(/[^a-zA-Z0-9]/g, '')}`);
    });
    
    // Add venue hashtag if available
    if (venueName && venueName !== 'TBA') {
        const venueHashtag = venueName.replace(/[^a-zA-Z0-9]/g, '');
        if (venueHashtag.length > 0) {
            hashtags.push(`#${venueHashtag}`);
        }
    }
    
    return hashtags.slice(0, 8); // Limit to 8 hashtags
}

// Helper function to format date for video display
function formatDateForVideo(date) {
    const options = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    
    return date.toLocaleDateString('en-GB', options);
} 