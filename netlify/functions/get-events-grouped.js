const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Getting events with recurring grouping');
    
    try {
        // Initialize Firebase
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
        }
        const db = admin.firestore();
        
        // Get query parameters
        const queryParams = new URLSearchParams(event.queryStringParameters || '');
        const venueSlug = queryParams.get('venueSlug');
        const limit = parseInt(queryParams.get('limit')) || 50;
        
        console.log(`Getting events with grouping for venue: ${venueSlug || 'all'}`);
        
        // Build query
        let query = db.collection('events')
            .where('status', '==', 'approved')
            .orderBy('date', 'asc');
        
        // If venueSlug is provided, filter by it
        if (venueSlug) {
            query = query.where('venueSlug', '==', venueSlug);
        }
        
        const snapshot = await query.get();
        let events = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Only include future events or events from today
            const eventDate = new Date(data.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (eventDate >= today) {
                events.push({
                    id: doc.id,
                    name: data.name || 'Untitled Event',
                    description: data.description || '',
                    date: data.date,
                    status: data.status || 'approved',
                    venueId: data.venueId || null,
                    venueName: data.venueName || '',
                    venueAddress: data.venueAddress || '',
                    venueSlug: data.venueSlug || '',
                    category: data.category || [],
                    link: data.link || '',
                    recurringInfo: data.recurringInfo || '',
                    image: extractImageUrl(data),
                    slug: data.slug || '',
                    promotion: data.promotion || null
                });
            }
        });
        
        // Group recurring events
        const groupedEvents = groupRecurringEvents(events);
        
        // Sort by date
        groupedEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Apply limit
        const limitedEvents = groupedEvents.slice(0, limit);
        
        console.log(`Returning ${limitedEvents.length} grouped events (from ${events.length} original events)`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                events: limitedEvents,
                total: limitedEvents.length,
                originalCount: events.length,
                groupedCount: groupedEvents.length,
                venueSlug: venueSlug,
                limit: limit
            })
        };
        
    } catch (error) {
        console.error('Error getting grouped events:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to fetch events',
                message: error.message
            })
        };
    }
};

function groupRecurringEvents(events) {
    const groupedEvents = [];
    const recurringGroups = new Map();
    
    events.forEach(event => {
        if (event.recurringInfo) {
            // Create a key for grouping recurring events
            const groupKey = createRecurringGroupKey(event);
            
            if (recurringGroups.has(groupKey)) {
                // Add to existing group
                const group = recurringGroups.get(groupKey);
                group.instances.push(event);
                // Update the group's date to the earliest instance
                if (new Date(event.date) < new Date(group.date)) {
                    group.date = event.date;
                }
            } else {
                // Create new group
                const group = {
                    ...event,
                    instances: [event],
                    isRecurringGroup: true,
                    recurringPattern: extractRecurringPattern(event.recurringInfo)
                };
                recurringGroups.set(groupKey, group);
            }
        } else {
            // Non-recurring event, add directly
            groupedEvents.push(event);
        }
    });
    
    // Add grouped recurring events
    recurringGroups.forEach(group => {
        groupedEvents.push(group);
    });
    
    return groupedEvents;
}

function createRecurringGroupKey(event) {
    // Create a unique key based on event name, venue, and recurring pattern
    const pattern = extractRecurringPattern(event.recurringInfo);
    return `${event.name}-${event.venueName}-${pattern}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function extractRecurringPattern(recurringInfo) {
    const text = recurringInfo.toLowerCase();
    if (text.includes('weekly') || text.includes('every week')) {
        return 'weekly';
    } else if (text.includes('monthly') || text.includes('every month')) {
        return 'monthly';
    } else if (text.includes('daily') || text.includes('every day')) {
        return 'daily';
    } else if (text.includes('bi-weekly') || text.includes('every two weeks')) {
        return 'bi-weekly';
    } else {
        return 'recurring';
    }
}

function extractImageUrl(data) {
    // Extract Cloudinary image object from various possible formats
    // Check for object formats with URL properties
    if (data.promoImage && data.promoImage.url) {
        return data.promoImage;
    }
    if (data.image && data.image.url) {
        return data.image;
    }
    if (data['Promo Image'] && data['Promo Image'].url) {
        return data['Promo Image'];
    }
    if (data['Image'] && data['Image'].url) {
        return data['Image'];
    }
    if (data.thumbnail && data.thumbnail.url) {
        return data.thumbnail;
    }
    if (data['Thumbnail'] && data['Thumbnail'].url) {
        return data['Thumbnail'];
    }
    if (data.venueImage && data.venueImage.url) {
        return data.venueImage;
    }
    if (data['Venue Image'] && data['Venue Image'].url) {
        return data['Venue Image'];
    }
    if (data.promo_image && data.promo_image.url) {
        return data.promo_image;
    }
    if (data.venue_image && data.venue_image.url) {
        return data.venue_image;
    }
    
    // Check for string formats
    if (typeof data.promoImage === 'string' && data.promoImage.includes('cloudinary')) {
        return { url: data.promoImage };
    }
    if (typeof data.image === 'string' && data.image.includes('cloudinary')) {
        return { url: data.image };
    }
    if (typeof data.thumbnail === 'string' && data.thumbnail.includes('cloudinary')) {
        return { url: data.thumbnail };
    }
    if (typeof data.venueImage === 'string' && data.venueImage.includes('cloudinary')) {
        return { url: data.venueImage };
    }
    if (typeof data.promo_image === 'string' && data.promo_image.includes('cloudinary')) {
        return { url: data.promo_image };
    }
    if (typeof data.venue_image === 'string' && data.venue_image.includes('cloudinary')) {
        return { url: data.venue_image };
    }
    
    // Check for any field that contains 'cloudinary' in the URL
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.includes('cloudinary')) {
            return { url: value };
        }
        if (typeof value === 'object' && value && value.url && value.url.includes('cloudinary')) {
            return value;
        }
    }
    
    return null;
}