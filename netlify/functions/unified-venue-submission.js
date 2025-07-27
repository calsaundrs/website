const Airtable = require('airtable');
const parser = require('lambda-multipart-parser');

// Check if required environment variables are available
function checkEnvironmentVariables() {
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
            success: false,
            missing: missing,
            message: `Missing environment variables: ${missing.join(', ')}`
        };
    }
    
    return { success: true };
}

// Initialize Firebase Admin with error handling
function initializeFirebase() {
    try {
        const admin = require('firebase-admin');
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        }
        
        return { success: true, db: admin.firestore() };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Failed to initialize Firebase Admin'
        };
    }
}

// Initialize Airtable with error handling
function initializeAirtable() {
    try {
        const base = new Airtable({ 
            apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
        }).base(process.env.AIRTABLE_BASE_ID);
        
        return { success: true, base: base };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Failed to initialize Airtable'
        };
    }
}

// Initialize Cloudinary with error handling
function initializeCloudinary() {
    try {
        const cloudinary = require('cloudinary').v2;
        
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        
        return { success: true, cloudinary: cloudinary };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'Failed to initialize Cloudinary'
        };
    }
}

async function uploadImage(file, cloudinary) {
    if (!file) return null;
    
    try {
        const base64String = file.content.toString('base64');
        const dataUri = `data:${file.contentType};base64,${base64String}`;
        
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'brumoutloud_venues',
            eager: [
                { width: 800, height: 600, crop: 'fill', gravity: 'auto', fetch_format: 'auto', quality: 'auto' },
                { width: 400, height: 400, crop: 'fill', gravity: 'auto', fetch_format: 'auto', quality: 'auto' }
            ]
        });
        
        return {
            original: result.secure_url,
            medium: result.eager[0].secure_url,
            thumbnail: result.eager[1].secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

// Helper to ensure checkbox values are always arrays for Airtable
const toArray = (value) => {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
};

function generateSlug(venueName) {
    return venueName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

exports.handler = async function (event, context) {
    console.log('Unified venue submission handler called');
    
    try {
        // Check environment variables
        const envCheck = checkEnvironmentVariables();
        if (!envCheck.success) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: envCheck.message,
                    missing: envCheck.missing
                })
            };
        }
        
        // Initialize services
        const firebaseInit = initializeFirebase();
        const airtableInit = initializeAirtable();
        const cloudinaryInit = initializeCloudinary();
        
        if (!firebaseInit.success) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Firebase initialization error',
                    message: firebaseInit.message,
                    details: firebaseInit.error
                })
            };
        }
        
        if (!airtableInit.success) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Airtable initialization error',
                    message: airtableInit.message,
                    details: airtableInit.error
                })
            };
        }
        
        if (!cloudinaryInit.success) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Cloudinary initialization error',
                    message: cloudinaryInit.message,
                    details: cloudinaryInit.error
                })
            };
        }
        
        const db = firebaseInit.db;
        const base = airtableInit.base;
        const cloudinary = cloudinaryInit.cloudinary;
        
        // Parse form data
        let submission;
        try {
            submission = await parser.parse(event);
        } catch (error) {
            console.error('Error parsing form data:', error);
            return { 
                statusCode: 400, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Error processing form data' })
            };
        }
        
        // Handle image upload
        const photoFile = submission.files.find(f => f.fieldname === 'photo');
        const uploadedImage = await uploadImage(photoFile, cloudinary);
        
        // Determine if submission is from admin form (auto-approves)
        const isFromAdmin = submission['accessibility-rating'] !== undefined || submission['vibe-tags'] !== undefined;
        
        // Generate slug
        const venueName = submission.name || submission['venue-name'];
        const slug = generateSlug(venueName);
        
        // Prepare venue data for both Airtable and Firestore (using only working fields)
        const venueData = {
            // Core fields (confirmed working)
            'Name': venueName,
            'Description': submission.description || '',
            'Address': submission.address || '',
            'Status': isFromAdmin ? 'Approved' : 'Pending Review',
            'Contact Email': submission['contact-email'] || '',
            'Website': submission.website || '',
            'Contact Phone': submission['contact-phone'] || '',
            'Opening Hours': submission['opening-hours'] || '',
            'Accessibility': submission.accessibility || ''
            // Removed 'Listing Status' - using only confirmed working fields
            // Removed 'Slug' - it's a computed field in Airtable
            
            // Additional fields (test these incrementally)
            'Instagram': submission.instagram || '',
            'Facebook': submission.facebook || '',
            'TikTok': submission.tiktok || '',
            'Accessibility Rating': submission['accessibility-rating'] || '',
            'Parking Exception': submission['parking-exception'] || '',
            
            // Tags and features (test these incrementally)
            'Vibe Tags': toArray(submission['vibe-tags']),
            'Venue Features': toArray(submission['venue-features']),
            'Accessibility Features': toArray(submission['accessibility-features']),
            
            // Image information
            'Photo URL': uploadedImage ? uploadedImage.original : null,
            'Photo Medium URL': uploadedImage ? uploadedImage.medium : null,
            'Photo Thumbnail URL': uploadedImage ? uploadedImage.thumbnail : null,
            'Cloudinary Public ID': uploadedImage ? uploadedImage.publicId : null
            // Removed 'Created Time' and 'Last Modified Time' - they are computed fields
        };
        
        // Submit to Airtable
        console.log('Submitting to Airtable...');
        const airtableRecord = await base('Venues').create([{ fields: venueData }]);
        const airtableId = airtableRecord[0].id;
        
        // Prepare Firestore data
        const firestoreData = {
            airtableId: airtableId,
            name: venueData['Name'],
            slug: slug, // Use the generated slug directly
            description: venueData['Description'],
            address: venueData['Address'],
            status: venueData['Status'].toLowerCase(),
            // Removed listingStatus - not using Listing Status field
            
            // Contact information
            website: venueData['Website'],
            instagram: venueData['Instagram'],
            facebook: venueData['Facebook'],
            tiktok: venueData['TikTok'],
            contactEmail: venueData['Contact Email'],
            contactPhone: venueData['Contact Phone'],
            
            // Venue details
            openingHours: venueData['Opening Hours'],
            accessibility: venueData['Accessibility'],
            accessibilityRating: venueData['Accessibility Rating'],
            parkingException: venueData['Parking Exception'],
            
            // Tags and features
            vibeTags: venueData['Vibe Tags'],
            venueFeatures: venueData['Venue Features'],
            accessibilityFeatures: venueData['Accessibility Features'],
            
            // Image information
            photoUrl: venueData['Photo URL'],
            photoMediumUrl: venueData['Photo Medium URL'],
            photoThumbnailUrl: venueData['Photo Thumbnail URL'],
            cloudinaryPublicId: venueData['Cloudinary Public ID'],
            
            // Timestamps
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Submit to Firestore
        console.log('Submitting to Firestore...');
        const firestoreDoc = await db.collection('venues').add(firestoreData);
        
        console.log(`Venue submitted successfully. Airtable ID: ${airtableId}, Firestore ID: ${firestoreDoc.id}`);
        
        // Return different responses based on the originating form
        if (isFromAdmin) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: true, 
                    message: `Venue "${venueData['Name']}" created successfully.`,
                    airtableId: airtableId,
                    firestoreId: firestoreDoc.id
                })
            };
        } else {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: `<!DOCTYPE html>
                <html>
                <head>
                    <title>Venue Submitted Successfully</title>
                    <meta http-equiv="refresh" content="3;url=/all-venues.html">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .success { color: #10B981; }
                        .info { color: #6B7280; }
                    </style>
                </head>
                <body>
                    <h1 class="success">Venue Submitted Successfully!</h1>
                    <p>Your venue "${venueData['Name']}" has been submitted for review.</p>
                    <p class="info">You will be redirected to the venues page shortly.</p>
                    <p class="info">Airtable ID: ${airtableId}</p>
                    <p class="info">Firestore ID: ${firestoreDoc.id}</p>
                </body>
                </html>`
            };
        }
        
    } catch (error) {
        console.error('Error in unified venue submission:', error);
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