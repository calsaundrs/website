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
                    image: data.promoImage || data.image || null,
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