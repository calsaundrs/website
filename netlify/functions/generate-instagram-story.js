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
    console.log("=== GENERATE INSTAGRAM STORY FUNCTION CALLED ===");
    
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
        
        console.log(`Generating Instagram story for event: ${eventData['Event Name'] || eventData.name}`);
        
        // Return event data for client-side processing
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600'
            },
            body: JSON.stringify({
                success: true,
                eventData: {
                    name: eventData['Event Name'] || eventData.name || 'Event',
                    date: eventData['Date'] || eventData.date,
                    time: eventData['Time'] || eventData.time || eventData.startTime,
                    venue: eventData['Venue Name'] || eventData.venueName || 'Venue TBC',
                    image: eventData.image?.url || eventData.promoImage || null,
                    categories: eventData.category || eventData.categories || [],
                    description: eventData['Description'] || eventData.description || ''
                }
            })
        };
        
    } catch (error) {
        console.error('Error generating Instagram story:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to generate Instagram story',
                message: error.message
            })
        };
    }
};
    
    // Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Background image if available
    if (eventImage) {
        try {
            const img = await loadImage(eventImage);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Dark overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } catch (error) {
            console.log('Background image failed, using gradient');
            // Fallback gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#1f2937');
            gradient.addColorStop(0.5, '#8B5CF6');
            gradient.addColorStop(1, '#E83A99');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    } else {
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#1f2937');
        gradient.addColorStop(0.5, '#8B5CF6');
        gradient.addColorStop(1, '#E83A99');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Text setup
    ctx.textAlign = 'center';
    
    // BRUM OUTLOUD header
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('BRUM OUTLOUD', canvas.width / 2, 200);
    
    // Subtitle
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('LGBTQ+ EVENTS IN BIRMINGHAM', canvas.width / 2, 250);
    
    // Date and time
    if (eventDate) {
        const date = new Date(eventDate);
        const dateStr = date.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        }).toUpperCase();
        
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(dateStr, canvas.width / 2 - 100, 350);
    }
    
    if (eventTime) {
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#E83A99';
        ctx.fillText(eventTime, canvas.width / 2 + 100, 350);
    }
    
    // Event name
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(eventName.toUpperCase(), canvas.width / 2, canvas.height - 400);
    
    // Venue
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(venueName, canvas.width / 2, canvas.height - 320);
    
    // Categories
    if (categories.length > 0) {
        const categoryText = categories.slice(0, 3).join(' • ');
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#E83A99';
        ctx.fillText(categoryText, canvas.width / 2, canvas.height - 240);
    }
    
    // Website
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#E83A99';
    ctx.fillText('BRUMOUTLOUD.CO.UK', canvas.width / 2, canvas.height - 100);
    
    // Bottom bar
    ctx.fillStyle = '#E83A99';
    ctx.fillRect(0, canvas.height - 8, canvas.width, 8);
    
    return canvas.toBuffer('image/png');
}

