const admin = require('firebase-admin');
const formidable = require('formidable');
const cloudinary = require('cloudinary').v2;

exports.handler = async function (event, context) {
    console.log('Firestore-only event submission called');
    
    try {
        // Check environment variables (no Airtable needed)
        const required = [
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
        
        // Initialize Cloudinary
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        
        // Parse form data
        const form = formidable({});
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(event, (err, fields, files) => {
                if (err) reject(err);
                else resolve([fields, files]);
            });
        });
        
        const submission = { ...fields, files: Object.values(files) };
        console.log('Parsed submission:', Object.keys(submission));
        
        // Handle image upload
        const imageFile = submission.files.find(f => f.fieldname === 'image');
        let uploadedImage = null;
        
        if (imageFile && imageFile.size > 0) {
            try {
                const result = await cloudinary.uploader.upload(imageFile.filepath, {
                    folder: 'events',
                    transformation: [
                        { width: 800, height: 400, crop: 'fill', gravity: 'auto' },
                        { quality: 'auto', fetch_format: 'auto' }
                    ]
                });
                
                uploadedImage = {
                    publicId: result.public_id,
                    url: result.secure_url,
                    original: result.secure_url
                };
                console.log('Image uploaded successfully:', uploadedImage.publicId);
            } catch (uploadError) {
                console.error('Image upload failed:', uploadError);
                // Continue without image
            }
        }
        
        // Generate slug
        const slug = generateSlug(submission['event-name'], submission.date);
        
        // Prepare Firestore data (no Airtable dependency)
        const firestoreData = {
            name: submission['event-name'] || 'Untitled Event',
            slug: slug,
            description: submission.description || '',
            date: new Date(`${submission.date}T${submission['start-time'] || '00:00'}`).toISOString(),
            status: 'pending',
            venueName: submission['venue-text'] || submission['venue-name'] || '',
            category: submission.category ? submission.category.split(',').map(cat => cat.trim()) : [],
            link: submission.link || '',
            recurringInfo: submission['recurring-info'] || '',
            seriesId: submission['series-id'] || `series_${Date.now()}`,
            cloudinaryPublicId: uploadedImage ? uploadedImage.publicId : null,
            promoImage: uploadedImage ? uploadedImage.url : null,
            submittedBy: submission.email || 'anonymous@brumoutloud.co.uk',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore only
        console.log('Submitting to Firestore...');
        const firestoreDoc = await db.collection('events').add(firestoreData);
        
        console.log(`Event submitted successfully. Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `<!DOCTYPE html>
            <html>
            <head>
                <title>Event Submitted Successfully</title>
                <meta http-equiv="refresh" content="3;url=/events.html">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .success { color: #10B981; }
                    .info { color: #6B7280; }
                </style>
            </head>
            <body>
                <h1 class="success">Event Submitted Successfully!</h1>
                <p>Your event "${submission['event-name']}" has been submitted for review.</p>
                <p class="info">You will be redirected to the events page shortly.</p>
                <p class="info">Firestore ID: ${firestoreDoc.id}</p>
                <p class="info">Note: This submission was processed using Firestore only.</p>
            </body>
            </html>`
        };
        
    } catch (error) {
        console.error('Error in Firestore-only event submission:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Event submission failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};

function generateSlug(eventName, date) {
    const datePart = new Date(date).toISOString().split('T')[0];
    const namePart = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${namePart}-${datePart}`;
}