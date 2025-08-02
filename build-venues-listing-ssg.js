const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// Initialize Firebase Admin if not already initialized
let firebaseInitialized = false;
let db;

try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
    }
    db = admin.firestore();
    firebaseInitialized = true;
    console.log('✅ Firebase initialized for venues listing SSG');
} catch (error) {
    console.log('⚠️ Firebase initialization failed, will skip venues listing SSG:', error.message);
    firebaseInitialized = false;
}

// Function to process venue data (same logic as get-venues-firestore.js)
function processVenueForPublic(venueData) {
    // Extract image URL from various possible formats
    let imageUrl = null;
    
    // 1. First try Cloudinary public ID
    const cloudinaryId = venueData['Cloudinary Public ID'] || venueData['cloudinaryPublicId'];
    if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_90,w_1600,h_900,c_fill,fl_progressive/${cloudinaryId}`;
    } else if (venueData.airtableId && process.env.CLOUDINARY_CLOUD_NAME) {
        // Try generating Cloudinary URL from airtableId as fallback
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_90,w_1600,h_900,c_fill,fl_progressive/brumoutloud_events/venue_${venueData.airtableId}`;
    } else {
        // 2. Try to find any image field that might contain a Cloudinary URL
        const possibleImageFields = ['image', 'Image', 'Photo', 'Photo URL', 'imageUrl', 'Venue Image'];
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
        website: venueData.website || venueData['Website'] || '',
        phone: venueData.phone || venueData['Phone'] || '',
        image: imageUrl ? { url: imageUrl } : null,
        category: venueData.category || venueData.tags || venueData['Tags'] || [],
        type: venueData.type || venueData['Type'] || 'venue',
        status: venueData.status || 'listed',
        openingHours: venueData.openingHours || venueData['Opening Hours'],
        popular: venueData.popular || venueData['Popular'] || false,
        airtableId: venueData.airtableId || null
    };
    
    if (!venue.category || venue.category.length === 0) {
        venue.category = ['LGBTQ+', 'Venue'];
    }
    
    return venue;
}

// Function to get all venues with images
async function getAllVenuesWithImages() {
    try {
        if (!firebaseInitialized) {
            console.log('⚠️ Firebase not initialized. Cannot fetch venues.');
            return [];
        }
        
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.get();
        
        const venues = [];
        
        snapshot.forEach(doc => {
            const venueData = doc.data();
            
            // Process venue data
            const processedVenue = processVenueForPublic({
                id: doc.id,
                ...venueData
            });
            
            // Only include venues that have actual images (not placeholders)
            if (processedVenue.image && processedVenue.image.url && !processedVenue.image.url.includes('placehold.co')) {
                venues.push(processedVenue);
                console.log(`✅ INCLUDED: ${processedVenue.name} with slug: ${processedVenue.slug}`);
            } else {
                console.log(`❌ EXCLUDED: ${processedVenue.name} - no valid image`);
            }
        });
        
        // Sort venues by name
        venues.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`Found ${venues.length} venues with images for SSG`);
        return venues;
        
    } catch (error) {
        console.error('Error fetching venues for SSG:', error);
        throw error;
    }
}

// Function to generate the venues listing HTML
async function generateVenuesListingPage() {
    try {
        console.log('🚀 Starting Venues Listing SSG...');
        
        if (!firebaseInitialized) {
            console.log('⚠️ Firebase not initialized. Skipping venues listing SSG.');
            return {
                success: false,
                reason: 'Firebase not initialized - missing environment variables'
            };
        }
        
        // Read the current all-venues.html template
        const templatePath = path.join(__dirname, 'all-venues.html');
        let templateContent = await fs.readFile(templatePath, 'utf8');
        
        // Get all venues
        const venues = await getAllVenuesWithImages();
        
        // Generate venue cards HTML
        const venueCardsHtml = venues.map(venue => {
            const categoryTags = Array.isArray(venue.category) ? 
                venue.category.map(cat => `<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full flex-shrink-0">${cat}</span>`).join('') :
                '';
            
            const isPopular = venue.popular || false;
            const venueType = venue.type || 'venue';
            
            return `
                <div class="venue-card rounded-xl overflow-hidden relative flex flex-col group cursor-pointer" onclick="window.location.href='/venue/${venue.slug}'">
                    <div class="relative">
                        <img src="${venue.image.url}" alt="${venue.name}" class="w-full h-48 object-cover">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        ${isPopular ? '<div class="absolute top-3 right-3"><span class="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-semibold">POPULAR</span></div>' : ''}
                    </div>
                    <div class="p-6 flex flex-col flex-grow">
                        <h3 class="text-xl font-bold text-white mb-2 text-left group-hover:text-accent-color transition-colors">${venue.name}</h3>
                        <p class="text-gray-400 text-sm mb-3 text-left">
                            <i class="fas fa-map-marker-alt mr-1"></i>${venue.address || 'Address TBC'}
                        </p>
                        <p class="text-gray-300 text-sm mb-4 text-left line-clamp-2">${venue.description || 'No description available.'}</p>
                        <div class="flex gap-1 mb-4 overflow-hidden">
                            ${categoryTags}
                        </div>
                        <div class="flex justify-between items-center mt-auto">
                            <span class="btn-primary text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-eye mr-1"></i>View Venue
                            </span>
                            <button class="btn-secondary text-white px-3 py-2 rounded-lg text-sm" onclick="event.stopPropagation(); window.location.href='/events?venue=${venue.slug}'">
                                <i class="fas fa-calendar"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');
        
        // Replace placeholders in template with static content
        templateContent = templateContent
            .replace('<!-- VENUES_GRID_SSG_PLACEHOLDER -->', venueCardsHtml)
            .replace(/<!-- SSG_TIMESTAMP -->/g, new Date().toISOString());
        
        // Remove or replace JavaScript loading logic with static notice
        templateContent = templateContent.replace(
            /async function initializePage\(\) \{[\s\S]*?\}\s*initializePage\(\);/,
            '// Venues loaded statically via SSG - no dynamic loading needed'
        );
        
        // Write the static file
        await fs.writeFile(templatePath, templateContent, 'utf8');
        
        console.log(`✅ Generated static venues listing with ${venues.length} venues`);
        
        return {
            success: true,
            totalVenues: venues.length,
            outputFile: templatePath
        };
        
    } catch (error) {
        console.error('❌ Error generating venues listing SSG:', error);
        throw error;
    }
}

// Main execution
if (require.main === module) {
    generateVenuesListingPage()
        .then(result => {
            if (result.success) {
                console.log('🎉 Venues listing SSG completed successfully');
                console.log(`📊 Stats: ${result.totalVenues} venues`);
            } else {
                console.log(`⚠️ Venues listing SSG skipped: ${result.reason}`);
            }
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Venues listing SSG failed:', error);
            process.exit(1);
        });
}

module.exports = { generateVenuesListingPage }; 