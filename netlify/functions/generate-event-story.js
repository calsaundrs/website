const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
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

exports.handler = async (event, context) => {
    console.log("=== GENERATE EVENT STORY FUNCTION CALLED ===");
    
    try {
        // Parse request
        const { eventId, eventSlug } = JSON.parse(event.body || '{}');
        
        if (!eventId && !eventSlug) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing eventId or eventSlug parameter'
                })
            };
        }
        
        // Fetch event data
        let eventData = null;
        if (eventId) {
            const eventDoc = await db.collection('events').doc(eventId).get();
            if (eventDoc.exists) {
                eventData = { id: eventDoc.id, ...eventDoc.data() };
            }
        } else if (eventSlug) {
            const eventsRef = db.collection('events');
            const query = eventsRef.where('slug', '==', eventSlug);
            const snapshot = await query.get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                eventData = { id: doc.id, ...doc.data() };
            }
        }
        
        if (!eventData) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Event not found'
                })
            };
        }
        
        console.log(`Preparing story data for event: ${eventData['Event Name'] || eventData.name}`);
        
        // Prepare story data for client-side generation
        const storyData = prepareStoryData(eventData);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600'
            },
            body: JSON.stringify({
                success: true,
                storyData: storyData,
                eventId: eventData.id,
                eventSlug: eventData.slug
            })
        };
        
    } catch (error) {
        console.error('Error generating event story:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to generate event story',
                message: error.message
            })
        };
    }
};

function prepareStoryData(eventData) {
    // Extract event data
    const eventName = eventData['Event Name'] || eventData.name || 'Event';
    const eventDate = eventData['Date'] || eventData.date;
    const eventTime = eventData['Time'] || eventData.time || eventData.startTime;
    const doorsTime = eventData['Doors'] || eventData.doors || eventData.doorsTime;
    const eventDescription = eventData['Description'] || eventData.description || '';
    const venueName = eventData['Venue Name'] || eventData.venueName || 'Venue TBC';
    const eventImage = eventData.image?.url || eventData.promoImage || null;
    const categories = eventData.category || eventData.categories || [];
    
    // Format date
    let formattedDate = '';
    if (eventDate) {
        const date = new Date(eventDate);
        formattedDate = date.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
    
    // Format time
    let formattedTime = '';
    if (eventTime) {
        // Handle different time formats
        if (typeof eventTime === 'string') {
            formattedTime = eventTime;
        } else if (eventTime instanceof Date) {
            formattedTime = eventTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
    }
    
    // Format doors time
    let formattedDoorsTime = '';
    if (doorsTime) {
        if (typeof doorsTime === 'string') {
            formattedDoorsTime = doorsTime;
        } else if (doorsTime instanceof Date) {
            formattedDoorsTime = doorsTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
    }
    
    // Prepare category text
    const categoryText = categories.slice(0, 3).join(' • ');
    
    return {
        eventName: eventName,
        eventDate: formattedDate,
        eventTime: formattedTime,
        doorsTime: formattedDoorsTime,
        eventDescription: eventDescription,
        venueName: venueName,
        eventImage: eventImage,
        categories: categories,
        categoryText: categoryText,
        eventSlug: eventData.slug,
        eventId: eventData.id
    };
}
