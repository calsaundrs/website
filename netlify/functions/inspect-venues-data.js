const admin = require('firebase-admin');

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
    console.log("inspect-venues-data function called");
    
    try {
        // Check if venues collection exists
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.limit(10).get();
        
        console.log(`Found ${snapshot.size} venues in collection`);
        
        const venues = [];
        const fieldAnalysis = {};
        const statusCounts = {};
        let approvedVenuesFound = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            venues.push({
                id: doc.id,
                fields: Object.keys(data),
                data: data
            });
            
            // Analyze fields
            Object.keys(data).forEach(field => {
                fieldAnalysis[field] = (fieldAnalysis[field] || 0) + 1;
            });
            
            // Check status
            const status = data.Status || data.status || 'NO_STATUS';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            if (status === 'Approved' || status === 'approved') {
                approvedVenuesFound++;
            }
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                message: "Venues data inspection complete",
                summary: {
                    totalVenuesFound: snapshot.size,
                    approvedVenuesFound: approvedVenuesFound,
                    statusCounts: statusCounts,
                    fieldAnalysis: fieldAnalysis
                },
                sampleVenues: venues.slice(0, 3).map(venue => ({
                    id: venue.id,
                    fields: venue.fields,
                    status: venue.data.Status || venue.data.status || 'NO_STATUS',
                    name: venue.data['Venue Name'] || venue.data.name || 'NO_NAME',
                    slug: venue.data.Slug || venue.data.slug || 'NO_SLUG'
                }))
            })
        };
        
    } catch (error) {
        console.error('Error inspecting venues data:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    }
};