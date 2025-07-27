const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Test get-events debug function called');
    
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
        
        // Test basic query
        try {
            console.log('Testing basic events query...');
            const eventsRef = db.collection('events');
            const snapshot = await eventsRef.limit(5).get();
            
            console.log(`Query successful, found ${snapshot.size} events`);
            
            const events = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                events.push({
                    id: doc.id,
                    name: data.name || data['Event Name'] || 'Unknown',
                    status: data.status || data['Status'] || 'unknown',
                    date: data.date || data['Date'] || null
                });
            });
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Events query successful',
                    eventCount: snapshot.size,
                    events: events,
                    environment: {
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
                        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
                    }
                })
            };
            
        } catch (queryError) {
            console.error('Query failed:', queryError);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Query failed',
                    message: queryError.message,
                    type: queryError.constructor.name,
                    stack: queryError.stack
                })
            };
        }
        
    } catch (error) {
        console.error('Test function failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Test function failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};