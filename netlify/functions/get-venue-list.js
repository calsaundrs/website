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
                headers,
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }
        
        // Initialize Firebase
        const admin = require('firebase-admin');
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
        snapshot.forEach(doc => {
            const data = doc.data();
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
                image: data.image || data['Image'] || null,
                popular: data.popular || false
            });
        });
        
        // Sort venues by name
        venues.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log('Venue List: Returning venues successfully');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(venues)
        };

    } catch (error) {
        console.error('Venue List: Error:', error);
        console.error('Venue List: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch venues',
                details: error.message,
                stack: error.stack
            })
        };
    }
};
