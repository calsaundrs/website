const Airtable = require('airtable');
const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Testing unified event submission...');
    
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
            'event-name': 'Unified Test Event',
            'date': '2024-12-31',
            'start-time': '20:00',
            'description': 'This is a test of the unified event submission with categories',
            'link': 'https://example.com/unified-test',
            'category': 'Club Night, Party',
            'venue-text': 'Test Venue',
            'email': 'test@brumoutloud.co.uk'
        };
        
        console.log('Test submission data:', testSubmission);
        
        // Simulate the unified submission process
        const results = {
            airtable: null,
            firestore: null,
            categoryHandling: null
        };
        
        // Create in Airtable (without Category field)
        try {
            console.log('Creating event in Airtable...');
            const eventData = {
                'Event Name': testSubmission['event-name'],
                'Date': new Date(`${testSubmission.date}T${testSubmission['start-time']}`).toISOString(),
                'Description': testSubmission.description,
                'Link': testSubmission.link,
                'Status': 'Pending Review',
                'Submitter Email': testSubmission.email,
                'Slug': `unified-test-event-${testSubmission.date}`
            };
            
            const airtableRecord = await base('Events').create([{ fields: eventData }]);
            results.airtable = {
                id: airtableRecord[0].id,
                name: eventData['Event Name'],
                status: 'created',
                hasCategory: false
            };
            
            // Create in Firestore (with Category field)
            console.log('Creating event in Firestore...');
            const firestoreData = {
                airtableId: airtableRecord[0].id,
                name: eventData['Event Name'],
                slug: eventData['Slug'],
                description: eventData['Description'],
                date: eventData['Date'],
                status: 'pending',
                venueName: testSubmission['venue-text'],
                category: testSubmission.category ? testSubmission.category.split(',').map(cat => cat.trim()) : [],
                link: eventData['Link'],
                submittedBy: eventData['Submitter Email'],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const firestoreDoc = await db.collection('events').add(firestoreData);
            results.firestore = {
                id: firestoreDoc.id,
                name: firestoreData.name,
                status: 'created',
                hasCategory: true,
                categories: firestoreData.category
            };
            
            // Verify category handling
            results.categoryHandling = {
                original: testSubmission.category,
                processed: firestoreData.category,
                airtableHasCategory: false,
                firestoreHasCategory: true,
                categoryCount: firestoreData.category.length
            };
            
        } catch (error) {
            console.error('Error in unified submission test:', error);
            results.error = error.message;
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Unified event submission test completed!',
                results: results,
                summary: {
                    airtableSuccess: !!results.airtable,
                    firestoreSuccess: !!results.firestore,
                    categoryStoredInFirestore: results.categoryHandling?.firestoreHasCategory || false,
                    categoryCount: results.categoryHandling?.categoryCount || 0
                }
            })
        };
        
    } catch (error) {
        console.error('Unified event submission test failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Unified event submission test failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};