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
                name: venueData.name || venueData['Venue Name'] || venueData['Name'],
                slug: processedVenue.slug,
                hasImageField: !!venueData.image,
                hasPhotoField: !!venueData.Photo,
                hasCloudinaryId: !!venueData['Cloudinary Public ID'],
                processedImage: processedVenue.image
            });
            
            // Check if this is an admin request (include all venues)
            const isAdminRequest = event.queryStringParameters && event.queryStringParameters.admin === 'true';
            
            if (isAdminRequest) {
                // For admin requests, include all venues regardless of image status
                venues.push(processedVenue);
                console.log(`✅ INCLUDED (ADMIN): ${processedVenue.name} with slug: ${processedVenue.slug} (image: ${processedVenue.image ? 'yes' : 'no'})`);
            } else {
                // For public requests, only include venues with actual images (not placeholders)
                if (processedVenue.image && processedVenue.image.url && !processedVenue.image.url.includes('placehold.co')) {
                    venues.push(processedVenue);
                    console.log(`✅ INCLUDED: ${processedVenue.name} with slug: ${processedVenue.slug}`);
                } else {
                    console.log(`❌ EXCLUDED: ${processedVenue.name} - no valid image`);
                }
            }
        });
        
        const isAdminRequest = event.queryStringParameters && event.queryStringParameters.admin === 'true';
        console.log(`Found ${venues.length} venues to display - ${isAdminRequest ? 'ALL VENUES (ADMIN)' : 'CLOUDINARY ONLY'}`);
        
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
    
    // 1. First try photoUrl (new venue format)
    const photoUrl = venueData.photoUrl || venueData['Photo URL'];
    if (photoUrl) {
        imageUrl = photoUrl;
    } else {
        // 2. Try Cloudinary public ID (legacy format)
        const cloudinaryId = venueData['Cloudinary Public ID'] || venueData['cloudinaryPublicId'];
        if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
            imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_800,h_400,c_fill,g_auto/${cloudinaryId}`;
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
    
    // Generate slug from venue name if not provided
    const venueName = venueData.name || venueData['Venue Name'] || venueData['Name'] || 'Venue';
    const generateSlug = (name) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };
    
    const venue = {
        id: venueData.id,
        name: venueName,
        slug: venueData.slug || venueData['Venue Slug'] || venueData['Slug'] || generateSlug(venueName),
        description: venueData.description || venueData['Description'] || `Venue hosting events`,
        address: venueData.address || venueData['Venue Address'] || venueData['Address'] || 'Address TBC',
        link: venueData.link || venueData['Venue Link'] || venueData['Link'],
        image: imageUrl ? { url: imageUrl } : null,
        category: venueData.category || venueData.tags || venueData['Tags'] || [],
        type: venueData.type || venueData['Type'] || 'venue',
        status: venueData.status || 'listed',
        openingHours: venueData.openingHours || venueData['Opening Hours'],
        popular: venueData.popular || venueData['Popular'] || false,
        
        // Additional fields for admin editing
        website: venueData.website || venueData['Website'],
        instagram: venueData.instagram || venueData['Instagram'],
        facebook: venueData.facebook || venueData['Facebook'],
        tiktok: venueData.tiktok || venueData['TikTok'],
        contactEmail: venueData.contactEmail || venueData['Contact Email'],
        contactPhone: venueData.contactPhone || venueData['Contact Phone'],
        accessibility: venueData.accessibility || venueData['Accessibility'],
        accessibilityRating: venueData.accessibilityRating || venueData['Accessibility Rating'],
        parkingException: venueData.parkingException || venueData['Parking Exception'],
        vibeTags: venueData.vibeTags || venueData['Vibe Tags'] || [],
        venueFeatures: venueData.venueFeatures || venueData['Venue Features'] || [],
        accessibilityFeatures: venueData.accessibilityFeatures || venueData['Accessibility Features'] || [],
        
        // Image fields for admin
        photoUrl: venueData.photoUrl || venueData['Photo URL'],
        cloudinaryPublicId: venueData.cloudinaryPublicId || venueData['Cloudinary Public ID']
    };
    
    if (!venue.category || venue.category.length === 0) {
        venue.category = ['LGBTQ+', 'Venue'];
    }
    
    return venue;
}