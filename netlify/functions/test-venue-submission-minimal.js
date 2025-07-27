const Airtable = require('airtable');
const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Testing minimal venue submission...');
    
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
        
        // Generate test venue data with minimal fields
        const testSubmission = {
            name: 'Minimal Test Venue',
            description: 'This is a minimal test venue',
            address: '123 Minimal Street, Birmingham',
            'contact-email': 'test@brumoutloud.co.uk'
        };
        
        // Generate slug
        const slug = testSubmission.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        // Prepare minimal venue data for Airtable
        const venueData = {
            'Name': testSubmission.name,
            'Description': testSubmission.description,
            'Address': testSubmission.address,
            'Status': 'Pending Review',
            'Contact Email': testSubmission['contact-email']
        };
        
        console.log('Attempting to create minimal venue in Airtable with data:', venueData);
        
        // Submit to Airtable
        const airtableRecord = await base('Venues').create([{ fields: venueData }]);
        const airtableId = airtableRecord[0].id;
        
        // Prepare Firestore data (with slug)
        const firestoreData = {
            airtableId: airtableId,
            name: venueData['Name'],
            slug: slug,
            description: venueData['Description'],
            address: venueData['Address'],
            status: venueData['Status'].toLowerCase(),
            contactEmail: venueData['Contact Email'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore
        const firestoreDoc = await db.collection('venues').add(firestoreData);
        
        console.log(`Minimal venue submitted successfully. Airtable ID: ${airtableId}, Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Minimal venue submission test successful!',
                airtableId: airtableId,
                firestoreId: firestoreDoc.id,
                slug: slug,
                fieldsUsed: Object.keys(venueData),
                note: 'Only essential fields used - no computed fields'
            })
        };
        
    } catch (error) {
        console.error('Minimal venue submission failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Minimal venue submission failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};