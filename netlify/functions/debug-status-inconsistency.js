const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Debug status inconsistency function called');
    
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
        
        const statusAnalysis = {
            bothFields: [],
            onlyLowercase: [],
            onlyUppercase: [],
            noStatus: [],
            inconsistentValues: []
        };
        
        const statusCounts = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const lowerStatus = data.status;
            const upperStatus = data['Status'];
            
            // Count statuses
            const status = lowerStatus || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            const eventInfo = {
                id: doc.id,
                name: data.name || data['Event Name'] || 'Untitled Event',
                lowerStatus: lowerStatus,
                upperStatus: upperStatus,
                hasLower: !!lowerStatus,
                hasUpper: !!upperStatus
            };
            
            // Categorize the event
            if (lowerStatus && upperStatus) {
                statusAnalysis.bothFields.push(eventInfo);
                if (lowerStatus.toLowerCase() !== upperStatus.toLowerCase()) {
                    statusAnalysis.inconsistentValues.push(eventInfo);
                }
            } else if (lowerStatus && !upperStatus) {
                statusAnalysis.onlyLowercase.push(eventInfo);
            } else if (!lowerStatus && upperStatus) {
                statusAnalysis.onlyUppercase.push(eventInfo);
            } else {
                statusAnalysis.noStatus.push(eventInfo);
            }
        });
        
        console.log('Status analysis completed');
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Status inconsistency analysis completed',
                totalEvents: snapshot.size,
                statusCounts: statusCounts,
                analysis: {
                    bothFields: statusAnalysis.bothFields.length,
                    onlyLowercase: statusAnalysis.onlyLowercase.length,
                    onlyUppercase: statusAnalysis.onlyUppercase.length,
                    noStatus: statusAnalysis.noStatus.length,
                    inconsistentValues: statusAnalysis.inconsistentValues.length
                },
                sampleBothFields: statusAnalysis.bothFields.slice(0, 5),
                sampleOnlyLowercase: statusAnalysis.onlyLowercase.slice(0, 5),
                sampleOnlyUppercase: statusAnalysis.onlyUppercase.slice(0, 5),
                sampleNoStatus: statusAnalysis.noStatus.slice(0, 5),
                sampleInconsistentValues: statusAnalysis.inconsistentValues.slice(0, 5)
            })
        };
        
    } catch (error) {
        console.error('Debug status inconsistency failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Debug status inconsistency failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};