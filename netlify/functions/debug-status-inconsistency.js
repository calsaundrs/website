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
        
        const statusCounts = {};
        const analysis = {
            bothFields: 0,
            onlyLowercase: 0,
            onlyUppercase: 0,
            noStatus: 0,
            inconsistentValues: 0
        };
        
        const sampleBothFields = [];
        const sampleInconsistentValues = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const lowerStatus = data.status;
            const upperStatus = data['Status'];
            
            // Count statuses (use lowercase if available)
            const status = lowerStatus || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            // Analyze field presence
            if (lowerStatus && upperStatus) {
                analysis.bothFields++;
                sampleBothFields.push({
                    id: doc.id,
                    name: data.name || data['Event Name'] || 'Untitled Event',
                    lowerStatus: lowerStatus,
                    upperStatus: upperStatus
                });
                
                // Check if values are inconsistent
                if (lowerStatus.toLowerCase() !== upperStatus.toLowerCase()) {
                    analysis.inconsistentValues++;
                    sampleInconsistentValues.push({
                        id: doc.id,
                        name: data.name || data['Event Name'] || 'Untitled Event',
                        lowerStatus: lowerStatus,
                        upperStatus: upperStatus
                    });
                }
            } else if (lowerStatus && !upperStatus) {
                analysis.onlyLowercase++;
            } else if (!lowerStatus && upperStatus) {
                analysis.onlyUppercase++;
            } else {
                analysis.noStatus++;
            }
        });
        
        console.log('Status counts:', statusCounts);
        console.log('Field analysis:', analysis);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Status inconsistency analysis completed',
                totalEvents: snapshot.size,
                statusCounts: statusCounts,
                analysis: analysis,
                sampleBothFields: sampleBothFields.slice(0, 10),
                sampleInconsistentValues: sampleInconsistentValues.slice(0, 10)
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