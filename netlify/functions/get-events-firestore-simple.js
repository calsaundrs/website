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
                // Use standardized field names - no more legacy mapping
                const eventData = {
                    id: doc.id,
                    name: data.name || 'Untitled Event',
                    description: data.description || '',
                    date: data.date, // Keep for backward compatibility
                    eventDate: data.eventDate || null, // New separate date field
                    eventTime: data.eventTime || null, // New separate time field
                    status: data.status || 'pending',
                    slug: data.slug || '',
                    category: data.category || [],
                    venueId: data.venueId || null,
                    venueName: data.venueName || '',
                    venueSlug: data.venueSlug || '',
                    airtableId: data.airtableId || null,
                    image: extractImageUrl(data),
                    link: data.link || '',
                    ticketLink: data.ticketLink || '',
                    recurringInfo: data.recurringInfo || null,
                    seriesId: data.seriesId || null,
                    promotion: data.promotion || {},
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    submittedBy: data.submittedBy || '',
                    approvedBy: data.approvedBy,
                    approvedAt: data.approvedAt,
                    
                    // Recurring event fields (standardized)
                    isRecurring: data.isRecurring || false,
                    recurringPattern: data.recurringPattern || null,
                    recurringGroupId: data.recurringGroupId || null,
                    recurringInstance: data.recurringInstance || null,
                    totalInstances: data.totalInstances || null,
                    recurringStartDate: data.recurringStartDate || null,
                    recurringEndDate: data.recurringEndDate || null
                };
                
                console.log(`Processing event: ${eventData.name} (status: ${eventData.status}, date: ${eventData.date}, image: ${JSON.stringify(eventData.image)})`);
                
                events.push(eventData);
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
        
        // Filter events to only include those with actual images (not placeholders)
        const eventsWithImages = [];
        events.forEach(event => {
            if (event.image && event.image.url && !event.image.url.includes('placehold.co')) {
                eventsWithImages.push(event);
                console.log(`✅ INCLUDED: ${event.name} - has valid image`);
            } else {
                console.log(`❌ EXCLUDED: ${event.name} - no valid image (image: ${JSON.stringify(event.image)})`);
            }
        });
        
        console.log(`After image filtering: ${eventsWithImages.length} events (removed ${events.length - eventsWithImages.length} events without images)`);
        events = eventsWithImages;
        
        // Deduplicate events first, but handle recurring events properly
        const deduplicatedEvents = [];
        const seenEvents = new Map();
        const recurringGroups = new Map();
        
        events.forEach(event => {
            // Check if this is a recurring event (either by isRecurring flag or recurringGroupId)
            if ((event.isRecurring && event.recurringGroupId) || event.recurringGroupId) {
                // This is a recurring event - collect all instances for grouping later
                if (!recurringGroups.has(event.recurringGroupId)) {
                    recurringGroups.set(event.recurringGroupId, []);
                }
                recurringGroups.get(event.recurringGroupId).push(event);
            } else {
                // Non-recurring event - deduplicate normally
                const key = `${event.name}-${event.date}`;
                const existing = seenEvents.get(key);
                
                if (!existing) {
                    seenEvents.set(key, event);
                    deduplicatedEvents.push(event);
                } else {
                    // Prefer events without airtableId (pure Firestore) over migrated ones
                    if (!event.airtableId && existing.airtableId) {
                        const index = deduplicatedEvents.findIndex(e => e.id === existing.id);
                        if (index !== -1) {
                            deduplicatedEvents[index] = event;
                            seenEvents.set(key, event);
                        }
                    }
                }
            }
        });
        
        console.log(`After deduplication: ${deduplicatedEvents.length} non-recurring events, ${recurringGroups.size} recurring groups`);
        
        // Group recurring events
        const groupedEvents = groupRecurringEvents(Array.from(recurringGroups.values()).flat());
        
        // Combine non-recurring and grouped recurring events
        events = [...deduplicatedEvents, ...groupedEvents];
        
        // Sort by date
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Apply limit
        const limitedEvents = events.slice(0, limit);
        
        console.log(`Returning ${limitedEvents.length} events (${deduplicatedEvents.length} non-recurring + ${groupedEvents.length} grouped recurring)`);
        
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
                limit: limit,
                timestamp: new Date().toISOString()
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
                    totalOccurrences: event.totalInstances || calculateTotalOccurrences(event.date, event.recurringEndDate, pattern),
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

