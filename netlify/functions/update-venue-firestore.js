const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
const multipart = require('lambda-multipart-parser');

exports.handler = async function (event, context) {
    console.log('Venue update function called');
    
    // Add global error handler to prevent unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
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
        
        // Parse request body using lambda-multipart-parser
        let body;
        let imageFile = null;
        
        console.log('Request headers:', event.headers);
        console.log('Request body type:', typeof event.body);
        console.log('Body length:', event.body ? event.body.length : 'undefined');
        console.log('Is base64 encoded:', event.isBase64Encoded);
        
        try {
            const headers = event.headers || {};
            const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
            
            if (contentType.includes('multipart/form-data')) {
                const parsed = await multipart.parse(event);
                const { files = [], ...fields } = parsed || {};
                body = fields || {};
                
                // Find the photo file
                imageFile = files.find(f => f.fieldname === 'photo' || f.name === 'photo') || files[0];
                if (imageFile && imageFile.content && imageFile.content.length) {
                    console.log('Photo file found:', {
                        fieldname: imageFile.fieldname,
                        filename: imageFile.filename,
                        contentType: imageFile.contentType,
                        contentLength: imageFile.content.length
                    });
                } else {
                    console.log('No photo file found in upload');
                }
            } else if (contentType.includes('application/json')) {
                body = JSON.parse(event.body);
            } else {
                // Fallback: try urlencoded
                const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
                const params = new URLSearchParams(rawBody);
                body = {};
                for (const [key, value] of params) {
                    body[key] = value;
                }
            }
            
            console.log('Parsed fields:', Object.keys(body));
            console.log('Sample field values:', {
                venueId: body.venueId,
                id: body.id,
                name: body.name,
                address: body.address
            });
            
        } catch (parseError) {
            console.error('Error parsing form data:', parseError);
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Failed to parse form data',
                    message: parseError.message
                })
            };
        }
        
        // Extract venueId from either body or fields
        const venueId = body.venueId || body.id;
        
        if (!venueId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing required parameters',
                    message: 'venueId is required',
                    receivedBody: body
                })
            };
        }
        
        // Remove venueId from updateData to avoid conflicts
        const { venueId: _, id: __, ...updateData } = body;
        
        console.log(`Updating venue ${venueId} with data:`, updateData);
        
        // Get the venue document
        const venueRef = db.collection('venues').doc(venueId);
        const venueDoc = await venueRef.get();
        
        if (!venueDoc.exists) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Venue not found',
                    message: `Venue with ID ${venueId} not found`
                })
            };
        }
        
        // Handle image upload if present
        let uploadedImage = null;
        if (imageFile && imageFile.content && imageFile.content.length > 100) {
            console.log('Photo file detected, attempting upload...');
            console.log('Photo file info:', {
                filename: imageFile.filename,
                contentLength: imageFile.content.length,
                contentType: imageFile.contentType || 'image/jpeg'
            });
            
            try {
                // Convert buffer to base64 string for Cloudinary (same as event submission)
                const base64Image = imageFile.content.toString('base64');
                const dataURI = `data:${imageFile.contentType || 'image/jpeg'};base64,${base64Image}`;
                
                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: 'brumoutloud_venues',
                    transformation: [
                        { width: 800, height: 400, crop: 'fill' },
                        { quality: 'auto' }
                    ]
                });
                
                uploadedImage = {
                    url: result.secure_url,
                    publicId: result.public_id
                };
                console.log('Venue image uploaded successfully:', uploadedImage.url);
            } catch (uploadError) {
                console.error('Error uploading venue image:', uploadError);
                console.error('Upload error details:', {
                    message: uploadError.message,
                    http_code: uploadError.http_code,
                    name: uploadError.name
                });
                // Continue without image - don't fail the update
                uploadedImage = null;
            }
        } else {
            console.log('No photo file found in upload');
        }
        
        // Prepare update fields
        const updateFields = {
            updatedAt: new Date()
        };
        
        // Basic venue fields with proper field name mapping
        if (updateData.name) updateFields.name = updateData.name;
        if (updateData.description) updateFields.description = updateData.description;
        if (updateData.address) updateFields.address = updateData.address;
        if (updateData.website) updateFields.website = updateData.website;
        if (updateData.instagram) updateFields.instagram = updateData.instagram;
        if (updateData.facebook) updateFields.facebook = updateData.facebook;
        if (updateData.tiktok) updateFields.tiktok = updateData.tiktok;
        if (updateData['contact-email'] || updateData.contactEmail) updateFields.contactEmail = updateData['contact-email'] || updateData.contactEmail;
        if (updateData['contact-phone'] || updateData.contactPhone) updateFields.contactPhone = updateData['contact-phone'] || updateData.contactPhone;
        if (updateData['opening-hours'] || updateData.openingHours) updateFields.openingHours = updateData['opening-hours'] || updateData.openingHours;
        if (updateData.accessibility) updateFields.accessibility = updateData.accessibility;
        if (updateData['accessibility-rating'] || updateData.accessibilityRating) updateFields.accessibilityRating = updateData['accessibility-rating'] || updateData.accessibilityRating;
        if (updateData['parking-exception'] || updateData.parkingException) updateFields.parkingException = updateData['parking-exception'] || updateData.parkingException;
        if (updateData.status) updateFields.status = updateData.status;
        
        // Handle array fields with proper field name mapping
        if (updateData['vibe-tags'] || updateData.vibeTags) {
            const vibeTagsData = updateData['vibe-tags'] || updateData.vibeTags;
            updateFields.vibeTags = typeof vibeTagsData === 'string' 
                ? vibeTagsData.split(',').map(tag => tag.trim()) 
                : vibeTagsData;
        }
        if (updateData['venue-features'] || updateData.venueFeatures) {
            const venueFeaturesData = updateData['venue-features'] || updateData.venueFeatures;
            updateFields.venueFeatures = typeof venueFeaturesData === 'string' 
                ? venueFeaturesData.split(',').map(feature => feature.trim()) 
                : venueFeaturesData;
        }
        if (updateData['accessibility-features'] || updateData.accessibilityFeatures) {
            const accessibilityFeaturesData = updateData['accessibility-features'] || updateData.accessibilityFeatures;
            updateFields.accessibilityFeatures = typeof accessibilityFeaturesData === 'string' 
                ? accessibilityFeaturesData.split(',').map(feature => feature.trim()) 
                : accessibilityFeaturesData;
        }
        
        // Handle image fields
        if (uploadedImage) {
            updateFields.photoUrl = uploadedImage.url;
            updateFields.cloudinaryPublicId = uploadedImage.publicId;
        }
        
        // Update slug if name changed
        if (updateData.name) {
            const generateSlug = (name) => {
                return name.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
            };
            updateFields.slug = generateSlug(updateData.name);
        }
        
        // Update the venue
        await venueRef.update(updateFields);
        
        console.log(`Successfully updated venue ${venueId}`);
        console.log('Updated fields:', updateFields);
        
        // Verify the update by fetching the updated document
        const updatedDoc = await venueRef.get();
        const updatedData = updatedDoc.data();
        console.log('Updated venue data:', {
            name: updatedData.name,
            photoUrl: updatedData.photoUrl,
            cloudinaryPublicId: updatedData.cloudinaryPublicId,
            image: updatedData.image
        });
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Venue updated successfully',
                venueId: venueId,
                updatedFields: Object.keys(updateFields),
                imageUploaded: !!uploadedImage
            })
        };
        
    } catch (error) {
        console.error('Error in venue update:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Venue update failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};
