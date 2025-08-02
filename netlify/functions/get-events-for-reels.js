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
    console.log('🎬 Getting upcoming events for reels generator with flexible date range');
    
    try {
        // Get query parameters for date range
        const queryParams = event.queryStringParameters || {};
        const preset = queryParams.preset || 'this-week';
        const customStart = queryParams.startDate;
        const customEnd = queryParams.endDate;
        
        let startDate, endDate;
        
        // Handle date range presets or custom dates
        if (customStart && customEnd) {
            console.log('📅 Using custom date range');
            startDate = new Date(customStart);
            endDate = new Date(customEnd);
            endDate.setHours(23, 59, 59, 999);
        } else {
            console.log(`📅 Using preset: ${preset}`);
            const dateRange = getDateRangeFromPreset(preset);
            startDate = dateRange.start;
            endDate = dateRange.end;
        }

        console.log(`📅 Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // Query Firestore for approved events in the specified date range
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('status', '==', 'approved')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'asc')
            .limit(50) // Increased limit for longer date ranges
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
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                    preset: preset,
                    isCustomRange: !!(customStart && customEnd)
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

// Helper function to get date range from preset
function getDateRangeFromPreset(preset) {
    const now = new Date();
    let start, end;
    
    switch (preset) {
        case 'today':
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            end = new Date(now);
            end.setHours(23, 59, 59, 999);
            break;
            
        case 'tomorrow':
            start = new Date(now);
            start.setDate(start.getDate() + 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setHours(23, 59, 59, 999);
            break;
            
        case 'this-week':
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            end = new Date(now);
            end.setDate(end.getDate() + 7);
            end.setHours(23, 59, 59, 999);
            break;
            
        case 'next-week':
            start = new Date(now);
            start.setDate(start.getDate() + 7);
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(end.getDate() + 7);
            end.setHours(23, 59, 59, 999);
            break;
            
        case 'this-month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            break;
            
        case 'next-month':
            start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            end.setHours(23, 59, 59, 999);
            break;
            
        case 'next-30-days':
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            end = new Date(now);
            end.setDate(end.getDate() + 30);
            end.setHours(23, 59, 59, 999);
            break;
            
        case 'next-60-days':
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            end = new Date(now);
            end.setDate(end.getDate() + 60);
            end.setHours(23, 59, 59, 999);
            break;
            
        default:
            // Default to this week
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            end = new Date(now);
            end.setDate(end.getDate() + 7);
            end.setHours(23, 59, 59, 999);
    }
    
    return { start, end };
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