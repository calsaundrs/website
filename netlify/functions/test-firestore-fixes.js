const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Testing Firestore field name fixes...');
    
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
        
        const results = {
            events: { success: false, count: 0, error: null },
            venues: { success: false, count: 0, error: null },
            pendingEvents: { success: false, count: 0, error: null },
            pendingVenues: { success: false, count: 0, error: null }
        };
        
        // Test 1: Get approved events
        try {
            console.log('Testing approved events query...');
            const eventsSnapshot = await db.collection('events')
                .where('status', '==', 'approved')
                .limit(5)
                .get();
            
            results.events.success = true;
            results.events.count = eventsSnapshot.size;
            console.log(`Found ${eventsSnapshot.size} approved events`);
            
            // Log first event structure
            if (eventsSnapshot.size > 0) {
                const firstEvent = eventsSnapshot.docs[0].data();
                console.log('First event structure:', Object.keys(firstEvent));
                console.log('First event status:', firstEvent.status);
            }
            
        } catch (error) {
            results.events.error = error.message;
            console.error('Events query failed:', error);
        }
        
        // Test 2: Get venues
        try {
            console.log('Testing venues query...');
            const venuesSnapshot = await db.collection('venues')
                .limit(5)
                .get();
            
            results.venues.success = true;
            results.venues.count = venuesSnapshot.size;
            console.log(`Found ${venuesSnapshot.size} venues`);
            
            // Log first venue structure
            if (venuesSnapshot.size > 0) {
                const firstVenue = venuesSnapshot.docs[0].data();
                console.log('First venue structure:', Object.keys(firstVenue));
                console.log('First venue status:', firstVenue.status);
            }
            
        } catch (error) {
            results.venues.error = error.message;
            console.error('Venues query failed:', error);
        }
        
        // Test 3: Get pending events
        try {
            console.log('Testing pending events query...');
            const pendingEventsSnapshot = await db.collection('events')
                .where('status', '==', 'pending')
                .limit(5)
                .get();
            
            results.pendingEvents.success = true;
            results.pendingEvents.count = pendingEventsSnapshot.size;
            console.log(`Found ${pendingEventsSnapshot.size} pending events`);
            
        } catch (error) {
            results.pendingEvents.error = error.message;
            console.error('Pending events query failed:', error);
        }
        
        // Test 4: Get pending venues
        try {
            console.log('Testing pending venues query...');
            const pendingVenuesSnapshot = await db.collection('venues')
                .where('status', '==', 'pending')
                .limit(5)
                .get();
            
            results.pendingVenues.success = true;
            results.pendingVenues.count = pendingVenuesSnapshot.size;
            console.log(`Found ${pendingVenuesSnapshot.size} pending venues`);
            
        } catch (error) {
            results.pendingVenues.error = error.message;
            console.error('Pending venues query failed:', error);
        }
        
        // Calculate overall success
        const totalTests = Object.keys(results).length;
        const successfulTests = Object.values(results).filter(r => r.success).length;
        const successRate = ((successfulTests / totalTests) * 100).toFixed(1);
        
        console.log(`\n📊 Test Results:`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Successful: ${successfulTests} (${successRate}%)`);
        console.log(`   Failed: ${totalTests - successfulTests}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Firestore field name fixes test completed',
                results: results,
                summary: {
                    totalTests,
                    successfulTests,
                    failedTests: totalTests - successfulTests,
                    successRate: `${successRate}%`
                }
            })
        };
        
    } catch (error) {
        console.error('Test function failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Test function failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};