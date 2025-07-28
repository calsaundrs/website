const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Getting events with comprehensive recurring system');
    
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
        const limit = parseInt(queryParams.get('limit')) || 50;
        const view = queryParams.get('view');
        const venues = queryParams.getAll('venues'); // Get venue filters
        
        console.log(`Getting events with recurring system. Limit: ${limit}, View: ${view}, Venues: ${venues.join(', ')}`);
        
        // If view=venues, return venues instead of events
        if (view === 'venues') {
            console.log('Returning venues list');
            const venuesRef = db.collection('venues');
            const venuesSnapshot = await venuesRef.get();
            const venuesList = [];
            
            venuesSnapshot.forEach(doc => {
                const data = doc.data();
                // Only include venues with Cloudinary images
                const imageData = extractImageUrl(data);
                if (imageData && imageData.url) {
                    venuesList.push({
                        id: doc.id,
                        name: data.name || data['Name'] || 'Unnamed Venue',
                        slug: data.slug || data['Slug'] || '',
                        address: data.address || data['Address'] || '',
                        description: data.description || data['Description'] || '',
                        image: imageData
                    });
                }
            });
            
            // Sort venues by name
            venuesList.sort((a, b) => a.name.localeCompare(b.name));
            
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
                    venues: venuesList
                })
            };
        }
        
        // Build query for events
        let query = db.collection('events')
            .where('status', '==', 'approved')
            .orderBy('date', 'asc');
        
        const snapshot = await query.get();
        let events = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Only include future events or events from today
            const eventDate = new Date(data.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (eventDate >= today) {
                // Debug image data
                console.log('Event data for', data.name || 'Untitled Event', ':');
                console.log('  - promoImage:', data.promoImage);
                console.log('  - image:', data.image);
                console.log('  - promo_image:', data.promo_image);
                console.log('  - All image-related fields:', Object.keys(data).filter(key => 
                    key.toLowerCase().includes('image') || 
                    key.toLowerCase().includes('promo') || 
                    key.toLowerCase().includes('thumbnail')
                ));
                
                const extractedImage = extractImageUrl(data);
                console.log('  - Extracted image:', extractedImage);
                
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
                    image: extractedImage,
                    slug: data.slug || '',
                    promotion: data.promotion || null
                });
            }
        });
        
        // Filter by venues if specified
        if (venues && venues.length > 0 && venues[0] !== 'all') {
            console.log(`Filtering events by venues: ${venues.join(', ')}`);
            events = events.filter(event => {
                return venues.some(venueSlug => event.venueSlug === venueSlug);
            });
            console.log(`After venue filtering: ${events.length} events`);
        }
        
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
                limit: limit
            })
        };
        
    } catch (error) {
        console.error('Error getting events with recurring system:', error);
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
        if (event.isRecurring && event.recurringGroupId) {
            // This is a recurring event with a group ID
            if (recurringGroups.has(event.recurringGroupId)) {
                // Add to existing group
                const group = recurringGroups.get(event.recurringGroupId);
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
                recurringGroups.set(event.recurringGroupId, group);
            }
        } else if (event.recurringInfo || event.recurringPattern) {
            // Legacy recurring event (no group ID)
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