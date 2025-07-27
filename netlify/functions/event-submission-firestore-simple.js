const admin = require('firebase-admin');
const formidable = require('formidable');

exports.handler = async function (event, context) {
    console.log('Simple Firestore-only event submission called');
    
    try {
        // Check environment variables (no Cloudinary needed)
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
        
        console.log('Parsed fields:', fields);
        console.log('Parsed files:', files);
        
        const submission = { ...fields, files: Object.values(files) };
        console.log('Submission keys:', Object.keys(submission));
        
        // Generate slug
        const slug = generateSlug(submission['event-name'], submission.date);
        
        // Prepare Firestore data (no Cloudinary dependency)
        const firestoreData = {
            name: submission['event-name'] || 'Untitled Event',
            slug: slug,
            description: submission.description || '',
            date: new Date(`${submission.date}T${submission['start-time'] || '00:00'}`).toISOString(),
            status: 'pending',
            venueName: submission['venue-name'] || '',
            category: submission.category ? submission.category.split(',').map(cat => cat.trim()) : [],
            link: submission.link || '',
            recurringInfo: submission['recurring-info'] || '',
            seriesId: submission['series-id'] || `series_${Date.now()}`,
            cloudinaryPublicId: null,
            promoImage: null,
            submittedBy: submission.email || 'anonymous@brumoutloud.co.uk',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('Firestore data to submit:', firestoreData);
        
        // Submit to Firestore only
        console.log('Submitting to Firestore...');
        const firestoreDoc = await db.collection('events').add(firestoreData);
        
        console.log(`Event submitted successfully. Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Event submitted successfully',
                firestoreId: firestoreDoc.id,
                eventName: firestoreData.name,
                venueName: firestoreData.venueName,
                status: firestoreData.status
            })
        };
        
    } catch (error) {
        console.error('Error in simple Firestore-only event submission:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Event submission failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};

function generateSlug(eventName, date) {
    const datePart = new Date(date).toISOString().split('T')[0];
    const namePart = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${namePart}-${datePart}`;
}