const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Simple Firestore-only venue submission called');
    
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
        
        // Parse form data manually (no formidable dependency)
        let fields = {};
        
        if (event.body) {
            // Handle multipart form data
            const boundary = event.headers['content-type']?.split('boundary=')[1];
            if (boundary) {
                const parts = event.body.split(`--${boundary}`);
                for (const part of parts) {
                    if (part.includes('Content-Disposition: form-data')) {
                        const nameMatch = part.match(/name="([^"]+)"/);
                        if (nameMatch) {
                            const fieldName = nameMatch[1];
                            const valueMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/);
                            if (valueMatch) {
                                fields[fieldName] = valueMatch[1].trim();
                            }
                        }
                    }
                }
            } else {
                // Handle URL-encoded form data
                const params = new URLSearchParams(event.body);
                for (const [key, value] of params) {
                    fields[key] = value;
                }
            }
        }
        
        console.log('Parsed fields:', fields);
        
        const submission = fields;
        console.log('Submission keys:', Object.keys(submission));
        
        // Generate slug
        const venueName = submission.name || submission['venue-name'] || 'Untitled Venue';
        const slug = generateSlug(venueName);
        
        // Determine if submission is from admin form (auto-approves)
        const isFromAdmin = submission['accessibility-rating'] !== undefined || submission['vibe-tags'] !== undefined;
        
        // Prepare Firestore data (no Cloudinary dependency)
        const firestoreData = {
            name: venueName,
            slug: slug,
            description: submission.description || '',
            address: submission.address || '',
            status: isFromAdmin ? 'approved' : 'pending',
            contactEmail: submission.email || submission['contact-email'] || '',
            website: submission.website || '',
            contactPhone: submission['contact-phone'] || '',
            openingHours: submission['opening-hours'] || '',
            accessibility: submission.accessibility || '',
            features: submission.features ? submission.features.split(',').map(f => f.trim()) : [],
            socialMedia: {
                instagram: submission.instagram || '',
                facebook: submission.facebook || '',
                twitter: submission.twitter || ''
            },
            tags: submission.tags ? submission.tags.split(',').map(t => t.trim()) : [],
            cloudinaryPublicId: null,
            promoImage: null,
            submittedBy: submission.email || 'anonymous@brumoutloud.co.uk',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('Firestore data to submit:', firestoreData);
        
        // Submit to Firestore only
        console.log('Submitting to Firestore...');
        const firestoreDoc = await db.collection('venues').add(firestoreData);
        
        console.log(`Venue submitted successfully. Firestore ID: ${firestoreDoc.id}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Venue submitted successfully',
                firestoreId: firestoreDoc.id,
                venueName: firestoreData.name,
                status: firestoreData.status
            })
        };
        
    } catch (error) {
        console.error('Error in simple Firestore-only venue submission:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Venue submission failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};

function generateSlug(venueName) {
    return (venueName || 'venue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}