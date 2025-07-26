const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
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

exports.handler = async (event, context) => {
    console.log("=== VENUES FUNCTION CALLED - TRIGGER NEW DEPLOY ===");
    
    try {
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.get();
        
        console.log(`Found ${snapshot.size} total venues in collection`);
        
        const venues = [];
        
        snapshot.forEach(doc => {
            const venueData = doc.data();
            
            // Process all venues - let processVenueForPublic handle image logic
            const processedVenue = processVenueForPublic({
                id: doc.id,
                ...venueData
            });
            
            // Debug: Log raw venue data to see what fields exist
            console.log(`Raw venue data for ${processedVenue.name}:`, {
                id: doc.id,
                hasImageField: !!venueData.image,
                hasPhotoField: !!venueData.Photo,
                hasCloudinaryId: !!venueData['Cloudinary Public ID'],
                processedImage: processedVenue.image
            });
            
            // Only include venues that have actual images (not placeholders)
            if (processedVenue.image && processedVenue.image.url && !processedVenue.image.url.includes('placehold.co')) {
                venues.push(processedVenue);
            }
        });
        
        console.log(`Found ${venues.length} venues to display - CLOUDINARY ONLY`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify({
                venues: venues,
                totalCount: venues.length,
                version: 'venues-dedicated-function'
            })
        };
        
    } catch (error) {
        console.error('Error fetching venues:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Failed to fetch venues',
                message: error.message
            })
        };
    }
};

function processVenueForPublic(venueData) {
    // Extract image URL from various possible formats
    let imageUrl = null;
    
    // 1. First try Cloudinary public ID
    const cloudinaryId = venueData['Cloudinary Public ID'] || venueData['cloudinaryPublicId'];
    if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_800,h_800,c_fill/${cloudinaryId}`;
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
            imageUrl = `https://placehold.co/800x400/1e1e1e/EAEAEA?text=${encodedName}`;
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