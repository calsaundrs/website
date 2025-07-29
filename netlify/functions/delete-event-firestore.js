const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Delete event from Firestore called');
    
    try {
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
        const { eventId, deleteSeries } = body;
        
        if (!eventId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required parameters',
                    message: 'eventId is required'
                })
            };
        }
        
        console.log(`Deleting event ${eventId}, deleteSeries: ${deleteSeries}`);
        
        // Get the event document
        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await eventRef.get();
        
        if (!eventDoc.exists) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Event not found',
                    message: `Event with ID ${eventId} not found`
                })
            };
        }
        
        const eventData = eventDoc.data();
        const isRecurring = eventData.isRecurring || eventData.recurringGroupId || eventData.seriesId;
        
        // If it's a recurring event and deleteSeries is true, delete all instances
        if (isRecurring && deleteSeries) {
            const recurringGroupId = eventData.recurringGroupId || eventData.seriesId;
            
            if (recurringGroupId) {
                console.log(`Deleting entire recurring series: ${recurringGroupId}`);
                
                // Find all events in the series
                const seriesQuery = db.collection('events')
                    .where('recurringGroupId', '==', recurringGroupId);
                
                const seriesSnapshot = await seriesQuery.get();
                const batch = db.batch();
                let deletedCount = 0;
                
                seriesSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                    deletedCount++;
                });
                
                await batch.commit();
                
                console.log(`Deleted ${deletedCount} events from series ${recurringGroupId}`);
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        success: true,
                        message: `Successfully deleted recurring series with ${deletedCount} events`,
                        deletedCount: deletedCount,
                        seriesId: recurringGroupId
                    })
                };
            }
        }
        
        // Delete single event
        await eventRef.delete();
        
        console.log(`Successfully deleted event ${eventId}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Event deleted successfully',
                eventId: eventId
            })
        };
        
    } catch (error) {
        console.error('Error deleting event:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: `Failed to delete event: ${error.message}`
            })
        };
    }
}; 