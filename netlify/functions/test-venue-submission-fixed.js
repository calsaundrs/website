const Airtable = require('airtable');
const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

exports.handler = async function (event, context) {
    console.log('Testing fixed venue submission...');
    
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
        
        // Generate test venue data
        const testSubmission = {
            name: 'Fixed Test Venue',
            description: 'This is a test venue to verify the slug fix works',
            address: '123 Fixed Street, Birmingham',
            'contact-email': 'test@brumoutloud.co.uk',
            website: 'https://fixedtestvenue.com',
            'opening-hours': 'Mon-Sat: 10am-11pm, Sun: 12pm-10pm',
            accessibility: 'Wheelchair accessible, accessible toilets',
            'vibe-tags': ['LGBTQ+ Friendly', 'Inclusive'],
            'venue-features': ['Dance Floor', 'Bar', 'Stage']
        };
        
        // Generate slug
        const slug = testSubmission.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        // Prepare venue data for Airtable (without Slug field)
        const venueData = {
            'Name': testSubmission.name,
            'Description': testSubmission.description,
            'Address': testSubmission.address,
            'Status': 'Pending Review',
            'Listing Status': 'Pending Review',
            'Contact Email': testSubmission['contact-email'],
            'Website': testSubmission.website,
            'Opening Hours': testSubmission['opening-hours'],
            'Accessibility': testSubmission.accessibility,
            'Vibe Tags': testSubmission['vibe-tags'],
            'Venue Features': testSubmission['venue-features'],
            'Created Time': new Date().toISOString(),
            'Last Modified Time': new Date().toISOString()
        };
        
        console.log('Attempting to create venue in Airtable with data:', venueData);
        
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
            listingStatus: venueData['Listing Status'].toLowerCase(),
            website: venueData['Website'],
            contactEmail: venueData['Contact Email'],
            openingHours: venueData['Opening Hours'],
            accessibility: venueData['Accessibility'],
            vibeTags: venueData['Vibe Tags'],
            venueFeatures: venueData['Venue Features'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore
        const firestoreDoc = await db.collection('venues').add(firestoreData);
        
        console.log(`Fixed venue submitted successfully. Airtable ID: ${airtableId}, Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Fixed venue submission test successful!',
                airtableId: airtableId,
                firestoreId: firestoreDoc.id,
                slug: slug,
                fieldsUsed: Object.keys(venueData),
                note: 'Slug field removed from Airtable (computed field) but stored in Firestore'
            })
        };
        
    } catch (error) {
        console.error('Fixed venue submission failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Fixed venue submission failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};