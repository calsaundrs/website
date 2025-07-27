const Airtable = require('airtable');
const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

exports.handler = async function (event, context) {
    console.log('Testing complete admin workflow...');
    
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
        
        // Step 1: Create a test event
        console.log('Step 1: Creating test event...');
        const testSubmission = {
            'event-name': 'Admin Workflow Test Event',
            'description': 'This is a test event for admin workflow testing',
            'date': '2024-12-28',
            'start-time': '22:00',
            'venue-text': 'Test Venue',
            'category': 'Live Music, Party',
            'link': 'https://example.com/admin-test',
            'email': 'test@brumoutloud.co.uk'
        };
        
        const slug = testSubmission['event-name'].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + testSubmission.date;
        
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
        
        const airtableRecord = await base('Events').create([{ fields: eventData }]);
        const airtableId = airtableRecord[0].id;
        
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
        
        const firestoreDoc = await db.collection('events').add(firestoreData);
        
        console.log(`Test event created. Airtable ID: ${airtableId}, Firestore ID: ${firestoreDoc.id}`);
        
        // Step 2: Test approval process
        console.log('Step 2: Testing approval process...');
        
        // Update status in both databases
        await base('Events').update([{
            id: airtableId,
            fields: { 'Status': 'Approved' }
        }]);
        
        await db.collection('events').doc(firestoreDoc.id).update({
            status: 'approved',
            updatedAt: new Date()
        });
        
        console.log('Test event approved in both databases');
        
        // Step 3: Verify the approval
        console.log('Step 3: Verifying approval...');
        
        const updatedAirtableRecord = await base('Events').find(airtableId);
        const updatedFirestoreRecord = await db.collection('events').doc(firestoreDoc.id).get();
        
        const airtableStatus = updatedAirtableRecord.get('Status');
        const firestoreStatus = updatedFirestoreRecord.data().status;
        
        const statusMatch = airtableStatus === 'Approved' && firestoreStatus === 'approved';
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Admin workflow test completed successfully!',
                testEvent: {
                    airtableId: airtableId,
                    firestoreId: firestoreDoc.id,
                    name: eventData['Event Name']
                },
                approvalTest: {
                    airtableStatus: airtableStatus,
                    firestoreStatus: firestoreStatus,
                    statusMatch: statusMatch
                },
                workflowSteps: [
                    '✅ Created test event in both databases',
                    '✅ Updated status to Approved in both databases',
                    `✅ Verified status match: ${statusMatch ? 'PASS' : 'FAIL'}`
                ]
            })
        };
        
    } catch (error) {
        console.error('Admin workflow test failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Admin workflow test failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};