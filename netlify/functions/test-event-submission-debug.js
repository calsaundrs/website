const admin = require('firebase-admin');
const formidable = require('formidable');

exports.handler = async function (event, context) {
    console.log('Event submission debug test called');
    
    try {
        // Check environment variables
        const required = [
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
        
        // Initialize Firebase
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
        
        // Parse form data
        const form = formidable({});
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(event, (err, fields, files) => {
                if (err) reject(err);
                else resolve([fields, files]);
            });
        });
        
        console.log('Raw fields:', fields);
        console.log('Raw files:', files);
        
        const submission = { ...fields, files: Object.values(files) };
        console.log('Parsed submission keys:', Object.keys(submission));
        
        // Test basic event submission
        const testEventData = {
            name: submission['event-name'] || 'Debug Test Event',
            slug: 'debug-test-event-2025-01-27',
            description: submission.description || 'Debug test event',
            date: new Date().toISOString(),
            status: 'pending',
            venueName: submission['venue-name'] || 'Debug Venue',
            category: submission.category ? submission.category.split(',').map(cat => cat.trim()) : [],
            link: submission.link || '',
            recurringInfo: submission['recurring-info'] || '',
            seriesId: `debug_series_${Date.now()}`,
            submittedBy: submission.email || 'debug@test.com',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('Test event data:', testEventData);
        
        // Submit to Firestore
        const firestoreDoc = await db.collection('events').add(testEventData);
        
        console.log(`Debug event submitted successfully. Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Debug event submission successful',
                firestoreId: firestoreDoc.id,
                submittedData: testEventData,
                receivedFields: fields,
                receivedFiles: Object.keys(files)
            })
        };
        
    } catch (error) {
        console.error('Debug event submission failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Debug event submission failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};