const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Getting events by venue ID');
    
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
        const venueId = queryParams.get('venueId');
        const venueSlug = queryParams.get('venueSlug');
        const limit = parseInt(queryParams.get('limit')) || 50;
        
        if (!venueId && !venueSlug) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Missing venueId or venueSlug parameter'
                })
            };
        }
        
        console.log(`Getting events for venue: ${venueId || venueSlug}`);
        
        // Build query
        let query = db.collection('events')
            .where('status', '==', 'approved')
            .orderBy('date', 'asc');
        
        // If venueId is provided, use it for exact matching
        if (venueId) {
            query = query.where('venueId', '==', venueId);
        }
        
        const snapshot = await query.get();
        let events = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // If we're using venueSlug, filter by it
            if (venueSlug && !venueId) {
                if (data.venueSlug !== venueSlug) {
                    return; // Skip this event
                }
            }
            
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
                    slug: data.slug || ''
                });
            }
        });
        
        // Sort by date
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Apply limit
        events = events.slice(0, limit);
        
        console.log(`Returning ${events.length} events for venue`);
        
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
                events: events,
                total: events.length,
                venueId: venueId,
                venueSlug: venueSlug,
                limit: limit
            })
        };
        
    } catch (error) {
        console.error('Error getting events by venue:', error);
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