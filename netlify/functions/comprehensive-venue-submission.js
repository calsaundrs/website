const Airtable = require('airtable');
const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

exports.handler = async function (event, context) {
    console.log('Testing comprehensive venue submission...');
    
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
        
        // Generate comprehensive test venue data
        const testSubmission = {
            name: 'Comprehensive Test Venue',
            description: 'This is a comprehensive test venue with all working fields',
            address: '123 Comprehensive Street, Birmingham',
            'contact-email': 'test@brumoutloud.co.uk',
            website: 'https://comprehensivevenue.com',
            instagram: '@comprehensivevenue',
            facebook: 'ComprehensiveVenue',
            tiktok: '@comprehensivevenue',
            'contact-phone': '0121 123 4567',
            'opening-hours': 'Mon-Sat: 10am-11pm, Sun: 12pm-10pm',
            accessibility: 'Wheelchair accessible, accessible toilets, hearing loop',
            'parking-exception': 'Free parking available on weekends',
            'vibe-tags': ['LGBTQ+ Friendly', 'Inclusive', 'Welcoming'],
            'venue-features': ['Dance Floor', 'Bar', 'Stage', 'Sound System'],
            'accessibility-features': ['Wheelchair Access', 'Accessible Toilets', 'Hearing Loop']
        };
        
        // Generate slug
        const slug = testSubmission.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        // Helper function for arrays
        const toArray = (value) => {
            if (value === undefined) return [];
            return Array.isArray(value) ? value : [value];
        };
        
        // Prepare comprehensive venue data for Airtable
        const venueData = {
            'Name': testSubmission.name,
            'Description': testSubmission.description,
            'Address': testSubmission.address,
            'Status': 'Pending Review',
            'Listing Status': 'Pending Review',
            'Contact Email': testSubmission['contact-email'],
            'Website': testSubmission.website,
            'Instagram': testSubmission.instagram,
            'Facebook': testSubmission.facebook,
            'TikTok': testSubmission.tiktok,
            'Contact Phone': testSubmission['contact-phone'],
            'Opening Hours': testSubmission['opening-hours'],
            'Accessibility': testSubmission.accessibility,
            'Parking Exception': testSubmission['parking-exception'],
            'Vibe Tags': toArray(testSubmission['vibe-tags']),
            'Venue Features': toArray(testSubmission['venue-features']),
            'Accessibility Features': toArray(testSubmission['accessibility-features'])
        };
        
        console.log('Attempting to create comprehensive venue in Airtable with data:', venueData);
        
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
            instagram: venueData['Instagram'],
            facebook: venueData['Facebook'],
            tiktok: venueData['TikTok'],
            contactEmail: venueData['Contact Email'],
            contactPhone: venueData['Contact Phone'],
            openingHours: venueData['Opening Hours'],
            accessibility: venueData['Accessibility'],
            parkingException: venueData['Parking Exception'],
            vibeTags: venueData['Vibe Tags'],
            venueFeatures: venueData['Venue Features'],
            accessibilityFeatures: venueData['Accessibility Features'],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore
        const firestoreDoc = await db.collection('venues').add(firestoreData);
        
        console.log(`Comprehensive venue submitted successfully. Airtable ID: ${airtableId}, Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Comprehensive venue submission test successful!',
                airtableId: airtableId,
                firestoreId: firestoreDoc.id,
                slug: slug,
                fieldsUsed: Object.keys(venueData),
                note: 'Comprehensive fields including social media, accessibility, and features'
            })
        };
        
    } catch (error) {
        console.error('Comprehensive venue submission failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Comprehensive venue submission failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};