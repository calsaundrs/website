const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Getting events by venue with recurring support');
    
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
        
        if (!venueSlug) {
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
                    error: 'venueSlug parameter is required'
                })
            };
        }
        
        console.log(`Getting events for venue: ${venueSlug}`);
        
        // Get all events and filter client-side to avoid index issues
        const snapshot = await db.collection('events').limit(100).get();
        let events = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Filter for approved events only
            if (data.status !== 'approved') {
                return; // Skip non-approved events
            }
            
            // Filter by venueSlug
            if (data.venueSlug !== venueSlug) {
                return; // Skip events not for this venue
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
                    recurringPattern: data.recurringPattern || null,
                    recurringEndDate: data.recurringEndDate || null,
                    isRecurring: data.isRecurring || false,
                    recurringGroupId: data.recurringGroupId || null,
                    recurringInstance: data.recurringInstance || null,
                    totalInstances: data.totalInstances || null,
                    image: extractImageUrl(data),
                    slug: data.slug || '',
                    promotion: data.promotion || null
                });
            }
        });
        
        // Sort events by date
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Separate recurring and one-off events
        const recurringEvents = [];
        const oneOffEvents = [];
        
        events.forEach(event => {
            if (event.isRecurring || event.recurringInfo || event.recurringPattern || event.recurringGroupId) {
                recurringEvents.push(event);
            } else {
                oneOffEvents.push(event);
            }
        });
        
        // Group recurring events
        const groupedRecurringEvents = groupRecurringEvents(recurringEvents);
        
        // Combine grouped recurring events with one-off events
        const allEvents = [...groupedRecurringEvents, ...oneOffEvents];
        
        // Sort by date again
        allEvents.sort((a, b) => {
            const dateA = a.isRecurringGroup && a.nextOccurrence ? new Date(a.nextOccurrence) : new Date(a.date);
            const dateB = b.isRecurringGroup && b.nextOccurrence ? new Date(b.nextOccurrence) : new Date(b.date);
            return dateA - dateB;
        });
        
        // Apply limit
        const limitedEvents = allEvents.slice(0, limit);
        
        console.log(`Returning ${limitedEvents.length} events (${groupedRecurringEvents.length} recurring, ${oneOffEvents.length} one-off)`);
        
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
                recurringCount: groupedRecurringEvents.length,
                oneOffCount: oneOffEvents.length,
                venueSlug: venueSlug
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

function groupRecurringEvents(events) {
    const groups = {};
    
    events.forEach(event => {
        const groupKey = createRecurringGroupKey(event);
        
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(event);
    });
    
    return Object.values(groups).map(group => {
        if (group.length === 1) {
            // Single event, return as is
            return group[0];
        } else {
            // Multiple events, create a grouped event
            const firstEvent = group[0];
            const pattern = firstEvent.recurringPattern || extractRecurringPattern(firstEvent.recurringInfo);
            const nextOccurrence = calculateNextOccurrence(new Date(firstEvent.date), pattern);
            
            return {
                ...firstEvent,
                isRecurringGroup: true,
                instances: group,
                nextOccurrence: nextOccurrence ? nextOccurrence.toISOString() : firstEvent.date,
                totalOccurrences: group.length,
                recurringPattern: pattern
            };
        }
    });
}

function createRecurringGroupKey(event) {
    // Create a key based on event name and recurring pattern
    const pattern = event.recurringPattern || extractRecurringPattern(event.recurringInfo);
    return `${event.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${pattern}`;
}

function extractRecurringPattern(recurringInfo) {
    if (!recurringInfo) return null;
    
    const text = recurringInfo.toLowerCase();
    if (text.includes('weekly') || text.includes('every week')) {
        return 'weekly';
    } else if (text.includes('monthly') || text.includes('every month')) {
        return 'monthly';
    } else if (text.includes('daily') || text.includes('every day')) {
        return 'daily';
    } else if (text.includes('bi-weekly') || text.includes('every two weeks')) {
        return 'bi-weekly';
    } else if (text.includes('yearly') || text.includes('annual')) {
        return 'yearly';
    } else {
        return 'recurring';
    }
}

function calculateNextOccurrence(startDate, pattern) {
    if (!pattern || !startDate) return null;
    
    const now = new Date();
    let next = new Date(startDate);
    
    // Keep adding intervals until we find a future date
    while (next <= now) {
        switch (pattern) {
            case 'weekly':
                next.setDate(next.getDate() + 7);
                break;
            case 'bi-weekly':
                next.setDate(next.getDate() + 14);
                break;
            case 'monthly':
                next.setMonth(next.getMonth() + 1);
                break;
            case 'yearly':
                next.setFullYear(next.getFullYear() + 1);
                break;
            case 'daily':
                next.setDate(next.getDate() + 1);
                break;
            default:
                return null;
        }
    }
    
    return next;
}

function extractImageUrl(data) {
    // Handle different image field formats
    if (data.image) {
        if (typeof data.image === 'string') {
            return { url: data.image };
        } else if (data.image.url) {
            return data.image;
        }
    }
    
    if (data.promoImage) {
        if (typeof data.promoImage === 'string') {
            return { url: data.promoImage };
        } else if (data.promoImage.url) {
            return data.promoImage;
        }
    }
    
    if (data.cloudinaryPublicId) {
        return { url: `https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_400,h_600,c_limit/${data.cloudinaryPublicId}` };
    }
    
    return null;
}