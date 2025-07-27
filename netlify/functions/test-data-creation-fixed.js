const Airtable = require('airtable');
const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Creating fixed test data...');
    
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
        
        // Create test event in Airtable (using only working fields)
        try {
            console.log('Creating test event in Airtable...');
            const testEventData = {
                'Event Name': 'Fixed Test Event - Data Migration',
                'Description': 'This is a test event created by the fixed data migration system',
                'Date': new Date('2024-12-29T19:00:00').toISOString(),
                'Status': 'Approved',
                'Link': 'https://example.com',
                'Submitter Email': 'test@brumoutloud.co.uk',
                'Category': ['Test', 'Migration']
            };
            
            const airtableEvent = await base('Events').create([{ fields: testEventData }]);
            results.events.airtable = {
                id: airtableEvent[0].id,
                name: testEventData['Event Name'],
                status: 'created'
            };
            
            // Create corresponding Firestore event
            console.log('Creating test event in Firestore...');
            const firestoreEventData = {
                airtableId: airtableEvent[0].id,
                name: testEventData['Event Name'],
                description: testEventData['Description'],
                date: testEventData['Date'],
                status: 'approved',
                category: testEventData['Category'],
                link: testEventData['Link'],
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
            console.error('Error creating test event:', error);
            results.events.error = error.message;
        }
        
        // Create test venue in Airtable (using only working fields)
        try {
            console.log('Creating test venue in Airtable...');
            const testVenueData = {
                'Name': 'Fixed Test Venue - Data Migration',
                'Description': 'This is a test venue created by the fixed data migration system',
                'Address': '123 Fixed Test Street, Birmingham',
                'Status': 'Approved',
                'Contact Email': 'test@brumoutloud.co.uk',
                'Website': 'https://fixedtestvenue.com'
            };
            
            const airtableVenue = await base('Venues').create([{ fields: testVenueData }]);
            results.venues.airtable = {
                id: airtableVenue[0].id,
                name: testVenueData['Name'],
                status: 'created'
            };
            
            // Create corresponding Firestore venue
            console.log('Creating test venue in Firestore...');
            const firestoreVenueData = {
                airtableId: airtableVenue[0].id,
                name: testVenueData['Name'],
                description: testVenueData['Description'],
                address: testVenueData['Address'],
                status: 'approved',
                contactEmail: testVenueData['Contact Email'],
                website: testVenueData['Website'],
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
            console.error('Error creating test venue:', error);
            results.venues.error = error.message;
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Fixed test data created successfully!',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Fixed test data creation failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Fixed test data creation failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};