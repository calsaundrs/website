const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Getting venue list for event submission form');
    
    try {
        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            console.error('Missing environment variables:', missing);
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
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`
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
        
        // Get query parameters
        const queryParams = new URLSearchParams(event.queryStringParameters || '');
        const search = queryParams.get('search') || '';
        const limit = parseInt(queryParams.get('limit')) || 50;
        
        console.log(`Searching venues with query: "${search}", limit: ${limit}`);
        
        // Build query
        let query = db.collection('venues')
            .where('status', '==', 'approved')
            .orderBy('name', 'asc');
        
        // Apply search filter if provided
        if (search.trim()) {
            // For now, we'll filter client-side since Firestore doesn't support case-insensitive search
            // In production, you might want to use Algolia or similar for better search
            query = query.limit(100); // Get more results for client-side filtering
        } else {
            query = query.limit(limit);
        }
        
        const snapshot = await query.get();
        let venues = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Client-side search filtering
            if (search.trim()) {
                const searchLower = search.toLowerCase();
                const nameMatch = data.name && data.name.toLowerCase().includes(searchLower);
                const addressMatch = data.address && data.address.toLowerCase().includes(searchLower);
                
                if (!nameMatch && !addressMatch) {
                    return; // Skip this venue
                }
            }
            
            venues.push({
                id: doc.id,
                name: data.name || data['Name'] || 'Unnamed Venue',
                address: data.address || data['Address'] || '',
                postcode: data.postcode || data['Postcode'] || '',
                website: data.website || data['Website'] || '',
                slug: data.slug || '',
                imageUrl: data.imageUrl || data['Image URL'] || null,
                status: data.status || 'approved'
            });
        });
        
        // Sort by name for consistent results
        venues.sort((a, b) => a.name.localeCompare(b.name));
        
        // Apply limit after filtering
        if (search.trim()) {
            venues = venues.slice(0, limit);
        }
        
        console.log(`Returning ${venues.length} venues`);
        
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
                venues: venues,
                total: venues.length,
                search: search,
                limit: limit
            })
        };
        
    } catch (error) {
        console.error('Error getting venue list for events:', error);
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
                error: 'Failed to fetch venues',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};