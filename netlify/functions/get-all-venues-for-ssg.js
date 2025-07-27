const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Get all venues for SSG function called');
    
    try {
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
                headers: { 'Content-Type': 'application/json' },
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
        
        console.log('Firebase initialized successfully');
        
        // Get all venues from Firestore
        console.log('Fetching all venues from database...');
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.get();
        
        console.log(`Found ${snapshot.size} venues in database`);
        
        const venues = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const venue = {
                id: doc.id,
                name: data.name || data['Name'] || 'Untitled Venue',
                slug: data.slug || data['Slug'] || generateSlug(data.name || data['Name'] || 'venue'),
                description: data.description || data['Description'] || '',
                address: data.address || data['Address'] || '',
                status: data.status || 'pending',
                image: data.image || data['Image'] || null,
                website: data.website || data['Website'] || '',
                contactPhone: data.contactPhone || data['Contact Phone'] || '',
                openingHours: data.openingHours || data['Opening Hours'] || '',
                accessibility: data.accessibility || data['Accessibility'] || '',
                features: data.features || data['Features'] || [],
                socialMedia: data.socialMedia || data['Social Media'] || {},
                tags: data.tags || data['Tags'] || []
            };
            
            venues.push(venue);
            console.log(`Processing venue: ${venue.name} (${venue.slug})`);
        });
        
        // Generate slug function
        function generateSlug(name) {
            return (name || 'venue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }
        
        console.log(`Successfully processed ${venues.length} venues for SSG`);
        
        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            },
            body: JSON.stringify({
                success: true,
                message: 'Venues data ready for SSG',
                totalVenues: venues.length,
                venues: venues,
                generatedAt: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Get all venues for SSG failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Get all venues for SSG failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};