const Airtable = require('airtable');
const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Creating enhanced test data...');
    
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
        
        // Create enhanced test event in Airtable (adding Category and Link)
        try {
            console.log('Creating enhanced test event in Airtable...');
            const testEventData = {
                'Event Name': 'Enhanced Test Event',
                'Description': 'This is an enhanced test event with Category and Link',
                'Date': new Date('2024-12-29T20:00:00').toISOString(),
                'Status': 'Approved',
                'Submitter Email': 'test@brumoutloud.co.uk',
                'Category': ['Test', 'Enhanced'],
                'Link': 'https://example.com/enhanced'
            };
            
            console.log('Enhanced event data to create:', testEventData);
            
            const airtableEvent = await base('Events').create([{ fields: testEventData }]);
            results.events.airtable = {
                id: airtableEvent[0].id,
                name: testEventData['Event Name'],
                status: 'created'
            };
            
            // Create corresponding Firestore event
            console.log('Creating enhanced test event in Firestore...');
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
            console.error('Error creating enhanced test event:', error);
            results.events.error = error.message;
        }
        
        // Create enhanced test venue in Airtable (adding Website)
        try {
            console.log('Creating enhanced test venue in Airtable...');
            const testVenueData = {
                'Name': 'Enhanced Test Venue',
                'Description': 'This is an enhanced test venue with Website',
                'Address': '123 Enhanced Street, Birmingham',
                'Status': 'Approved',
                'Contact Email': 'test@brumoutloud.co.uk',
                'Website': 'https://enhancedtestvenue.com'
            };
            
            console.log('Enhanced venue data to create:', testVenueData);
            
            const airtableVenue = await base('Venues').create([{ fields: testVenueData }]);
            results.venues.airtable = {
                id: airtableVenue[0].id,
                name: testVenueData['Name'],
                status: 'created'
            };
            
            // Create corresponding Firestore venue
            console.log('Creating enhanced test venue in Firestore...');
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
            console.error('Error creating enhanced test venue:', error);
            results.venues.error = error.message;
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Enhanced test data created successfully!',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Enhanced test data creation failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Enhanced test data creation failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};