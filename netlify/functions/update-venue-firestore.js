const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

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
        
        // Parse request body
        let body;
        let files = {};
        
        console.log('Request headers:', event.headers);
        console.log('Request body type:', typeof event.body);
        console.log('Body length:', event.body ? event.body.length : 'undefined');
        console.log('Is base64 encoded:', event.isBase64Encoded);
        
        if (event.headers['content-type'] && event.headers['content-type'].includes('multipart/form-data')) {
            // Handle multipart form data
            const boundary = event.headers['content-type'].split('boundary=')[1];
            let decodedBody = event.body;
            
            if (event.isBase64Encoded) {
                decodedBody = Buffer.from(event.body, 'base64').toString('utf8');
            }
            
            const parts = decodedBody.split(`--${boundary}`);
            console.log('Multipart parsing - Number of parts:', parts.length);
            console.log('First part preview:', parts[0] ? parts[0].substring(0, 200) : 'No parts');
            
            const fields = {};
            
            for (const part of parts) {
                if (part.includes('Content-Disposition: form-data')) {
                    const nameMatch = part.match(/name="([^"]+)"/);
                    if (nameMatch) {
                        const fieldName = nameMatch[1];
                        const filenameMatch = part.match(/filename="([^"]+)"/);
                        
                        if (filenameMatch) {
                            // This is a file
                            const filename = filenameMatch[1];
                            
                            // Extract content type
                            const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
                            const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';
                            
                            const contentStart = part.indexOf('\r\n\r\n') + 4;
                            const contentEnd = part.lastIndexOf('\r\n');
                            
                            if (contentStart > 3 && contentEnd > contentStart) {
                                const fileContent = part.substring(contentStart, contentEnd);
                                console.log(`File parsed: ${fieldName}`, {
                                    filename: filename,
                                    contentType: contentType,
                                    contentLength: fileContent.length,
                                    contentPreview: fileContent.substring(0, 50)
                                });
                                files[fieldName] = {
                                    filename: filename,
                                    contentType: contentType,
                                    content: fileContent
                                };
                            }
                        } else {
                            // This is a text field
                            const valueMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/);
                            if (valueMatch) {
                                fields[fieldName] = valueMatch[1].trim();
                            }
                        }
                    }
                }
            }
            
            body = fields;
            console.log('Parsed multipart fields:', Object.keys(body));
            console.log('Sample field values:', {
                venueId: body.venueId,
                id: body.id,
                name: body.name,
                address: body.address
            });
        } else {
            // Handle JSON data
            body = JSON.parse(event.body);
            console.log('Parsed JSON body:', Object.keys(body));
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
        if (files.photo && files.photo.content) {
            console.log('Photo file detected, attempting upload...');
            console.log('Photo file info:', {
                filename: files.photo.filename,
                contentLength: files.photo.content.length,
                contentType: files.photo.contentType || 'unknown'
            });
            
            // Validate that we have actual image content
            if (!files.photo.content || files.photo.content.length < 100) {
                console.log('Skipping image upload - content too small or empty');
            } else {
                try {
                    // The content is raw binary data, not base64 encoded
                    // We need to convert it to base64 first
                    const base64Content = Buffer.from(files.photo.content, 'binary').toString('base64');
                    console.log('Content analysis:', {
                        originalLength: files.photo.content.length,
                        base64Length: base64Content.length,
                        contentStart: base64Content.substring(0, 50),
                        contentEnd: base64Content.substring(base64Content.length - 50)
                    });
                    
                    // Convert binary content to Buffer for upload_stream
                    const imageBuffer = Buffer.from(files.photo.content, 'binary');
                    console.log('Image buffer created, length:', imageBuffer.length);
                    
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            {
                                folder: 'brumoutloud_venues',
                                transformation: [
                                    { width: 800, height: 400, crop: 'fill' },
                                    { quality: 'auto' }
                                ]
                            },
                            (error, result) => {
                                if (error) {
                                    console.error('Cloudinary upload error:', error);
                                    reject(error);
                                } else {
                                    console.log('Cloudinary upload success:', result);
                                    resolve(result);
                                }
                            }
                        );
                        
                        // Write the buffer to the upload stream
                        uploadStream.end(imageBuffer);
                    });
                    
                    uploadedImage = {
                        url: uploadResult.secure_url,
                        publicId: uploadResult.public_id
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
            }
        } else {
            console.log('No photo file found in upload');
        }
        
        // Prepare update fields
        const updateFields = {
            updatedAt: new Date()
        };
        
        // Basic venue fields
        if (updateData.name) updateFields.name = updateData.name;
        if (updateData.description) updateFields.description = updateData.description;
        if (updateData.address) updateFields.address = updateData.address;
        if (updateData.website) updateFields.website = updateData.website;
        if (updateData.instagram) updateFields.instagram = updateData.instagram;
        if (updateData.facebook) updateFields.facebook = updateData.facebook;
        if (updateData.tiktok) updateFields.tiktok = updateData.tiktok;
        if (updateData.contactEmail) updateFields.contactEmail = updateData.contactEmail;
        if (updateData.contactPhone) updateFields.contactPhone = updateData.contactPhone;
        if (updateData.openingHours) updateFields.openingHours = updateData.openingHours;
        if (updateData.accessibility) updateFields.accessibility = updateData.accessibility;
        if (updateData.accessibilityRating) updateFields.accessibilityRating = updateData.accessibilityRating;
        if (updateData.parkingException) updateFields.parkingException = updateData.parkingException;
        if (updateData.status) updateFields.status = updateData.status;
        
        // Handle array fields
        if (updateData.vibeTags) {
            updateFields.vibeTags = typeof updateData.vibeTags === 'string' 
                ? updateData.vibeTags.split(',').map(tag => tag.trim()) 
                : updateData.vibeTags;
        }
        if (updateData.venueFeatures) {
            updateFields.venueFeatures = typeof updateData.venueFeatures === 'string' 
                ? updateData.venueFeatures.split(',').map(feature => feature.trim()) 
                : updateData.venueFeatures;
        }
        if (updateData.accessibilityFeatures) {
            updateFields.accessibilityFeatures = typeof updateData.accessibilityFeatures === 'string' 
                ? updateData.accessibilityFeatures.split(',').map(feature => feature.trim()) 
                : updateData.accessibilityFeatures;
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