function upgradeCloudinaryQuality(url) {
    if (!url || !url.includes('cloudinary.com')) {
        return url;
    }
    
    // Extract the base URL and public ID
    const match = url.match(/https:\/\/res\.cloudinary\.com\/([^\/]+)\/image\/upload\/([^\/]+)\/(.*)/);
    if (match) {
        const [, cloudName, , publicId] = match;
        // Return high-quality URL with new settings
        return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_90,w_1600,h_900,c_fill,fl_progressive/${publicId}`;
    }
    
    // If we can't parse it, return original
    return url;
}

function extractImageUrl(data) {
    console.log('Extracting image from data with keys:', Object.keys(data));
    
    // Use the same logic as SSG event pages - prioritize Cloudinary Public ID with specific transformations
    if (data['Cloudinary Public ID'] && process.env.CLOUDINARY_CLOUD_NAME) {
        console.log('Found Cloudinary Public ID:', data['Cloudinary Public ID']);
        const cloudinaryUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${data['Cloudinary Public ID']}`;
        console.log('Generated Cloudinary URL:', cloudinaryUrl);
        return { url: cloudinaryUrl };
    }
    
    // Also check for camelCase version
    if (data.cloudinaryPublicId && process.env.CLOUDINARY_CLOUD_NAME) {
        console.log('Found cloudinaryPublicId:', data.cloudinaryPublicId);
        const cloudinaryUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${data.cloudinaryPublicId}`;
        console.log('Generated Cloudinary URL:', cloudinaryUrl);
        return { url: cloudinaryUrl };
    }
    
    // Handle Promo Image as array (from Airtable)
    if (data['Promo Image'] && Array.isArray(data['Promo Image']) && data['Promo Image'].length > 0) {
        console.log('Found Promo Image array:', data['Promo Image']);
        const promoImage = data['Promo Image'][0];
        if (promoImage && promoImage.url) {
            return { url: promoImage.url };
        }
    }
    
    // Handle other image formats
    if (data.promoImage && data.promoImage.url) {
        console.log('Found promoImage object:', data.promoImage);
        return data.promoImage;
    }
    if (data.image && data.image.url) {
        console.log('Found image object:', data.image);
        return data.image;
    }
    if (data['Image'] && data['Image'].url) {
        console.log('Found Image object:', data['Image']);
        return data['Image'];
    }
    if (data.thumbnail && data.thumbnail.url) {
        console.log('Found thumbnail object:', data.thumbnail);
        return data.thumbnail;
    }
    if (data['Thumbnail'] && data['Thumbnail'].url) {
        console.log('Found Thumbnail object:', data['Thumbnail']);
        return data['Thumbnail'];
    }
    if (data.venueImage && data.venueImage.url) {
        console.log('Found venueImage object:', data.venueImage);
        return data.venueImage;
    }
    if (data['Venue Image'] && data['Venue Image'].url) {
        console.log('Found Venue Image object:', data['Venue Image']);
        return data['Venue Image'];
    }
    if (data.promo_image && data.promo_image.url) {
        console.log('Found promo_image object:', data.promo_image);
        return data.promo_image;
    }
    if (data.venue_image && data.venue_image.url) {
        console.log('Found venue_image object:', data.venue_image);
        return data.venue_image;
    }
    
    // Check for string formats (direct URLs)
    if (typeof data.promoImage === 'string' && data.promoImage.includes('cloudinary')) {
        console.log('Found promoImage string:', data.promoImage);
        return { url: data.promoImage };
    }
    if (typeof data.image === 'string' && data.image.includes('cloudinary')) {
        console.log('Found image string:', data.image);
        return { url: data.image };
    }
    if (typeof data.thumbnail === 'string' && data.thumbnail.includes('cloudinary')) {
        console.log('Found thumbnail string:', data.thumbnail);
        return { url: data.thumbnail };
    }
    if (typeof data.venueImage === 'string' && data.venueImage.includes('cloudinary')) {
        console.log('Found venueImage string:', data.venueImage);
        return { url: data.venueImage };
    }
    if (typeof data.promo_image === 'string' && data.promo_image.includes('cloudinary')) {
        console.log('Found promo_image string:', data.promo_image);
        return { url: data.promo_image };
    }
    if (typeof data.venue_image === 'string' && data.venue_image.includes('cloudinary')) {
        console.log('Found venue_image string:', data.venue_image);
        return { url: data.venue_image };
    }
    
    // Check for any field that contains 'cloudinary' in the URL and upgrade quality
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.includes('cloudinary')) {
            console.log('Found cloudinary string in field', key, ':', value);
            // Upgrade existing cloudinary URLs to high quality settings
            const upgradedUrl = upgradeCloudinaryQuality(value);
            return { url: upgradedUrl };
        }
        if (typeof value === 'object' && value && value.url && value.url.includes('cloudinary')) {
            console.log('Found cloudinary object in field', key, ':', value);
            // Upgrade existing cloudinary URLs to high quality settings
            const upgradedUrl = upgradeCloudinaryQuality(value.url);
            return { url: upgradedUrl, ...value };
        }
    }
    
    // Try generating Cloudinary URL from airtableId as fallback (pattern: brumoutloud_events/event_[airtableId])
    if (data.airtableId && process.env.CLOUDINARY_CLOUD_NAME) {
        // High quality settings: w_1600 for retina, h_900 for 16:9 ratio, q_90 for high quality, c_fill for better cropping, fl_progressive for faster loading
        const cloudinaryUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_90,w_1600,h_900,c_fill,fl_progressive/brumoutloud_events/event_${data.airtableId}`;
        console.log('Trying high-quality airtableId-based Cloudinary URL:', cloudinaryUrl);
        return { url: cloudinaryUrl };
    }
    
    console.log('No image found in data, using placeholder');
    // Return placeholder image (same as SSG pages)
    return { url: `https://placehold.co/1200x675/1e1e1e/EAEAEA?text=${encodeURIComponent(data.name || 'Event')}` };
}