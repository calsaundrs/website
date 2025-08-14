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
        console.log('Venue List: Starting function');
        
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
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
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
        console.log('Venue List: Fetching venues from Firestore');
        const snapshot = await venuesRef.get();
        console.log(`Venue List: Found ${snapshot.size} venues`);
        
        const venues = [];
        console.log('Venue List: Processing venues...');
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Venue List: Processing venue ${doc.id}: ${data.name || data['Name'] || 'Unnamed'}`);
            
            // Extract image data
            const imageData = extractImageUrl(data);
            console.log(`Venue List: Image data for ${data.name || data['Name'] || 'Unnamed'}:`, imageData);
            
            // Include all venues, with or without images
            venues.push({
                id: doc.id,
                name: data.name || data['Name'] || 'Unnamed Venue',
                address: data.address || data['Address'] || '',
                description: data.description || data['Description'] || '',
                website: data.website || data['Website'] || '',
                phone: data.contactPhone || data['Contact Phone'] || data.phone || '',
                status: data.status || 'pending',
                slug: data.slug || data['Slug'] || '',
                category: data.category || data['Tags'] || [],
                image: imageData || null,
                popular: data.popular || false
            });
        });
        
        // Filter out test venues and handle duplicates intelligently
        const filteredVenues = [];
        const venueGroups = new Map(); // Group venues by similar names
        
        venues.forEach(venue => {
            // Skip test venues
            if (venue.name.toLowerCase().includes('test') || 
                venue.name.toLowerCase().includes('untitled') ||
                venue.name.toLowerCase().includes('minimal') ||
                venue.name.toLowerCase().includes('enhanced') ||
                venue.name.toLowerCase().includes('comprehensive') ||
                venue.name.toLowerCase().includes('unified') ||
                venue.name.toLowerCase().includes('fixed') ||
                venue.name.toLowerCase().includes('link-only') ||
                venue.name.toLowerCase().includes('admin workflow')) {
                console.log(`Venue List: Skipping test venue: ${venue.name}`);
                return;
            }
            
            // Create a normalized name for grouping (remove "The" prefix and common variations)
            let normalizedName = venue.name.toLowerCase()
                .replace(/^the\s+/, '') // Remove "The" prefix
                .replace(/\s+club$/, '') // Remove "Club" suffix
                .replace(/\s+complex$/, '') // Remove "Complex" suffix
                .replace(/\s+bar$/, '') // Remove "Bar" suffix
                .replace(/\s+pub$/, '') // Remove "Pub" suffix
                .replace(/\s+inn$/, '') // Remove "Inn" suffix
                .trim();
            
            // Special cases for known venue groups
            if (normalizedName.includes('nightingale')) {
                normalizedName = 'nightingale';
            }
            if (normalizedName.includes('glee')) {
                normalizedName = 'glee';
            }
            if (normalizedName.includes('mac') || normalizedName.includes('midlands art')) {
                normalizedName = 'mac';
            }
            
            // Group venues by normalized name
            if (!venueGroups.has(normalizedName)) {
                venueGroups.set(normalizedName, []);
            }
            venueGroups.get(normalizedName).push(venue);
        });
        
        // For each group, select the best venue
        venueGroups.forEach((venueGroup, normalizedName) => {
            if (venueGroup.length === 1) {
                // Only one venue in group, keep it
                filteredVenues.push(venueGroup[0]);
            } else {
                // Multiple venues in group, select the best one
                console.log(`Venue List: Multiple venues for "${normalizedName}":`, venueGroup.map(v => v.name));
                
                // Priority order: venues with images > venues with complete profiles > approved status > first alphabetically
                const sortedVenues = venueGroup.sort((a, b) => {
                    // First priority: venues with images
                    const aHasImage = a.image && a.image.url;
                    const bHasImage = b.image && b.image.url;
                    if (aHasImage && !bHasImage) return -1;
                    if (!aHasImage && bHasImage) return 1;
                    
                    // Second priority: venues with more complete profiles (address, description, website)
                    const aCompleteness = (a.address && a.address !== 'Address to be added' ? 1 : 0) + 
                                        (a.description && a.description.trim() !== '' ? 1 : 0) + 
                                        (a.website && a.website.trim() !== '' ? 1 : 0);
                    const bCompleteness = (b.address && b.address !== 'Address to be added' ? 1 : 0) + 
                                        (b.description && b.description.trim() !== '' ? 1 : 0) + 
                                        (b.website && b.website.trim() !== '' ? 1 : 0);
                    if (aCompleteness !== bCompleteness) return bCompleteness - aCompleteness;
                    
                    // Third priority: approved status
                    if (a.status === 'approved' && b.status !== 'approved') return -1;
                    if (a.status !== 'approved' && b.status === 'approved') return 1;
                    
                    // Fourth priority: alphabetical order
                    return a.name.localeCompare(b.name);
                });
                
                const selectedVenue = sortedVenues[0];
                console.log(`Venue List: Selected "${selectedVenue.name}" for group "${normalizedName}"`);
                filteredVenues.push(selectedVenue);
            }
        });
        
        // Sort venues by name
        filteredVenues.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`Venue List: Returning ${filteredVenues.length} filtered venues successfully`);
        console.log('Venues with images:', filteredVenues.filter(v => v.image).map(v => v.name));
        console.log('Venues without images:', filteredVenues.filter(v => !v.image).map(v => v.name));
        
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filteredVenues)
        };

    } catch (error) {
        console.error('Venue List: Error:', error);
        console.error('Venue List: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: 'Failed to fetch venues',
                details: error.message,
                stack: error.stack
            })
        };
    }
};

function extractImageUrl(data) {
    // Extract Cloudinary image object from various possible formats
    // Check for object formats with URL properties
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
