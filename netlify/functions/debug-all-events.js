const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Debug all events function called');
    
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
        
        // Get ALL events (no filters)
        console.log('Fetching ALL events from database...');
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.get();
        
        console.log(`Total events in database: ${snapshot.size}`);
        
        const allEvents = [];
        const statusCounts = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'unknown';
            
            // Count by status
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            allEvents.push({
                id: doc.id,
                name: data.name || data['Event Name'] || 'Untitled Event',
                status: status,
                date: data.date || data['Date'] || null,
                venueName: data.venueName || data['Venue Name'] || '',
                submittedBy: data.submittedBy || data['Submitter Email'] || '',
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null,
                // Include raw data for debugging
                rawData: {
                    name: data.name,
                    'Event Name': data['Event Name'],
                    status: data.status,
                    'Status': data['Status'],
                    date: data.date,
                    'Date': data['Date']
                }
            });
        });
        
        console.log('Status counts:', statusCounts);
        
        // Test the approved events query specifically
        console.log('Testing approved events query...');
        const approvedQuery = eventsRef.where('status', '==', 'approved');
        const approvedSnapshot = await approvedQuery.get();
        console.log(`Approved events: ${approvedSnapshot.size}`);
        
        // Test the pending events query
        console.log('Testing pending events query...');
        const pendingQuery = eventsRef.where('status', '==', 'pending');
        const pendingSnapshot = await pendingQuery.get();
        console.log(`Pending events: ${pendingSnapshot.size}`);
        
        // Test case-insensitive queries
        console.log('Testing case-insensitive queries...');
        const approvedUpperQuery = eventsRef.where('status', '==', 'Approved');
        const approvedUpperSnapshot = await approvedUpperQuery.get();
        console.log(`Events with status "Approved": ${approvedUpperSnapshot.size}`);
        
        const pendingUpperQuery = eventsRef.where('status', '==', 'Pending');
        const pendingUpperSnapshot = await pendingUpperQuery.get();
        console.log(`Events with status "Pending": ${pendingUpperSnapshot.size}`);
        
        // Check for any remaining Status fields
        let eventsWithUpperStatus = 0;
        let eventsWithBothFields = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data['Status']) {
                eventsWithUpperStatus++;
                if (data.status) {
                    eventsWithBothFields++;
                }
            }
        });
        
        console.log(`Events with uppercase Status field: ${eventsWithUpperStatus}`);
        console.log(`Events with both status and Status fields: ${eventsWithBothFields}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'All events debug completed',
                totalEvents: snapshot.size,
                statusCounts: statusCounts,
                approvedEvents: approvedSnapshot.size,
                pendingEvents: pendingSnapshot.size,
                approvedUpperEvents: approvedUpperSnapshot.size,
                pendingUpperEvents: pendingUpperSnapshot.size,
                eventsWithUpperStatus: eventsWithUpperStatus,
                eventsWithBothFields: eventsWithBothFields,
                allEvents: allEvents.slice(0, 20), // Show first 20 for debugging
                sampleEvents: allEvents.slice(0, 5) // Show first 5 with full details
            })
        };
        
    } catch (error) {
        console.error('Debug all events failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Debug all events failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};