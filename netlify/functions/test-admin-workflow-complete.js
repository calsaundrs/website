const Airtable = require('airtable');
const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Testing complete admin workflow...');
    
    try {
        // Check environment variables
        const required = [
            'AIRTABLE_PERSONAL_ACCESS_TOKEN',
            'AIRTABLE_BASE_ID',
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
        
        // Initialize services
        const base = new Airtable({ 
            apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
        }).base(process.env.AIRTABLE_BASE_ID);
        
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
            // Create test event
            const eventData = {
                'Event Name': 'Admin Workflow Test Event',
                'Date': new Date('2025-01-15T20:00:00').toISOString(),
                'Description': 'This is a test event for admin workflow',
                'Link': 'https://example.com/admin-test',
                'Status': 'Pending Review',
                'Submitter Email': 'test@brumoutloud.co.uk',
                'Slug': 'admin-workflow-test-event-2025-01-15'
            };
            
            const airtableEvent = await base('Events').create([{ fields: eventData }]);
            
            const firestoreEventData = {
                airtableId: airtableEvent[0].id,
                name: eventData['Event Name'],
                slug: eventData['Slug'],
                description: eventData['Description'],
                date: eventData['Date'],
                status: 'pending',
                category: ['Test', 'Admin'],
                link: eventData['Link'],
                submittedBy: eventData['Submitter Email'],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const firestoreEvent = await db.collection('events').add(firestoreEventData);
            
            results.step1.event = {
                airtableId: airtableEvent[0].id,
                firestoreId: firestoreEvent.id,
                name: eventData['Event Name'],
                status: 'pending'
            };
            
            // Create test venue
            const venueData = {
                'Name': 'Admin Workflow Test Venue',
                'Description': 'This is a test venue for admin workflow',
                'Address': '123 Admin Street, Birmingham',
                'Status': 'Pending Review',
                'Contact Email': 'test@brumoutloud.co.uk',
                'Website': 'https://adminworkflowvenue.com'
            };
            
            const airtableVenue = await base('Venues').create([{ fields: venueData }]);
            
            const firestoreVenueData = {
                airtableId: airtableVenue[0].id,
                name: venueData['Name'],
                description: venueData['Description'],
                address: venueData['Address'],
                status: 'pending',
                contactEmail: venueData['Contact Email'],
                website: venueData['Website'],
                socialMedia: 'Instagram: @adminworkflow',
                tags: ['Test', 'Admin', 'Workflow'],
                features: ['Test feature 1', 'Test feature 2'],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const firestoreVenue = await db.collection('venues').add(firestoreVenueData);
            
            results.step1.venue = {
                airtableId: airtableVenue[0].id,
                firestoreId: firestoreVenue.id,
                name: venueData['Name'],
                status: 'pending'
            };
            
        } catch (error) {
            console.error('Error in Step 1:', error);
            results.step1.error = error.message;
        }
        
        // Step 2: Approve the event and venue
        console.log('Step 2: Approving event and venue...');
        
        try {
            // Approve event in Airtable
            await base('Events').update([{
                id: results.step1.event.airtableId,
                fields: { 'Status': 'Approved' }
            }]);
            
            // Approve event in Firestore
            await db.collection('events').doc(results.step1.event.firestoreId).update({
                status: 'approved',
                updatedAt: new Date()
            });
            
            results.step2.event = {
                airtableId: results.step1.event.airtableId,
                firestoreId: results.step1.event.firestoreId,
                status: 'approved'
            };
            
            // Approve venue in Airtable
            await base('Venues').update([{
                id: results.step1.venue.airtableId,
                fields: { 'Status': 'Approved' }
            }]);
            
            // Approve venue in Firestore
            await db.collection('venues').doc(results.step1.venue.firestoreId).update({
                status: 'approved',
                updatedAt: new Date()
            });
            
            results.step2.venue = {
                airtableId: results.step1.venue.airtableId,
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
            const airtableEventRecord = await base('Events').find(results.step1.event.airtableId);
            const firestoreEventRecord = await db.collection('events').doc(results.step1.event.firestoreId).get();
            
            results.step3.event = {
                airtableStatus: airtableEventRecord.fields['Status'],
                firestoreStatus: firestoreEventRecord.data().status,
                statusMatch: airtableEventRecord.fields['Status'] === 'Approved' && firestoreEventRecord.data().status === 'approved',
                hasCategory: firestoreEventRecord.data().category && firestoreEventRecord.data().category.length > 0
            };
            
            // Verify venue consistency
            const airtableVenueRecord = await base('Venues').find(results.step1.venue.airtableId);
            const firestoreVenueRecord = await db.collection('venues').doc(results.step1.venue.firestoreId).get();
            
            results.step3.venue = {
                airtableStatus: airtableVenueRecord.fields['Status'],
                firestoreStatus: firestoreVenueRecord.data().status,
                statusMatch: airtableVenueRecord.fields['Status'] === 'Approved' && firestoreVenueRecord.data().status === 'approved',
                hasSocialMedia: !!firestoreVenueRecord.data().socialMedia,
                hasTags: firestoreVenueRecord.data().tags && firestoreVenueRecord.data().tags.length > 0
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
            venueHasSocialMedia: results.step3.venue?.hasSocialMedia || false
        };
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Complete admin workflow test finished!',
                results: results,
                summary: results.summary
            })
        };
        
    } catch (error) {
        console.error('Complete admin workflow test failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Complete admin workflow test failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};