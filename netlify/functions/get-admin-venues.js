const admin = require('firebase-admin');

exports.handler = async function(event, context) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Admin Venues: Starting function');
        
        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }
        
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
        
        // Fetch all venues from Firestore
        const venuesRef = db.collection('venues');
        console.log('Admin Venues: Fetching all venues from Firestore');
        const snapshot = await venuesRef.get();
        console.log(`Admin Venues: Found ${snapshot.size} total venues`);
        
        const venues = [];
        const venueMap = new Map(); // To track duplicates by name
        console.log('Admin Venues: Processing venues...');
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const venueName = data.name || data['Name'] || 'Unnamed';
            
            // Skip test venues
            if (venueName.toLowerCase().includes('test') || 
                venueName.toLowerCase().includes('example') ||
                venueName.toLowerCase().includes('sample')) {
                console.log(`Admin Venues: Skipping test venue: ${venueName}`);
                return;
            }
            
            // Check for duplicates by name (case-insensitive)
            const normalizedName = venueName.toLowerCase().trim();
            if (venueMap.has(normalizedName)) {
                console.log(`Admin Venues: Skipping duplicate venue: ${venueName} (ID: ${doc.id})`);
                return;
            }
            
            console.log(`Admin Venues: Processing venue ${doc.id}: ${venueName}`);
            
            // Extract image data (but don't require it)
            const imageData = extractImageUrl(data);
            
            const venue = {
                id: doc.id,
                name: venueName,
                address: data.address || data['Address'] || '',
                description: data.description || data['Description'] || '',
                website: data.website || data['Website'] || '',
                phone: data.contactPhone || data['Contact Phone'] || data.phone || '',
                status: data.status || 'pending',
                slug: data.slug || data['Slug'] || '',
                category: data.category || data['Tags'] || [],
                image: imageData,
                popular: data.popular || false,
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null
            };
            
            venues.push(venue);
            venueMap.set(normalizedName, venue); // Track by normalized name
        });
        
        // Sort venues by name
        venues.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`Admin Venues: Returning ${venues.length} venues (excluding test venues)`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(venues)
        };
        
    } catch (error) {
        console.error('Admin Venues: Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};

function extractImageUrl(data) {
    // Check for Cloudinary Public ID first (new format)
    const cloudinaryId = data.cloudinaryPublicId || data['Cloudinary Public ID'];
    if (cloudinaryId) {
        return {
            url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${cloudinaryId}`,
            alt: data.name || 'Venue image'
        };
    }
    
    // Check for image field (various formats)
    const image = data.image || data.venueImage || data.venue_image;
    if (image) {
        const imageUrl = typeof image === 'string' ? image : 
                        (image.url || image[0]?.url);
        if (imageUrl) {
            return {
                url: imageUrl,
                alt: data.name || 'Venue image'
            };
        }
    }
    
    // Return null if no image found (admin doesn't require images)
    return null;
} 