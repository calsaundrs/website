const admin = require('firebase-admin');
const RecurringEventsManager = require('./services/recurring-events-manager');

exports.handler = async function (event, context) {
    console.log('Convert to recurring event called');
    
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
        const { eventId, recurringPattern, recurringStartDate, recurringEndDate, maxInstances, customRecurrenceDesc } = body;
        
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
        
        if (!recurringPattern) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing recurring pattern',
                    message: 'recurringPattern is required'
                })
            };
        }
        
        console.log(`Converting event ${eventId} to recurring with pattern: ${recurringPattern}`);
        
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
        
        // Check if event is already recurring
        if (eventData.isRecurring || eventData.recurringGroupId || eventData.seriesId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Event is already recurring',
                    message: 'This event is already part of a recurring series'
                })
            };
        }
        
        // Prepare recurring event data - map to RecurringEventsManager expected fields
        const recurringEventData = {
            ...eventData,
            name: eventData.name || eventData.Name,
            description: eventData.description || eventData.Description,
            category: eventData.category || eventData.Category || [],
            venueSlug: eventData.venueSlug || eventData['Venue Slug'],
            venueName: eventData.venueName || eventData['Venue Name'],
            startDate: recurringStartDate || eventData.date, // RecurringEventsManager expects startDate
            endDate: recurringEndDate || null,
            maxInstances: maxInstances ? parseInt(maxInstances) : 52,
            time: eventData.time || '20:00',
            image: eventData.image || eventData.Image,
            link: eventData.link || eventData.Link,
            price: eventData.price || eventData.Price,
            ageRestriction: eventData.ageRestriction || eventData['Age Restriction'],
            recurringPattern: recurringPattern,
            customRecurrenceDesc: customRecurrenceDesc || null
        };
        
        // Create recurring series using the RecurringEventsManager
        const recurringManager = new RecurringEventsManager(db);
        const recurringResult = await recurringManager.createRecurringSeries(recurringEventData);
        
        if (!recurringResult.success) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to create recurring series',
                    message: recurringResult.error
                })
            };
        }
        
        // Update the original event with recurring information
        const updateData = {
            isRecurring: true,
            recurringPattern: recurringPattern,
            recurringStartDate: recurringStartDate || eventData.date,
            recurringEndDate: recurringEndDate || null,
            maxInstances: maxInstances ? parseInt(maxInstances) : null,
            customRecurrenceDesc: customRecurrenceDesc || null,
            recurringGroupId: recurringResult.groupId,
            recurringInstance: 1,
            totalInstances: recurringResult.totalInstances,
            updatedAt: new Date()
        };
        
        await eventRef.update(updateData);
        
        console.log(`Successfully converted event ${eventId} to recurring with ${recurringResult.totalInstances} instances`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Successfully converted event to recurring with ${recurringResult.totalInstances} instances`,
                eventId: eventId,
                groupId: recurringResult.groupId,
                totalInstances: recurringResult.totalInstances,
                instances: recurringResult.instances
            })
        };
        
    } catch (error) {
        console.error('Error converting event to recurring:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to convert event to recurring',
                message: error.message
            })
        };
    }
};
