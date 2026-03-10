const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

// Function to extract Google Place ID from various URL formats
function extractGooglePlaceId(input) {
    if (!input || typeof input !== 'string') return null;

    // If it's already a Place ID (starts with ChIJ or 0x), return as is
    if (input.startsWith('ChIJ') || input.startsWith('0x')) {
        return input;
    }

    // Try to extract from Google Maps URL
    const urlPatterns = [
        /\/place\/[^\/]+\/([^\/\?]+)/,  // /place/name/ChIJ... or 0x...
        /\/maps\/place\/[^\/]+\/([^\/\?]+)/,  // /maps/place/name/ChIJ... or 0x...
        /[?&]cid=([^&]+)/,  // ?cid=ChIJ... or 0x...
        /[?&]place_id=([^&]+)/,  // ?place_id=ChIJ... or 0x...
        /!1s([^!]+)!/,  // !1s0x4870bc632404df1b:0x30887b950fadaed5!
    ];

    for (const pattern of urlPatterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
            const placeId = match[1];
            // Check if it looks like a valid Place ID (ChIJ or 0x format)
            if (placeId.startsWith('ChIJ') || placeId.startsWith('0x')) {
                return placeId;
            }
        }
    }

    // If no Place ID found, return the original input (might be a valid Place ID in a different format)
    return input;
}

exports.handler = async function (event, context) {
    console.log('Firestore-only venue submission called');

    try {
        // Check environment variables
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

        console.log('Content-Type:', event.headers['content-type']);
        console.log('Body length:', event.body ? event.body.length : 0);
        console.log('Body preview:', event.body ? event.body.substring(0, 200) : 'No body');

        // Decode base64 body if needed
        let decodedBody = event.body;
        if (event.body && event.isBase64Encoded) {
            console.log('Body is base64 encoded, decoding...');
            decodedBody = Buffer.from(event.body, 'base64').toString('utf8');
            console.log('Decoded body length:', decodedBody.length);
            console.log('Decoded body preview:', decodedBody.substring(0, 200));
        }

        if (decodedBody) {
            const contentType = event.headers['content-type'] || '';

            if (contentType.includes('multipart/form-data')) {
                // Handle multipart form data
                const boundary = contentType.split('boundary=')[1];
                console.log('Boundary:', boundary);

                if (boundary) {
                    const parts = decodedBody.split(`--${boundary}`);
                    console.log('Number of parts:', parts.length);

                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i];
                        console.log(`Part ${i} preview:`, part.substring(0, 100));

                        if (part.includes('Content-Disposition: form-data')) {
                            const nameMatch = part.match(/name="([^"]+)"/);
                            if (nameMatch) {
                                const fieldName = nameMatch[1];
                                console.log('Found field:', fieldName);

                                // Check if this is a file field
                                const filenameMatch = part.match(/filename="([^"]+)"/);
                                if (filenameMatch) {
                                    // This is a file field
                                    const filename = filenameMatch[1];
                                    console.log('Found file:', filename);

                                    const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
                                    const contentStart = part.indexOf('\r\n\r\n') + 4;
                                    const contentEnd = part.lastIndexOf('\r\n');

                                    if (contentStart > 3 && contentEnd > contentStart) {
                                        const fileContent = part.substring(contentStart, contentEnd);
                                        files[fieldName] = {
                                            fieldname: fieldName,
                                            filename: filename,
                                            contentType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
                                            content: fileContent
                                        };
                                        console.log('File stored for:', fieldName);
                                    }
                                } else {
                                    // This is a regular field
                                    const valueMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/);
                                    if (valueMatch) {
                                        const value = valueMatch[1].trim();
                                        fields[fieldName] = value;
                                        console.log('Field stored:', fieldName, '=', value.substring(0, 50));
                                    } else {
                                        console.log('No value found for field:', fieldName);
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // Handle URL-encoded form data
                console.log('Handling URL-encoded form data');
                const params = new URLSearchParams(decodedBody);
                for (const [key, value] of params) {
                    fields[key] = value;
                    console.log('URL param:', key, '=', value);
                }
            }
        }

        const submission = { ...fields, files: Object.values(files) };
        console.log('Final parsed submission fields:', Object.keys(fields));
        console.log('Final parsed submission files:', Object.keys(files));
        console.log('Sample field values:', { name: fields.name, address: fields.address, description: fields.description });

        // Handle image upload
        let uploadedImage = null;

        if (submission.files && submission.files.length > 0) {
            const photoFile = submission.files.find(file => file.fieldname === 'photo');
            if (photoFile && photoFile.content) {
                try {
                    console.log('Uploading image to Cloudinary...');
                    const uploadResult = await new Promise((resolve, reject) => {
                        cloudinary.uploader.upload_stream(
                            {
                                folder: 'venues',
                                transformation: [
                                    { width: 800, height: 400, crop: 'fill' },
                                    { quality: 'auto' }
                                ]
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        ).end(Buffer.from(photoFile.content, 'base64'));
                    });

                    uploadedImage = {
                        url: uploadResult.secure_url,
                        publicId: uploadResult.public_id
                    };
                    console.log('Image uploaded successfully:', uploadedImage.url);
                } catch (uploadError) {
                    console.error('Error uploading image:', uploadError);
                    // Continue without image - don't fail the submission
                }
            }
        }

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

        // Prepare Firestore data
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

            // Google Places integration
            googlePlaceId: extractGooglePlaceId(submission['google-place-id'] || ''),

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Venue submitted successfully',
                venueId: firestoreDoc.id,
                venueName: venueName,
                status: firestoreData.status,
                ssgRebuild: ssgRebuildResult
            })
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