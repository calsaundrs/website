const Airtable = require('airtable');
const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Testing enhanced venue submission...');
    
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
        
        // Generate enhanced test venue data (building on minimal)
        const testSubmission = {
            name: 'Enhanced Test Venue',
            description: 'This is an enhanced test venue with additional fields',
            address: '123 Enhanced Street, Birmingham',
            'contact-email': 'test@brumoutloud.co.uk',
            website: 'https://enhancedvenue.com',
            'contact-phone': '0121 123 4567',
            'opening-hours': 'Mon-Sat: 10am-11pm, Sun: 12pm-10pm',
            accessibility: 'Wheelchair accessible, accessible toilets'
        };
        
        // Generate slug
        const slug = testSubmission.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        // Prepare enhanced venue data for Airtable (building on minimal)
        const venueData = {
            'Name': testSubmission.name,
            'Description': testSubmission.description,
            'Address': testSubmission.address,
            'Status': 'Pending Review',
            'Contact Email': testSubmission['contact-email'],
            'Website': testSubmission.website,
            'Contact Phone': testSubmission['contact-phone'],
            'Opening Hours': testSubmission['opening-hours'],
            'Accessibility': testSubmission.accessibility
        };
        
        console.log('Attempting to create enhanced venue in Airtable with data:', venueData);
        
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
            website: venueData['Website'],
            contactPhone: venueData['Contact Phone'],
            openingHours: venueData['Opening Hours'],
            accessibility: venueData['Accessibility'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore
        const firestoreDoc = await db.collection('venues').add(firestoreData);
        
        console.log(`Enhanced venue submitted successfully. Airtable ID: ${airtableId}, Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Enhanced venue submission test successful!',
                airtableId: airtableId,
                firestoreId: firestoreDoc.id,
                slug: slug,
                fieldsUsed: Object.keys(venueData),
                note: 'Enhanced fields beyond minimal: Website, Phone, Opening Hours, Accessibility'
            })
        };
        
    } catch (error) {
        console.error('Enhanced venue submission failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Enhanced venue submission failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};