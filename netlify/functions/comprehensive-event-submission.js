const Airtable = require('airtable');
const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

exports.handler = async function (event, context) {
    console.log('Comprehensive event submission test...');
    
    try {
        // Check environment variables
        const required = [
            'AIRTABLE_PERSONAL_ACCESS_TOKEN',
            'AIRTABLE_BASE_ID',
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY',
            'CLOUDINARY_CLOUD_NAME',
            'CLOUDINARY_API_KEY',
            'CLOUDINARY_API_SECRET'
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
        
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        
        // Generate test data with all working fields
        const testSubmission = {
            'event-name': 'Comprehensive Test Event',
            'description': 'This is a comprehensive test event with all working fields including categories',
            'date': '2024-12-27',
            'start-time': '21:00',
            'venue-text': 'Test Venue',
            'category': 'Club Night, Party', // Using actual available categories
            'link': 'https://example.com/comprehensive-test',
            'email': 'test@brumoutloud.co.uk'
        };
        
        // Generate slug
        const slug = testSubmission['event-name'].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + testSubmission.date;
        
        // Prepare comprehensive event data for Airtable
        const eventData = {
            'Event Name': testSubmission['event-name'],
            'Date': new Date(`${testSubmission.date}T${testSubmission['start-time']}`).toISOString(),
            'Description': testSubmission.description,
            'Link': testSubmission.link,
            'Status': 'Pending Review',
            'Submitter Email': testSubmission.email,
            'Slug': slug,
            'Category': testSubmission.category ? testSubmission.category.split(',').map(cat => cat.trim()) : []
        };
        
        console.log('Attempting to create comprehensive event in Airtable with data:', eventData);
        
        // Submit to Airtable
        const airtableRecord = await base('Events').create([{ fields: eventData }]);
        const airtableId = airtableRecord[0].id;
        
        // Prepare Firestore data
        const firestoreData = {
            airtableId: airtableId,
            name: eventData['Event Name'],
            slug: eventData['Slug'],
            description: eventData['Description'],
            date: eventData['Date'],
            status: 'pending',
            venueName: testSubmission['venue-text'],
            category: eventData['Category'],
            link: eventData['Link'],
            submittedBy: eventData['Submitter Email'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore
        const firestoreDoc = await db.collection('events').add(firestoreData);
        
        console.log(`Comprehensive event submitted successfully. Airtable ID: ${airtableId}, Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Comprehensive test event submitted successfully!',
                airtableId: airtableId,
                firestoreId: firestoreDoc.id,
                fieldsUsed: Object.keys(eventData),
                categories: eventData['Category']
            })
        };
        
    } catch (error) {
        console.error('Comprehensive submission failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Comprehensive submission failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};