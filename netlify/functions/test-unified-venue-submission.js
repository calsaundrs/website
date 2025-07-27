const Airtable = require('airtable');
const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Testing unified venue submission...');
    
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
        
        // Test data that would come from a form submission
        const testSubmission = {
            'venue-name': 'Unified Test Venue',
            'description': 'This is a test of the unified venue submission with comprehensive data',
            'address': '123 Unified Street, Birmingham',
            'contact-email': 'test@brumoutloud.co.uk',
            'website': 'https://unifiedtestvenue.com',
            'contact-phone': '0121 123 4567',
            'opening-hours': 'Mon-Sat: 10am-11pm, Sun: 12pm-10pm',
            'accessibility': 'Wheelchair accessible, Hearing loop available',
            'social-media': 'Instagram: @unifiedtestvenue, Twitter: @unifiedtest',
            'tags': 'LGBTQ+, Live Music, Drag Shows',
            'features': 'Dance floor, Bar, Stage, Sound system'
        };
        
        console.log('Test venue submission data:', testSubmission);
        
        // Simulate the unified submission process
        const results = {
            airtable: null,
            firestore: null,
            fieldHandling: null
        };
        
        // Create in Airtable (basic fields only)
        try {
            console.log('Creating venue in Airtable...');
            const venueData = {
                'Name': testSubmission['venue-name'],
                'Description': testSubmission.description,
                'Address': testSubmission.address,
                'Status': 'Approved',
                'Contact Email': testSubmission['contact-email'],
                'Website': testSubmission.website,
                'Contact Phone': testSubmission['contact-phone'],
                'Opening Hours': testSubmission['opening-hours'],
                'Accessibility': testSubmission.accessibility
            };
            
            const airtableVenue = await base('Venues').create([{ fields: venueData }]);
            results.airtable = {
                id: airtableVenue[0].id,
                name: venueData['Name'],
                status: 'created',
                fieldsCount: Object.keys(venueData).length
            };
            
            // Create in Firestore (all fields including social media, tags, features)
            console.log('Creating venue in Firestore...');
            const firestoreData = {
                airtableId: airtableVenue[0].id,
                name: venueData['Name'],
                description: venueData['Description'],
                address: venueData['Address'],
                status: 'approved',
                contactEmail: venueData['Contact Email'],
                website: venueData['Website'],
                contactPhone: venueData['Contact Phone'],
                openingHours: venueData['Opening Hours'],
                accessibility: venueData['Accessibility'],
                // Additional fields stored only in Firestore
                socialMedia: testSubmission['social-media'],
                tags: testSubmission.tags ? testSubmission.tags.split(',').map(tag => tag.trim()) : [],
                features: testSubmission.features ? testSubmission.features.split(',').map(feature => feature.trim()) : [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const firestoreDoc = await db.collection('venues').add(firestoreData);
            results.firestore = {
                id: firestoreDoc.id,
                name: firestoreData.name,
                status: 'created',
                fieldsCount: Object.keys(firestoreData).length,
                hasSocialMedia: !!firestoreData.socialMedia,
                hasTags: firestoreData.tags.length > 0,
                hasFeatures: firestoreData.features.length > 0
            };
            
            // Verify field handling
            results.fieldHandling = {
                airtableFields: Object.keys(venueData),
                firestoreFields: Object.keys(firestoreData).filter(key => !['createdAt', 'updatedAt'].includes(key)),
                socialMediaStored: !!firestoreData.socialMedia,
                tagsStored: firestoreData.tags.length,
                featuresStored: firestoreData.features.length
            };
            
        } catch (error) {
            console.error('Error in unified venue submission test:', error);
            results.error = error.message;
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Unified venue submission test completed!',
                results: results,
                summary: {
                    airtableSuccess: !!results.airtable,
                    firestoreSuccess: !!results.firestore,
                    socialMediaInFirestore: results.fieldHandling?.socialMediaStored || false,
                    tagsInFirestore: results.fieldHandling?.tagsStored || 0,
                    featuresInFirestore: results.fieldHandling?.featuresStored || 0
                }
            })
        };
        
    } catch (error) {
        console.error('Unified venue submission test failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Unified venue submission test failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};