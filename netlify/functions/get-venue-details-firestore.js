const admin = require('firebase-admin');
const Handlebars = require('handlebars');

// Version: 2025-01-27-v1 - Firestore-based venue details function

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
    console.log("=== VENUE DETAILS FUNCTION CALLED ===");
    
    try {
        const { venueSlug } = event.queryStringParameters || {};
        
        if (!venueSlug) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Venue slug is required'
                })
            };
        }
        
        console.log(`Looking for venue with slug: ${venueSlug}`);
        
        // Query venues collection by slug
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.where('slug', '==', venueSlug).limit(1).get();
        
        if (snapshot.empty) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Venue not found'
                })
            };
        }
        
        const doc = snapshot.docs[0];
        const venueData = doc.data();
        
        console.log(`Found venue: ${venueData.name || venueData['Venue Name']}`);
        
        // Process venue data
        const processedVenue = processVenueForDetails({
            id: doc.id,
            ...venueData
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify({
                venue: processedVenue,
                version: 'venue-details-function'
            })
        };
        
    } catch (error) {
        console.error('Error fetching venue details:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Failed to fetch venue details',
                message: error.message
            })
        };
    }
};

function processVenueForDetails(venueData) {
    // Extract image URL from various possible formats
    let imageUrl = null;
    
    // 1. First try Cloudinary public ID
    const cloudinaryId = venueData['Cloudinary Public ID'] || venueData['cloudinaryPublicId'];
    if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_fill,g_auto/${cloudinaryId}`;
    } else {
        // 2. Try to find any image field that might contain a Cloudinary URL
        const possibleImageFields = ['image', 'Image', 'Photo', 'Photo URL', 'imageUrl'];
        for (const field of possibleImageFields) {
            const imageData = venueData[field];
            if (imageData) {
                // Check if it's already a Cloudinary URL
                if (typeof imageData === 'string' && imageData.includes('cloudinary.com')) {
                    imageUrl = imageData;
                    break;
                }
                // Check if it's an object with a Cloudinary URL
                if (imageData && typeof imageData === 'object' && imageData.url && imageData.url.includes('cloudinary.com')) {
                    imageUrl = imageData.url;
                    break;
                }
            }
        }
        
        // 3. If still no image, generate a consistent placeholder based on venue name
        if (!imageUrl) {
            const venueName = venueData.name || venueData['Venue Name'] || venueData['Name'] || 'Venue';
            const encodedName = encodeURIComponent(venueName);
            imageUrl = `https://placehold.co/1200x675/1e1e1e/EAEAEA?text=${encodedName}`;
        }
    }
    
    const venue = {
        id: venueData.id,
        name: venueData.name || venueData['Venue Name'] || venueData['Name'],
        slug: venueData.slug || venueData['Venue Slug'] || venueData['Slug'],
        description: venueData.description || venueData['Description'] || `Venue hosting events`,
        address: venueData.address || venueData['Venue Address'] || venueData['Address'] || 'Address TBC',
        link: venueData.link || venueData['Venue Link'] || venueData['Link'],
        image: imageUrl ? { url: imageUrl } : null,
        category: venueData.category || venueData.tags || venueData['Tags'] || [],
        type: venueData.type || venueData['Type'] || 'venue',
        status: venueData.status || venueData['Status'] || venueData['Listing Status'] || 'Listed',
        openingHours: venueData.openingHours || venueData['Opening Hours'],
        popular: venueData.popular || venueData['Popular'] || false
    };
    
    if (!venue.category || venue.category.length === 0) {
        venue.category = ['LGBTQ+', 'Venue'];
    }
    
    return venue;
}

async function getUpcomingEventsForVenue(venueId, limit = 6) {
    try {
        const eventsRef = db.collection('events');
        const now = new Date();
        
        const snapshot = await eventsRef
            .where('venueId', '==', venueId)
            .where('status', '==', 'approved')
            .where('date', '>=', now)
            .orderBy('date', 'asc')
            .limit(limit)
            .get();

        const events = [];
        snapshot.forEach(doc => {
            const eventData = {
                id: doc.id,
                ...doc.data()
            };
            events.push({
                id: eventData.id,
                name: eventData.name,
                slug: eventData.slug,
                date: eventData.date,
                category: eventData.category || []
            });
        });

        return events;
        
    } catch (error) {
        console.error('Error getting upcoming events for venue:', error);
        return [];
    }
}