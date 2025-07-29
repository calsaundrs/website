const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Getting admin events with comprehensive recurring system');
    
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
        const status = queryParams.get('status'); // Filter by status if provided
        const limit = parseInt(queryParams.get('limit')) || 1000; // Higher limit for admin
        
        console.log(`Getting admin events. Status filter: ${status}, Limit: ${limit}`);
        
        // Build query for events - always get all events first
        let query = db.collection('events').orderBy('date', 'desc');
        console.log('Admin Events: Executing query...');
        
        const snapshot = await query.limit(limit).get();
        console.log(`Admin Events: Found ${snapshot.size} events in database`);
        
        let events = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const eventDate = new Date(data.date);
            const isFutureEvent = eventDate >= now;
            
            console.log(`Admin Events: Processing event ${doc.id}: ${data.name || data['Event Name'] || 'Untitled'}, status: ${data.status || 'no status'}, date: ${data.date}, isFuture: ${isFutureEvent}`);
            
            // Extract image information
            const imageData = extractImageUrl(data);
            
            // Process event data for admin view
            const eventData = {
                id: doc.id,
                name: data.name || data['Event Name'] || 'Untitled Event',
                description: data.description || data['Description'] || '',
                date: data.date,
                time: data.time || data['Time'] || '',
                venueName: data.venueName || data['Venue Name'] || '',
                venueSlug: data.venueSlug || data['Venue Slug'] || '',
                category: data.category || data['Category'] || [],
                status: data.status || 'pending',
                slug: data.slug || '',
                link: data.link || data['Link'] || '',
                image: imageData,
                isFutureEvent: isFutureEvent,
                
                // Recurring event fields
                isRecurring: data.isRecurring || false,
                recurringPattern: data.recurringPattern || null,
                recurringInfo: data.recurringInfo || data['Recurring Info'] || null,
                recurringGroupId: data.recurringGroupId || null,
                seriesId: data.seriesId || data['Series ID'] || null,
                recurringInstance: data.recurringInstance || null,
                totalInstances: data.totalInstances || null,
                recurringStartDate: data.recurringStartDate || null,
                recurringEndDate: data.recurringEndDate || null,
                
                // Metadata
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null,
                submittedBy: data.submittedBy || data['Submitted By'] || '',
                submitterEmail: data.submitterEmail || data['Submitter Email'] || '',
                
                // Raw data for debugging
                rawData: data
            };
            
            events.push(eventData);
        });
        
        console.log(`Admin Events: Processed ${events.length} events`);
        
        // Apply status filter if provided
        if (status && status !== 'all') {
            console.log(`Admin Events: Filtering events by status: ${status}`);
            const beforeFilter = events.length;
            events = events.filter(e => e.status === status);
            console.log(`Admin Events: After status filtering: ${events.length} events (was ${beforeFilter})`);
        }
        
        // Filter to only future events for display
        const allEvents = [...events]; // Keep all events for stats
        const futureEvents = events.filter(e => e.isFutureEvent);
        console.log(`Admin Events: Future events: ${futureEvents.length} out of ${allEvents.length} total`);
        
        // Group recurring events (using future events for display)
        const groupedEvents = groupRecurringEvents(futureEvents);
        
        // Separate events by status (using future events for display)
        const pendingEvents = futureEvents.filter(e => e.status === 'pending');
        const approvedEvents = futureEvents.filter(e => e.status === 'approved');
        const rejectedEvents = futureEvents.filter(e => e.status === 'rejected');
        
        // Fix recurring filter - check for any recurring indicators
        const recurringEvents = futureEvents.filter(e => 
            e.isRecurring || 
            e.recurringPattern || 
            e.recurringInfo || 
            e.recurringGroupId || 
            e.seriesId ||
            e.isRecurringGroup
        );
        
        console.log(`Admin Events: Recurring events found: ${recurringEvents.length}`);
        console.log(`Admin Events: Recurring events details:`, recurringEvents.map(e => ({
            name: e.name,
            isRecurring: e.isRecurring,
            recurringPattern: e.recurringPattern,
            recurringInfo: e.recurringInfo,
            recurringGroupId: e.recurringGroupId,
            seriesId: e.seriesId
        })));
        
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
                events: futureEvents, // Only return future events for display
                allEvents: allEvents, // Include all events for reference
                groupedEvents: groupedEvents,
                pendingEvents: pendingEvents,
                approvedEvents: approvedEvents,
                rejectedEvents: rejectedEvents,
                recurringEvents: recurringEvents,
                stats: {
                    total: futureEvents.length, // Only count future events
                    pending: pendingEvents.length,
                    approved: approvedEvents.length,
                    rejected: rejectedEvents.length,
                    recurring: recurringEvents.length,
                    totalAllTime: allEvents.length // Include total for reference
                }
            })
        };
        
    } catch (error) {
        console.error('Error getting admin events:', error);
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
                error: error.message
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
                // Update the group's date to the earliest future instance
                const eventDate = new Date(event.date);
                const groupDate = new Date(group.date);
                const now = new Date();
                
                if (eventDate >= now && (groupDate < now || eventDate < groupDate)) {
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
                    totalOccurrences: calculateTotalOccurrences(event.date, event.recurringEndDate, pattern),
                    recurringGroupId: event.recurringGroupId
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
    
    // Add grouped recurring events (only show the next upcoming instance)
    recurringGroups.forEach(group => {
        // Sort instances by date
        group.instances.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Find the next upcoming instance
        const now = new Date();
        const nextInstance = group.instances.find(instance => new Date(instance.date) >= now);
        
        if (nextInstance) {
            // Use the next instance as the main event
            const mainEvent = {
                ...group,
                id: nextInstance.id,
                name: nextInstance.name,
                date: nextInstance.date,
                venueName: nextInstance.venueName,
                venueSlug: nextInstance.venueSlug,
                description: nextInstance.description,
                category: nextInstance.category,
                link: nextInstance.link,
                image: nextInstance.image,
                slug: nextInstance.slug,
                status: nextInstance.status,
                // Add recurring info
                isRecurringGroup: true,
                recurringPattern: group.recurringPattern,
                totalInstances: group.totalInstances,
                nextOccurrence: nextInstance.date,
                recurringGroupId: group.recurringGroupId
            };
            groupedEvents.push(mainEvent);
        } else {
            // If no future instances, use the latest past instance
            const latestInstance = group.instances[group.instances.length - 1];
            const mainEvent = {
                ...group,
                id: latestInstance.id,
                name: latestInstance.name,
                date: latestInstance.date,
                venueName: latestInstance.venueName,
                venueSlug: latestInstance.venueSlug,
                description: latestInstance.description,
                category: latestInstance.category,
                link: latestInstance.link,
                image: latestInstance.image,
                slug: latestInstance.slug,
                status: latestInstance.status,
                // Add recurring info
                isRecurringGroup: true,
                recurringPattern: group.recurringPattern,
                totalInstances: group.totalInstances,
                nextOccurrence: latestInstance.date,
                recurringGroupId: group.recurringGroupId
            };
            groupedEvents.push(mainEvent);
        }
    });
    
    return groupedEvents;
}

function createRecurringGroupKey(event) {
    // Create a unique key for grouping recurring events
    const pattern = event.recurringPattern || extractRecurringPattern(event.recurringInfo);
    const venue = event.venueName || event.venueSlug;
    return `${pattern}_${venue}_${event.name}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
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
    // Check for Cloudinary Public ID first (new format)
    const cloudinaryId = data.cloudinaryPublicId || data['Cloudinary Public ID'];
    if (cloudinaryId) {
        return {
            url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${cloudinaryId}`,
            alt: data.name || 'Event image'
        };
    }
    
    // Check for Promo Image (Airtable format)
    const promoImage = data['Promo Image'];
    if (promoImage && Array.isArray(promoImage) && promoImage.length > 0) {
        return {
            url: promoImage[0].url,
            alt: data.name || 'Event image'
        };
    }
    
    // Check for image field (various formats)
    const image = data.image || data.promoImage || data.promo_image;
    if (image) {
        const imageUrl = typeof image === 'string' ? image : 
                        (image.url || image[0]?.url);
        if (imageUrl) {
            return {
                url: imageUrl,
                alt: data.name || 'Event image'
            };
        }
    }
    
    // Return placeholder image
    return {
        url: `https://placehold.co/1200x675/1e1e1e/EAEAEA?text=${encodeURIComponent(data.name || 'Event')}`,
        alt: data.name || 'Event image'
    };
} 