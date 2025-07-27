const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Debug unknown events function called');
    
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
        
        // Get all events from Firestore
        console.log('Fetching all events from database...');
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.get();
        
        console.log(`Found ${snapshot.size} events in database`);
        
        const unknownEvents = [];
        const statusValues = {};
        const fieldAnalysis = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'unknown';
            
            // Count all status values
            statusValues[status] = (statusValues[status] || 0) + 1;
            
            // Analyze events with "unknown" status
            if (status === 'unknown') {
                const eventInfo = {
                    id: doc.id,
                    name: data.name || data['Event Name'] || 'Untitled Event',
                    status: status,
                    hasStatusField: 'status' in data,
                    hasStatusFieldUpper: 'Status' in data,
                    statusValue: data.status,
                    statusValueUpper: data['Status'],
                    allFields: Object.keys(data),
                    rawStatus: data.status,
                    rawStatusUpper: data['Status']
                };
                
                unknownEvents.push(eventInfo);
                
                // Analyze field names
                Object.keys(data).forEach(field => {
                    fieldAnalysis[field] = (fieldAnalysis[field] || 0) + 1;
                });
            }
        });
        
        console.log('Status values found:', statusValues);
        console.log('Unknown events found:', unknownEvents.length);
        console.log('Field analysis:', fieldAnalysis);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Unknown events debug completed',
                totalEvents: snapshot.size,
                unknownEventsCount: unknownEvents.length,
                statusValues: statusValues,
                fieldAnalysis: fieldAnalysis,
                unknownEvents: unknownEvents.slice(0, 20), // Show first 20 for debugging
                sampleUnknownEvent: unknownEvents.length > 0 ? unknownEvents[0] : null
            })
        };
        
    } catch (error) {
        console.error('Debug unknown events failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Debug unknown events failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};