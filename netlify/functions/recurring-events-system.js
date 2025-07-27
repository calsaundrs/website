const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Recurring Events System');
    
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
        const action = queryParams.get('action');
        const venueSlug = queryParams.get('venueSlug');
        const limit = parseInt(queryParams.get('limit')) || 50;
        
        console.log(`Recurring events action: ${action}`);
        
        switch (action) {
            case 'get-grouped':
                return await getGroupedRecurringEvents(db, venueSlug, limit);
            case 'create-recurring':
                return await createRecurringEvent(db, event.body);
            case 'update-recurring':
                return await updateRecurringEvent(db, event.body);
            case 'get-next-occurrences':
                return await getNextOccurrences(db, queryParams.get('eventId'));
            default:
                return await getGroupedRecurringEvents(db, venueSlug, limit);
        }
        
    } catch (error) {
        console.error('Error in recurring events system:', error);
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
                error: 'Failed to process recurring events',
                message: error.message
            })
        };
    }
};

async function getGroupedRecurringEvents(db, venueSlug, limit) {
    console.log(`Getting grouped recurring events for venue: ${venueSlug || 'all'}`);
    
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
                recurringPattern: data.recurringPattern || null,
                recurringEndDate: data.recurringEndDate || null,
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
}

function groupRecurringEvents(events) {
    const groupedEvents = [];
    const recurringGroups = new Map();
    
    events.forEach(event => {
        if (event.recurringInfo || event.recurringPattern) {
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
                const pattern = event.recurringPattern || extractRecurringPattern(event.recurringInfo);
                const group = {
                    ...event,
                    instances: [event],
                    isRecurringGroup: true,
                    recurringPattern: pattern,
                    nextOccurrence: calculateNextOccurrence(event.date, pattern),
                    totalOccurrences: calculateTotalOccurrences(event.date, event.recurringEndDate, pattern)
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
    const pattern = event.recurringPattern || extractRecurringPattern(event.recurringInfo);
    return `${event.name}-${event.venueName}-${pattern}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
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
    const start = new Date(startDate);
    const now = new Date();
    
    if (start > now) {
        return start;
    }
    
    let next = new Date(start);
    
    switch (pattern) {
        case 'daily':
            while (next <= now) {
                next.setDate(next.getDate() + 1);
            }
            break;
        case 'weekly':
            while (next <= now) {
                next.setDate(next.getDate() + 7);
            }
            break;
        case 'bi-weekly':
            while (next <= now) {
                next.setDate(next.getDate() + 14);
            }
            break;
        case 'monthly':
            while (next <= now) {
                next.setMonth(next.getMonth() + 1);
            }
            break;
        case 'yearly':
            while (next <= now) {
                next.setFullYear(next.getFullYear() + 1);
            }
            break;
        default:
            return start;
    }
    
    return next;
}

function calculateTotalOccurrences(startDate, endDate, pattern) {
    if (!endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    let current = new Date(start);
    
    while (current <= end) {
        count++;
        
        switch (pattern) {
            case 'daily':
                current.setDate(current.getDate() + 1);
                break;
            case 'weekly':
                current.setDate(current.getDate() + 7);
                break;
            case 'bi-weekly':
                current.setDate(current.getDate() + 14);
                break;
            case 'monthly':
                current.setMonth(current.getMonth() + 1);
                break;
            case 'yearly':
                current.setFullYear(current.getFullYear() + 1);
                break;
            default:
                return count;
        }
    }
    
    return count;
}

async function createRecurringEvent(db, body) {
    try {
        const eventData = JSON.parse(body);
        
        // Validate recurring event data
        if (!eventData.recurringPattern || !eventData.startDate) {
            throw new Error('Missing required recurring event data');
        }
        
        // Generate recurring event instances
        const instances = generateRecurringInstances(eventData);
        
        // Create all instances in a batch
        const batch = db.batch();
        const createdEvents = [];
        
        instances.forEach((instance, index) => {
            const eventRef = db.collection('events').doc();
            batch.set(eventRef, {
                ...eventData,
                date: instance.toISOString(),
                slug: `${eventData.slug}-${index + 1}`,
                recurringInstance: index + 1,
                totalInstances: instances.length,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            createdEvents.push({
                id: eventRef.id,
                date: instance.toISOString(),
                slug: `${eventData.slug}-${index + 1}`
            });
        });
        
        await batch.commit();
        
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
                message: `Created ${instances.length} recurring event instances`,
                events: createdEvents
            })
        };
        
    } catch (error) {
        console.error('Error creating recurring event:', error);
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
                error: 'Failed to create recurring event',
                message: error.message
            })
        };
    }
}

function generateRecurringInstances(eventData) {
    const startDate = new Date(eventData.startDate);
    const endDate = eventData.recurringEndDate ? new Date(eventData.recurringEndDate) : null;
    const pattern = eventData.recurringPattern;
    const maxInstances = eventData.maxInstances || 52; // Default to 52 weeks max
    
    const instances = [];
    let current = new Date(startDate);
    let count = 0;
    
    while (count < maxInstances) {
        if (endDate && current > endDate) {
            break;
        }
        
        instances.push(new Date(current));
        count++;
        
        switch (pattern) {
            case 'daily':
                current.setDate(current.getDate() + 1);
                break;
            case 'weekly':
                current.setDate(current.getDate() + 7);
                break;
            case 'bi-weekly':
                current.setDate(current.getDate() + 14);
                break;
            case 'monthly':
                current.setMonth(current.getMonth() + 1);
                break;
            case 'yearly':
                current.setFullYear(current.getFullYear() + 1);
                break;
            default:
                return instances;
        }
    }
    
    return instances;
}

function extractImageUrl(data) {
    // Extract Cloudinary image object from various possible formats
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