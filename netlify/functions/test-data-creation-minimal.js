const Airtable = require('airtable');
const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Creating minimal test data...');
    
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
            events: { airtable: null, firestore: null },
            venues: { airtable: null, firestore: null }
        };
        
        // Create minimal test event in Airtable (only essential fields)
        try {
            console.log('Creating minimal test event in Airtable...');
            const testEventData = {
                'Event Name': 'Minimal Test Event',
                'Description': 'This is a minimal test event',
                'Date': new Date('2024-12-29T19:00:00').toISOString(),
                'Status': 'Approved',
                'Submitter Email': 'test@brumoutloud.co.uk'
                // Removed Category and Link to test minimal fields first
            };
            
            console.log('Event data to create:', testEventData);
            
            const airtableEvent = await base('Events').create([{ fields: testEventData }]);
            results.events.airtable = {
                id: airtableEvent[0].id,
                name: testEventData['Event Name'],
                status: 'created'
            };
            
            // Create corresponding Firestore event
            console.log('Creating minimal test event in Firestore...');
            const firestoreEventData = {
                airtableId: airtableEvent[0].id,
                name: testEventData['Event Name'],
                description: testEventData['Description'],
                date: testEventData['Date'],
                status: 'approved',
                submittedBy: testEventData['Submitter Email'],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const firestoreEvent = await db.collection('events').add(firestoreEventData);
            results.events.firestore = {
                id: firestoreEvent.id,
                name: firestoreEventData.name,
                status: 'created'
            };
            
        } catch (error) {
            console.error('Error creating minimal test event:', error);
            results.events.error = error.message;
        }
        
        // Create minimal test venue in Airtable (only essential fields)
        try {
            console.log('Creating minimal test venue in Airtable...');
            const testVenueData = {
                'Name': 'Minimal Test Venue',
                'Description': 'This is a minimal test venue',
                'Address': '123 Minimal Street, Birmingham',
                'Status': 'Approved',
                'Contact Email': 'test@brumoutloud.co.uk'
                // Removed Website to test minimal fields first
            };
            
            console.log('Venue data to create:', testVenueData);
            
            const airtableVenue = await base('Venues').create([{ fields: testVenueData }]);
            results.venues.airtable = {
                id: airtableVenue[0].id,
                name: testVenueData['Name'],
                status: 'created'
            };
            
            // Create corresponding Firestore venue
            console.log('Creating minimal test venue in Firestore...');
            const firestoreVenueData = {
                airtableId: airtableVenue[0].id,
                name: testVenueData['Name'],
                description: testVenueData['Description'],
                address: testVenueData['Address'],
                status: 'approved',
                contactEmail: testVenueData['Contact Email'],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const firestoreVenue = await db.collection('venues').add(firestoreVenueData);
            results.venues.firestore = {
                id: firestoreVenue.id,
                name: firestoreVenueData.name,
                status: 'created'
            };
            
        } catch (error) {
            console.error('Error creating minimal test venue:', error);
            results.venues.error = error.message;
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Minimal test data created successfully!',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Minimal test data creation failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Minimal test data creation failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};