const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log("get-events-firestore-simple function called");
    console.log("Query parameters:", event.queryStringParameters);
    
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
        
        const queryParams = event.queryStringParameters || {};
        const view = queryParams.view || 'public';
        
        console.log("View:", view);
        
        // Handle different views
        if (view === 'venues') {
            return await handleVenuesView(db);
        } else if (view === 'admin') {
            return await handleAdminView(db, queryParams);
        } else {
            return await handlePublicView(db, queryParams);
        }
        
    } catch (error) {
        console.error('Error in get-events-firestore-simple:', error);
        console.error('Error stack:', error.stack);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                details: error.details || 'No additional details available',
                code: error.code || 'UNKNOWN'
            })
        };
    }
};

async function handlePublicView(db, queryParams) {
    const filters = {
        status: 'approved',
        limit: parseInt(queryParams.limit) || 50,
        offset: parseInt(queryParams.offset) || 0
    };

    console.log("Public view filters:", filters);

    try {
        const eventsRef = db.collection('events');
        let query = eventsRef.where('status', '==', 'approved');

        // Apply pagination
        query = query.limit(filters.limit).offset(filters.offset);

        console.log("Executing Firestore query...");
        const snapshot = await query.get();
        console.log(`Query returned ${snapshot.size} documents`);
        
        const events = [];
        
        snapshot.forEach(doc => {
            const rawData = doc.data();
            
            // Process event data for public view
            const eventData = {
                id: doc.id,
                name: rawData.name || rawData['Event Name'] || 'Untitled Event',
                description: rawData.description || rawData['Description'] || '',
                date: rawData.date || rawData['Date'] || null,
                status: rawData.status || 'pending',
                slug: rawData.slug || rawData['Slug'] || '',
                category: rawData.category || rawData['categories'] || [],
                venueName: rawData.venueName || rawData['Venue Name'] || '',
                link: rawData.link || rawData['Link'] || '',
                recurringInfo: rawData.recurringInfo || rawData['Recurring Info'] || '',
                image: extractImageUrl(rawData)
            };
            
            events.push(eventData);
        });
        
        console.log(`Processed ${events.length} events for public view`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
            },
            body: JSON.stringify({
                success: true,
                events: events,
                total: events.length,
                limit: filters.limit,
                offset: filters.offset
            })
        };
        
    } catch (error) {
        console.error('Error in handlePublicView:', error);
        throw error;
    }
}

async function handleAdminView(db, queryParams) {
    const filters = {
        limit: parseInt(queryParams.limit) || 50,
        offset: parseInt(queryParams.offset) || 0
    };

    console.log("Admin view filters:", filters);

    try {
        const eventsRef = db.collection('events');
        let query = eventsRef;

        // Apply pagination
        query = query.limit(filters.limit).offset(filters.offset);

        console.log("Executing admin Firestore query...");
        const snapshot = await query.get();
        console.log(`Admin query returned ${snapshot.size} documents`);
        
        const events = [];
        
        snapshot.forEach(doc => {
            const rawData = doc.data();
            
            // Process event data for admin view
            const eventData = {
                id: doc.id,
                name: rawData.name || rawData['Event Name'] || 'Untitled Event',
                description: rawData.description || rawData['Description'] || '',
                date: rawData.date || rawData['Date'] || null,
                status: rawData.status || 'pending',
                slug: rawData.slug || rawData['Slug'] || '',
                category: rawData.category || rawData['categories'] || [],
                venueName: rawData.venueName || rawData['Venue Name'] || '',
                link: rawData.link || rawData['Link'] || '',
                recurringInfo: rawData.recurringInfo || rawData['Recurring Info'] || '',
                submittedBy: rawData.submittedBy || rawData['Submitter Email'] || '',
                createdAt: rawData.createdAt || null,
                updatedAt: rawData.updatedAt || null,
                image: extractImageUrl(rawData)
            };
            
            events.push(eventData);
        });
        
        console.log(`Processed ${events.length} events for admin view`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                events: events,
                total: events.length,
                limit: filters.limit,
                offset: filters.offset
            })
        };
        
    } catch (error) {
        console.error('Error in handleAdminView:', error);
        throw error;
    }
}

async function handleVenuesView(db) {
    console.log("Handling venues view");

    try {
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.limit(50).get();
        console.log(`Venues query returned ${snapshot.size} documents`);
        
        const venues = [];
        
        snapshot.forEach(doc => {
            const rawData = doc.data();
            
            // Process venue data for public view
            const venueData = {
                id: doc.id,
                name: rawData.name || rawData['Name'] || 'Untitled Venue',
                description: rawData.description || rawData['Description'] || '',
                address: rawData.address || rawData['Address'] || '',
                status: rawData.status || 'pending',
                slug: rawData.slug || rawData['Slug'] || '',
                category: rawData.category || rawData['Tags'] || [],
                website: rawData.website || rawData['Website'] || '',
                contactPhone: rawData.contactPhone || rawData['Contact Phone'] || '',
                openingHours: rawData.openingHours || rawData['Opening Hours'] || '',
                image: extractImageUrl(rawData)
            };
            
            venues.push(venueData);
        });
        
        console.log(`Processed ${venues.length} venues for public view`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
            },
            body: JSON.stringify({
                success: true,
                venues: venues,
                total: venues.length
            })
        };
        
    } catch (error) {
        console.error('Error in handleVenuesView:', error);
        throw error;
    }
}

function extractImageUrl(data) {
    // Extract image URL from various possible formats
    if (data.promoImage && data.promoImage.url) {
        return data.promoImage.url;
    }
    if (data.image && data.image.url) {
        return data.image.url;
    }
    if (data['Promo Image'] && data['Promo Image'].url) {
        return data['Promo Image'].url;
    }
    if (data['Image'] && data['Image'].url) {
        return data['Image'].url;
    }
    if (typeof data.promoImage === 'string') {
        return data.promoImage;
    }
    if (typeof data.image === 'string') {
        return data.image;
    }
    return null;
}