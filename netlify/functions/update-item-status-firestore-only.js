const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Firestore-only status update called');
    
    try {
        // Check environment variables (no Airtable needed)
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
        const { itemId, newStatus, itemType } = body;
        
        if (!itemId || !newStatus || !itemType) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing required parameters',
                    message: 'itemId, newStatus, and itemType are required'
                })
            };
        }
        
        console.log(`Updating ${itemType} ${itemId} to status: ${newStatus}`);
        
        // Determine collection based on item type
        const collection = itemType === 'venue' ? 'venues' : 'events';
        
        // Update status in Firestore
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
        
        // Update the document
        await docRef.update({
            status: newStatus.toLowerCase(),
            updatedAt: new Date()
        });
        
        console.log(`Successfully updated ${itemType} ${itemId} to status: ${newStatus}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: `${itemType} status updated successfully`,
                itemId: itemId,
                newStatus: newStatus,
                itemType: itemType,
                note: 'This update was processed using Firestore only'
            })
        };
        
    } catch (error) {
        console.error('Error in Firestore-only status update:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Status update failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};