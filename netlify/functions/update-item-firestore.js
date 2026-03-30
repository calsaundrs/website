const admin = require('firebase-admin');
const multipart = require('lambda-multipart-parser');
const cloudinary = require('cloudinary').v2;

exports.handler = async function (event, context) {
    console.log('Firestore item update called');

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

        // Parse request body - handle both JSON and multipart/form-data
        let body;
        let imageFile = null;
        const headers = event.headers || {};
        const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();

        if (contentType.includes('multipart/form-data')) {
            const parsed = await multipart.parse(event);
            const { files = [], ...fields } = parsed || {};

            // The admin panel sends JSON data in a 'data' field
            if (fields.data) {
                body = JSON.parse(fields.data);
            } else {
                body = fields;
            }

            // Find uploaded image file
            imageFile = files.find(f => f.fieldname === 'image' || f.fieldname === 'photo') || files[0];
            if (imageFile && imageFile.content && imageFile.content.length) {
                console.log('Image file found:', {
                    fieldname: imageFile.fieldname,
                    filename: imageFile.filename,
                    contentType: imageFile.contentType,
                    contentLength: imageFile.content.length
                });
            } else {
                imageFile = null;
            }
        } else {
            body = JSON.parse(event.body);
        }

        const { itemId, itemType, ...updateData } = body;
        
        if (!itemId || !itemType) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing required parameters',
                    message: 'itemId and itemType are required'
                })
            };
        }
        
        console.log(`Updating ${itemType} ${itemId} with data:`, updateData);
        
        // Determine collection based on item type
        const collection = itemType === 'venue' ? 'venues' : 'events';
        
        // Get the document reference
        const docRef = db.collection(collection).doc(itemId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Item not found',
                    message: `${itemType} with ID ${itemId} not found`
                })
            };
        }
        
        // Prepare update data based on item type
        const updateFields = {
            updatedAt: new Date()
        };
        
        if (itemType === 'event') {
            // Handle event-specific fields with standardized names
            if (updateData.name) updateFields.name = updateData.name;
            if (updateData.description) updateFields.description = updateData.description;
            
            // Handle date and time as separate fields for Firestore
            if (updateData.date) {
                // Store date as a separate field
                updateFields.eventDate = updateData.date;
                
                // If time is provided, store it separately
                if (updateData.time) {
                    updateFields.eventTime = updateData.time;
                    
                    // Also store the combined datetime for sorting/filtering
                    const dateStr = updateData.date;
                    const timeStr = updateData.time;
                    const combinedDateTime = new Date(`${dateStr}T${timeStr}:00+00:00`); // Treat as GMT/UTC
                    updateFields.date = combinedDateTime; // Keep for backward compatibility
                    
                    console.log('Event update - Separate date/time fields:', {
                        eventDate: updateData.date,
                        eventTime: updateData.time,
                        combinedDateTime: combinedDateTime.toISOString()
                    });
                } else {
                    // Only date provided, set time to 00:00 for sorting
                    const combinedDateTime = new Date(`${updateData.date}T00:00:00+00:00`);
                    updateFields.date = combinedDateTime; // Keep for backward compatibility
                    updateFields.eventTime = '00:00';
                }
            }
            
            if (updateData.category) {
                // Handle category as array (already processed by frontend)
                updateFields.category = Array.isArray(updateData.category) ? updateData.category : [updateData.category];
            }
            if (updateData.venueName) updateFields.venueName = updateData.venueName;
            if (updateData.venue && updateData.venue.name) updateFields.venueName = updateData.venue.name;
            if (updateData.link) updateFields.link = updateData.link;
            if (updateData.price) updateFields.price = updateData.price;
            if (updateData.ageRestriction) updateFields.ageRestriction = updateData.ageRestriction;
        } else if (itemType === 'venue') {
            // Handle venue-specific fields
            if (updateData.name) updateFields.name = updateData.name;
            if (updateData.description) updateFields.description = updateData.description;
            if (updateData.address) updateFields.address = updateData.address;
            if (updateData.link) updateFields.link = updateData.link;
            if (updateData.category) {
                // Handle category as array (already processed by frontend)
                updateFields.category = Array.isArray(updateData.category) ? updateData.category : [updateData.category];
            }
        }
        
        // Upload image to Cloudinary if provided
        if (imageFile) {
            try {
                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET,
                });

                const base64Image = `data:${imageFile.contentType};base64,${imageFile.content.toString('base64')}`;
                const folder = itemType === 'venue' ? 'venues' : 'events';
                const uploadResult = await cloudinary.uploader.upload(base64Image, {
                    folder: `brumoutloud/${folder}`,
                    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
                });

                updateFields.image = uploadResult.secure_url;
                console.log('Image uploaded to Cloudinary:', uploadResult.secure_url);
            } catch (uploadError) {
                console.error('Image upload failed:', uploadError.message);
                // Continue without image update rather than failing the whole request
            }
        }

        // Update the document
        await docRef.update(updateFields);
        
        console.log(`Successfully updated ${itemType} ${itemId}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: `${itemType} updated successfully`,
                itemId: itemId,
                itemType: itemType,
                updatedFields: Object.keys(updateFields)
            })
        };
        
    } catch (error) {
        console.error('Error in Firestore item update:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Item update failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};