const Airtable = require('airtable');
const admin = require('firebase-admin');

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

exports.handler = async function (event, context) {
    console.log('Unified update item status handler called');
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const body = JSON.parse(event.body);
        const { itemId, itemType, newStatus, adminEmail, notes } = body;
        
        console.log(`Updating ${itemType} ${itemId} to status: ${newStatus}`);
        
        if (!itemId || !itemType || !newStatus) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields: itemId, itemType, newStatus' })
            };
        }
        
        let result;
        
        if (itemType === 'event') {
            result = await updateEventStatus(itemId, newStatus, adminEmail, notes);
        } else if (itemType === 'venue') {
            result = await updateVenueStatus(itemId, newStatus, adminEmail, notes);
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid itemType. Must be "event" or "venue"' })
            };
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                message: `${itemType} status updated successfully`,
                result: result
            })
        };
        
    } catch (error) {
        console.error('Error updating item status:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Failed to update item status',
                message: error.message
            })
        };
    }
};

async function updateEventStatus(itemId, newStatus, adminEmail, notes) {
    console.log(`Updating event ${itemId} to status: ${newStatus}`);
    
    const updateData = {
        'Status': newStatus === 'approved' ? 'Approved' : 'Rejected',
        'Last Modified Time': new Date().toISOString()
    };
    
    if (notes) {
        updateData['Admin Notes'] = notes;
    }
    
    // Update Airtable
    console.log('Updating Airtable...');
    await base('Events').update(itemId, updateData);
    
    // Find and update Firestore document
    console.log('Finding Firestore document...');
    const firestoreQuery = await db.collection('events')
        .where('airtableId', '==', itemId)
        .limit(1)
        .get();
    
    if (firestoreQuery.empty) {
        console.log('No Firestore document found for this Airtable ID');
        return { airtableUpdated: true, firestoreUpdated: false };
    }
    
    const firestoreDoc = firestoreQuery.docs[0];
    const firestoreUpdateData = {
        status: newStatus,
        updatedAt: new Date(),
        approvedBy: adminEmail,
        approvedAt: new Date()
    };
    
    if (notes) {
        firestoreUpdateData.adminNotes = notes;
    }
    
    console.log('Updating Firestore...');
    await firestoreDoc.ref.update(firestoreUpdateData);
    
    return {
        airtableUpdated: true,
        firestoreUpdated: true,
        firestoreId: firestoreDoc.id
    };
}

async function updateVenueStatus(itemId, newStatus, adminEmail, notes) {
    console.log(`Updating venue ${itemId} to status: ${newStatus}`);
    
    const updateData = {
        'Status': newStatus === 'approved' ? 'Approved' : 'Rejected',
        'Listing Status': newStatus === 'approved' ? 'Listed' : 'Rejected',
        'Last Modified Time': new Date().toISOString()
    };
    
    if (notes) {
        updateData['Admin Notes'] = notes;
    }
    
    // Update Airtable
    console.log('Updating Airtable...');
    await base('Venues').update(itemId, updateData);
    
    // Find and update Firestore document
    console.log('Finding Firestore document...');
    const firestoreQuery = await db.collection('venues')
        .where('airtableId', '==', itemId)
        .limit(1)
        .get();
    
    if (firestoreQuery.empty) {
        console.log('No Firestore document found for this Airtable ID');
        return { airtableUpdated: true, firestoreUpdated: false };
    }
    
    const firestoreDoc = firestoreQuery.docs[0];
    const firestoreUpdateData = {
        status: newStatus,
        listingStatus: newStatus === 'approved' ? 'listed' : 'rejected',
        updatedAt: new Date(),
        approvedBy: adminEmail,
        approvedAt: new Date()
    };
    
    if (notes) {
        firestoreUpdateData.adminNotes = notes;
    }
    
    console.log('Updating Firestore...');
    await firestoreDoc.ref.update(firestoreUpdateData);
    
    return {
        airtableUpdated: true,
        firestoreUpdated: true,
        firestoreId: firestoreDoc.id
    };
}