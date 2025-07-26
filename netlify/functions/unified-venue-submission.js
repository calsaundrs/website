const Airtable = require('airtable');
const admin = require('firebase-admin');
const parser = require('lambda-multipart-parser');
const cloudinary = require('cloudinary').v2;

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadImage(file) {
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
    
    let submission;
    try {
        submission = await parser.parse(event);
    } catch (error) {
        console.error('Error parsing form data:', error);
        return { statusCode: 400, body: 'Error processing form data.' };
    }
    
    try {
        // Handle image upload
        const photoFile = submission.files.find(f => f.fieldname === 'photo');
        const uploadedImage = await uploadImage(photoFile);
        
        // Determine if submission is from admin form (auto-approves)
        const isFromAdmin = submission['accessibility-rating'] !== undefined || submission['vibe-tags'] !== undefined;
        
        // Generate slug
        const venueName = submission.name || submission['venue-name'];
        const slug = generateSlug(venueName);
        
        // Prepare venue data for both Airtable and Firestore
        const venueData = {
            // Core fields
            'Name': venueName,
            'Slug': slug,
            'Description': submission.description || '',
            'Address': submission.address || '',
            'Status': isFromAdmin ? 'Approved' : 'Pending Review',
            'Listing Status': isFromAdmin ? 'Listed' : 'Pending Review',
            
            // Contact information
            'Contact Email': submission['contact-email'] || '',
            'Website': submission.website || '',
            'Instagram': submission.instagram || '',
            'Facebook': submission.facebook || '',
            'TikTok': submission.tiktok || '',
            'Contact Phone': submission['contact-phone'] || '',
            
            // Venue details
            'Opening Hours': submission['opening-hours'] || '',
            'Accessibility': submission.accessibility || '',
            'Accessibility Rating': submission['accessibility-rating'] || '',
            'Parking Exception': submission['parking-exception'] || '',
            
            // Tags and features
            'Vibe Tags': toArray(submission['vibe-tags']),
            'Venue Features': toArray(submission['venue-features']),
            'Accessibility Features': toArray(submission['accessibility-features']),
            
            // Image information
            'Photo URL': uploadedImage ? uploadedImage.original : null,
            'Photo Medium URL': uploadedImage ? uploadedImage.medium : null,
            'Photo Thumbnail URL': uploadedImage ? uploadedImage.thumbnail : null,
            'Cloudinary Public ID': uploadedImage ? uploadedImage.publicId : null,
            
            // Timestamps
            'Created Time': new Date().toISOString(),
            'Last Modified Time': new Date().toISOString()
        };
        
        // Submit to Airtable
        console.log('Submitting to Airtable...');
        const airtableRecord = await base('Venues').create([{ fields: venueData }]);
        const airtableId = airtableRecord[0].id;
        
        // Prepare Firestore data
        const firestoreData = {
            airtableId: airtableId,
            name: venueData['Name'],
            slug: venueData['Slug'],
            description: venueData['Description'],
            address: venueData['Address'],
            status: venueData['Status'].toLowerCase(),
            listingStatus: venueData['Listing Status'].toLowerCase(),
            
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
            body: `<!DOCTYPE html>
            <html>
            <body>
                <h1>Submission Error</h1>
                <p>An error occurred while submitting your venue. Please try again.</p>
                <pre style="display:none;">${error.toString()}</pre>
            </body>
            </html>`
        };
    }
};