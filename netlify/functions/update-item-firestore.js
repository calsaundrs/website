const admin = require('firebase-admin');

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
        
        // Parse request body
        const body = JSON.parse(event.body);
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
            // Handle event-specific fields
            if (updateData['event-name']) updateFields.name = updateData['event-name'];
            if (updateData.description) updateFields.description = updateData.description;
            if (updateData.date) {
                // Convert date string to Firestore timestamp
                updateFields.date = new Date(updateData.date);
            }
            if (updateData.category) {
                // Handle category as array
                updateFields.category = updateData.category.split(',').map(cat => cat.trim()).filter(cat => cat);
            }
            if (updateData['venue-name']) updateFields.venueName = updateData['venue-name'];
        } else if (itemType === 'venue') {
            // Handle venue-specific fields
            if (updateData.name) updateFields.name = updateData.name;
            if (updateData.description) updateFields.description = updateData.description;
            if (updateData.address) updateFields.address = updateData.address;
            if (updateData.website) updateFields.website = updateData.website;
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