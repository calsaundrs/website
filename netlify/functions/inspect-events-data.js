const admin = require('firebase-admin');

// Version: 2025-01-27-v1 - Inspect events data structure

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
    console.log("inspect-events-data function called");
    
    try {
        console.log("Inspecting events collection...");
        
        const eventsRef = db.collection('events');
        
        // Get all events (no filters) to see what's in the collection
        const snapshot = await eventsRef.limit(10).get();
        console.log(`Found ${snapshot.size} total events in collection`);
        
        const events = [];
        const statusCounts = {};
        const fieldAnalysis = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const eventInfo = {
                id: doc.id,
                name: data['Event Name'] || data.name || 'NO_NAME',
                status: data['Status'] || data.status || 'NO_STATUS',
                date: data['Date'] || data.date || 'NO_DATE',
                slug: data['Slug'] || data.slug || 'NO_SLUG',
                hasVenue: !!data['Venue Name'],
                hasVenueId: !!data.venueId,
                hasCategory: !!data.categories,
                fields: Object.keys(data)
            };
            
            events.push(eventInfo);
            
            // Count statuses
            const status = data['Status'] || data.status || 'NO_STATUS';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            // Analyze fields
            Object.keys(data).forEach(field => {
                fieldAnalysis[field] = (fieldAnalysis[field] || 0) + 1;
            });
        });
        
        // Test the specific query we're using
        console.log("Testing the exact query from get-events-firestore...");
        const approvedQuery = eventsRef.where('Status', '==', 'Approved');
        const approvedSnapshot = await approvedQuery.limit(5).get();
        console.log(`Approved events query returned ${approvedSnapshot.size} documents`);
        
        const approvedEvents = [];
        approvedSnapshot.forEach(doc => {
            const data = doc.data();
            approvedEvents.push({
                id: doc.id,
                name: data['Event Name'],
                status: data['Status'],
                date: data['Date'],
                venueName: data['Venue Name'],
                venueId: data.venueId,
                category: data.categories,
                slug: data['Slug'] || data.slug,
                slugValue: data['Slug'] || data.slug || 'NO_SLUG'
            });
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                message: 'Events data inspection complete',
                summary: {
                    totalEventsFound: snapshot.size,
                    approvedEventsFound: approvedSnapshot.size,
                    statusCounts: statusCounts,
                    fieldAnalysis: fieldAnalysis
                },
                sampleEvents: events,
                approvedEvents: approvedEvents,
                queryTest: {
                    query: 'Status == "Approved"',
                    result: `${approvedSnapshot.size} events found`
                }
            })
        };
        
    } catch (error) {
        console.error('Error in inspect-events-data:', error);
        console.error('Error stack:', error.stack);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: false,
                error: 'INSPECTION_FAILED',
                message: error.message,
                details: error.details || 'No additional details',
                code: error.code || 'UNKNOWN'
            })
        };
    }
};