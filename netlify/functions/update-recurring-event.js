const admin = require('firebase-admin');
const RecurringEventsManager = require('./services/recurring-events-manager');

exports.handler = async function (event, context) {
    console.log('Update recurring event called');
    
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

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
        const { 
            eventId, 
            isRecurring, 
            recurringPattern, 
            recurringDay,
            recurringInfo, 
            recurringStartDate, 
            recurringEndDate, 
            totalInstances,
            recurringInstance,
            updateSeries = false // Whether to update all instances in the series
        } = body;
        
        if (!eventId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required parameters',
                    message: 'eventId is required'
                })
            };
        }
        
        console.log(`Updating event ${eventId} recurring settings`);
        
        // Get the event document
        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await eventRef.get();
        
        if (!eventDoc.exists) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Event not found',
                    message: `Event with ID ${eventId} not found`
                })
            };
        }
        
        const eventData = eventDoc.data();
        
        // Prepare update data
        const updateData = {
            isRecurring: isRecurring || false,
            updatedAt: new Date()
        };
        
        if (isRecurring) {
            updateData.recurringPattern = recurringPattern || null;
            updateData.recurringDay = recurringDay || null;
            updateData.recurringInfo = recurringInfo || null;
            updateData.recurringStartDate = recurringStartDate || null;
            updateData.recurringEndDate = recurringEndDate || null;
            updateData.totalInstances = totalInstances ? parseInt(totalInstances) : null;
            updateData.recurringInstance = recurringInstance ? parseInt(recurringInstance) : null;
        } else {
            // If turning off recurring, clear recurring fields
            updateData.recurringPattern = null;
            updateData.recurringDay = null;
            updateData.recurringInfo = null;
            updateData.recurringStartDate = null;
            updateData.recurringEndDate = null;
            updateData.totalInstances = null;
            updateData.recurringInstance = null;
            updateData.recurringGroupId = null;
        }
        
        // Update the event
        await eventRef.update(updateData);
        
        // If this is a recurring event and we want to update the series
        if (isRecurring && updateSeries && eventData.recurringGroupId) {
            const recurringManager = new RecurringEventsManager(db);
            
            // Get all instances in the series
            const instances = await recurringManager.getRecurringSeriesInstances(eventData.recurringGroupId, { futureOnly: false });
            
            // Update all instances with the new recurring settings
            const batch = db.batch();
            instances.forEach(instance => {
                const instanceRef = db.collection('events').doc(instance.id);
                batch.update(instanceRef, {
                    recurringPattern: recurringPattern || null,
                    recurringDay: recurringDay || null,
                    recurringInfo: recurringInfo || null,
                    recurringStartDate: recurringStartDate || null,
                    recurringEndDate: recurringEndDate || null,
                    totalInstances: totalInstances ? parseInt(totalInstances) : null,
                    updatedAt: new Date()
                });
            });
            
            await batch.commit();
            
            console.log(`Updated ${instances.length} instances in series ${eventData.recurringGroupId}`);
        }
        
        console.log(`Successfully updated event ${eventId} recurring settings`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Successfully updated recurring event settings',
                eventId: eventId,
                updatedFields: Object.keys(updateData)
            })
        };
        
    } catch (error) {
        console.error('Error updating recurring event:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to update recurring event',
                message: error.message
            })
        };
    }
};
