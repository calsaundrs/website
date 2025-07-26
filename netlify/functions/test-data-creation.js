const Airtable = require('airtable');

// Check if required environment variables are available
function checkEnvironmentVariables() {
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
            success: false,
            missing: missing,
            message: `Missing environment variables: ${missing.join(', ')}`
        };
    }
    
    return { success: true };
}

// Initialize Firebase Admin with error handling
function initializeFirebase() {
    try {
        const admin = require('firebase-admin');
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        }
        
        return { success: true, db: admin.firestore() };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Failed to initialize Firebase Admin'
        };
    }
}

// Initialize Airtable with error handling
function initializeAirtable() {
    try {
        const base = new Airtable({ 
            apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
        }).base(process.env.AIRTABLE_BASE_ID);
        
        return { success: true, base: base };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Failed to initialize Airtable'
        };
    }
}

exports.handler = async function (event, context) {
    console.log('Creating test data...');
    
    try {
        // Check environment variables
        const envCheck = checkEnvironmentVariables();
        if (!envCheck.success) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: envCheck.message,
                    missing: envCheck.missing
                })
            };
        }
        
        // Initialize services
        const firebaseInit = initializeFirebase();
        const airtableInit = initializeAirtable();
        
        if (!firebaseInit.success) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    error: 'Firebase initialization error',
                    message: firebaseInit.message,
                    details: firebaseInit.error
                })
            };
        }
        
        if (!airtableInit.success) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    error: 'Airtable initialization error',
                    message: airtableInit.message,
                    details: airtableInit.error
                })
            };
        }
        
        const db = firebaseInit.db;
        const base = airtableInit.base;
        
        const results = {
            events: { airtable: null, firestore: null },
            venues: { airtable: null, firestore: null }
        };
        
        // Create test event in Airtable
        try {
            console.log('Creating test event in Airtable...');
            const testEventData = {
                'Event Name': 'Test Event - Data Migration',
                'Description': 'This is a test event created by the data migration system',
                'Date': '2024-12-25',
                'Status': 'Approved',
                'Venue Name': 'Test Venue',
                'Category': ['Test', 'Migration'],
                'Link': 'https://example.com',
                'Submitter Email': 'test@brumoutloud.co.uk',
                'Created Time': new Date().toISOString(),
                'Last Modified Time': new Date().toISOString()
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
                venueName: testEventData['Venue Name'],
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
        
        // Create test venue in Airtable
        try {
            console.log('Creating test venue in Airtable...');
            const testVenueData = {
                'Name': 'Test Venue - Data Migration',
                'Description': 'This is a test venue created by the data migration system',
                'Address': '123 Test Street, Birmingham',
                'Status': 'Approved',
                'Listing Status': 'Listed',
                'Contact Email': 'test@brumoutloud.co.uk',
                'Website': 'https://testvenue.com',
                'Created Time': new Date().toISOString(),
                'Last Modified Time': new Date().toISOString()
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
                listingStatus: 'listed',
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
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                message: 'Test data created successfully',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Test data creation failed:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                error: 'Test data creation failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};