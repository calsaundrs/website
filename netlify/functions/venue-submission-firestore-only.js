const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

exports.handler = async function (event, context) {
    console.log('Firestore-only venue submission called');
    
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
        
        // Parse form data manually (no formidable dependency)
        let fields = {};
        let files = {};
        
        if (event.body) {
            const contentType = event.headers['content-type'] || '';
            
            if (contentType.includes('multipart/form-data')) {
                // Handle multipart form data
                const boundary = contentType.split('boundary=')[1];
                if (boundary) {
                    const parts = event.body.split(`--${boundary}`);
                    for (const part of parts) {
                        if (part.includes('Content-Disposition: form-data')) {
                            const nameMatch = part.match(/name="([^"]+)"/);
                            if (nameMatch) {
                                const fieldName = nameMatch[1];
                                
                                // Check if this is a file field
                                const filenameMatch = part.match(/filename="([^"]+)"/);
                                if (filenameMatch) {
                                    // This is a file field
                                    const filename = filenameMatch[1];
                                    const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
                                    const contentStart = part.indexOf('\r\n\r\n') + 4;
                                    const contentEnd = part.lastIndexOf('\r\n');
                                    const fileContent = part.substring(contentStart, contentEnd);
                                    
                                    files[fieldName] = {
                                        fieldname: fieldName,
                                        filename: filename,
                                        contentType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
                                        content: fileContent
                                    };
                                } else {
                                    // This is a regular field
                                    const valueMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/);
                                    if (valueMatch) {
                                        fields[fieldName] = valueMatch[1].trim();
                                    }
                                }
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
        
        const submission = { ...fields, files: Object.values(files) };
        console.log('Parsed submission fields:', Object.keys(fields));
        console.log('Parsed submission files:', Object.keys(files));
        console.log('Sample field values:', { name: fields.name, address: fields.address, description: fields.description });
        
        // Handle image upload - simplified approach
        let uploadedImage = null;
        
        // For now, skip image upload to focus on form data parsing
        // Image upload can be added back once form data is working correctly
        console.log('Image upload temporarily disabled - focusing on form data parsing');
        
        // Determine if submission is from admin form (auto-approves)
        const isFromAdmin = submission['accessibility-rating'] !== undefined || submission['vibe-tags'] !== undefined;
        
        // Generate slug with validation
        const venueName = submission.name || submission['venue-name'];
        if (!venueName) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Missing venue name',
                    message: 'Venue name is required'
                })
            };
        }
        const slug = generateSlug(venueName);
        
        // Prepare Firestore data (no Airtable dependency)
        const firestoreData = {
            name: venueName,
            slug: slug,
            description: submission.description || '',
            address: submission.address || '',
            status: isFromAdmin ? 'approved' : 'pending',
            
            // Contact information
            website: submission.website || '',
            instagram: submission.instagram || '',
            facebook: submission.facebook || '',
            tiktok: submission.tiktok || '',
            contactEmail: submission['contact-email'] || '',
            contactPhone: submission['contact-phone'] || '',
            
            // Venue details
            openingHours: submission['opening-hours'] || '',
            accessibility: submission.accessibility || '',
            accessibilityRating: submission['accessibility-rating'] || '',
            parkingException: submission['parking-exception'] || '',
            
            // Tags and features
            vibeTags: submission['vibe-tags'] ? submission['vibe-tags'].split(',').map(tag => tag.trim()) : [],
            venueFeatures: submission['venue-features'] ? submission['venue-features'].split(',').map(feature => feature.trim()) : [],
            accessibilityFeatures: submission['accessibility-features'] ? submission['accessibility-features'].split(',').map(feature => feature.trim()) : [],
            
            // Image information
            photoUrl: uploadedImage ? uploadedImage.url : null,
            cloudinaryPublicId: uploadedImage ? uploadedImage.publicId : null,
            
            // Timestamps
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore only
        console.log('Submitting to Firestore...');
        const firestoreDoc = await db.collection('venues').add(firestoreData);
        
        console.log(`Venue submitted successfully. Firestore ID: ${firestoreDoc.id}`);
        
        // Trigger SSG rebuild if venue was auto-approved
        let ssgRebuildResult = null;
        if (isFromAdmin && firestoreData.status === 'approved') {
            try {
                console.log('Auto-approved venue created - triggering build hook...');
                
                // Check if build hook URL is configured
                const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
                
                if (buildHookUrl) {
                    // Trigger the build hook
                    const response = await fetch(buildHookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const buildId = await response.text();
                        ssgRebuildResult = {
                            success: true,
                            message: 'Build triggered successfully',
                            buildId: buildId
                        };
                        console.log('Build hook triggered successfully:', buildId);
                    } else {
                        throw new Error(`Build hook failed: ${response.status} ${response.statusText}`);
                    }
                } else {
                    console.log('NETLIFY_BUILD_HOOK_URL not configured - skipping build trigger');
                    ssgRebuildResult = {
                        success: false,
                        message: 'Build hook not configured'
                    };
                }
            } catch (error) {
                console.error('Error triggering build hook:', error);
                ssgRebuildResult = {
                    success: false,
                    message: error.message
                };
            }
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `<!DOCTYPE html>
            <html>
            <head>
                <title>Venue Submitted Successfully</title>
                <meta http-equiv="refresh" content="3;url=/venues.html">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .success { color: #10B981; }
                    .info { color: #6B7280; }
                </style>
            </head>
            <body>
                <h1 class="success">Venue Submitted Successfully!</h1>
                <p>Your venue "${venueName}" has been submitted for review.</p>
                <p class="info">You will be redirected to the venues page shortly.</p>
                <p class="info">Firestore ID: ${firestoreDoc.id}</p>
                <p class="info">Note: This submission was processed using Firestore only.</p>
            </body>
            </html>`
        };
        
    } catch (error) {
        console.error('Error in Firestore-only venue submission:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Venue submission failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};

function generateSlug(venueName) {
    return venueName.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}