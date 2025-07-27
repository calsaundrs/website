const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Testing complete Firestore-only admin workflow...');
    
    try {
        // Check environment variables (no Airtable needed)
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
            step1: { event: null, venue: null },
            step2: { event: null, venue: null },
            step3: { event: null, venue: null },
            summary: {}
        };
        
        // Step 1: Create test event and venue (pending status)
        console.log('Step 1: Creating test event and venue with pending status...');
        
        try {
            // Create test event in Firestore
            const firestoreEventData = {
                name: 'Firestore Admin Test Event',
                slug: 'firestore-admin-test-event-2025-01-20',
                description: 'This is a test event for Firestore-only admin workflow',
                date: new Date('2025-01-20T20:00:00').toISOString(),
                status: 'pending',
                venueName: 'Test Venue',
                category: ['Test', 'Admin', 'Firestore'],
                link: 'https://example.com/firestore-admin-test',
                submittedBy: 'test@brumoutloud.co.uk',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const firestoreEvent = await db.collection('events').add(firestoreEventData);
            
            results.step1.event = {
                firestoreId: firestoreEvent.id,
                name: firestoreEventData.name,
                status: 'pending'
            };
            
            // Create test venue in Firestore
            const firestoreVenueData = {
                name: 'Firestore Admin Test Venue',
                slug: 'firestore-admin-test-venue',
                description: 'This is a test venue for Firestore-only admin workflow',
                address: '123 Firestore Admin Street, Birmingham',
                status: 'pending',
                contactEmail: 'test@brumoutloud.co.uk',
                website: 'https://firestoreadminvenue.com',
                socialMedia: 'Instagram: @firestoreadmin',
                tags: ['Test', 'Admin', 'Firestore'],
                features: ['Test feature 1', 'Test feature 2'],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const firestoreVenue = await db.collection('venues').add(firestoreVenueData);
            
            results.step1.venue = {
                firestoreId: firestoreVenue.id,
                name: firestoreVenueData.name,
                status: 'pending'
            };
            
        } catch (error) {
            console.error('Error in Step 1:', error);
            results.step1.error = error.message;
        }
        
        // Step 2: Approve the event and venue using Firestore-only function
        console.log('Step 2: Approving event and venue...');
        
        try {
            // Approve event in Firestore
            await db.collection('events').doc(results.step1.event.firestoreId).update({
                status: 'approved',
                updatedAt: new Date()
            });
            
            results.step2.event = {
                firestoreId: results.step1.event.firestoreId,
                status: 'approved'
            };
            
            // Approve venue in Firestore
            await db.collection('venues').doc(results.step1.venue.firestoreId).update({
                status: 'approved',
                updatedAt: new Date()
            });
            
            results.step2.venue = {
                firestoreId: results.step1.venue.firestoreId,
                status: 'approved'
            };
            
        } catch (error) {
            console.error('Error in Step 2:', error);
            results.step2.error = error.message;
        }
        
        // Step 3: Verify data consistency
        console.log('Step 3: Verifying data consistency...');
        
        try {
            // Verify event consistency
            const firestoreEventRecord = await db.collection('events').doc(results.step1.event.firestoreId).get();
            
            results.step3.event = {
                firestoreStatus: firestoreEventRecord.data().status,
                statusMatch: firestoreEventRecord.data().status === 'approved',
                hasCategory: firestoreEventRecord.data().category && firestoreEventRecord.data().category.length > 0,
                categoryCount: firestoreEventRecord.data().category ? firestoreEventRecord.data().category.length : 0
            };
            
            // Verify venue consistency
            const firestoreVenueRecord = await db.collection('venues').doc(results.step1.venue.firestoreId).get();
            
            results.step3.venue = {
                firestoreStatus: firestoreVenueRecord.data().status,
                statusMatch: firestoreVenueRecord.data().status === 'approved',
                hasSocialMedia: !!firestoreVenueRecord.data().socialMedia,
                hasTags: firestoreVenueRecord.data().tags && firestoreVenueRecord.data().tags.length > 0,
                tagCount: firestoreVenueRecord.data().tags ? firestoreVenueRecord.data().tags.length : 0
            };
            
        } catch (error) {
            console.error('Error in Step 3:', error);
            results.step3.error = error.message;
        }
        
        // Generate summary
        results.summary = {
            creationSuccess: !results.step1.error,
            approvalSuccess: !results.step2.error,
            verificationSuccess: !results.step3.error,
            eventStatusConsistent: results.step3.event?.statusMatch || false,
            venueStatusConsistent: results.step3.venue?.statusMatch || false,
            eventHasCategory: results.step3.event?.hasCategory || false,
            eventCategoryCount: results.step3.event?.categoryCount || 0,
            venueHasSocialMedia: results.step3.venue?.hasSocialMedia || false,
            venueHasTags: results.step3.venue?.hasTags || false,
            venueTagCount: results.step3.venue?.tagCount || 0,
            firestoreOnly: true
        };
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Complete Firestore-only admin workflow test finished!',
                results: results,
                summary: results.summary
            })
        };
        
    } catch (error) {
        console.error('Complete Firestore-only admin workflow test failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Complete Firestore-only admin workflow test failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};