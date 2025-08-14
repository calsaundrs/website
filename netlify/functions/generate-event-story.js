const admin = require('firebase-admin');
const { createCanvas, loadImage, registerFont } = require('canvas');

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

// Instagram Story dimensions (9:16 aspect ratio)
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

// Site colors and styling
const COLORS = {
    background: '#0f172a', // Dark blue background
    primary: '#e83a9b', // Pink accent
    secondary: '#B564F7', // Purple
    white: '#ffffff',
    gray: '#d1d5db',
    darkGray: '#6b7280'
};

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
        
        console.log(`Generating story for event: ${eventData['Event Name'] || eventData.name}`);
        
        // Generate the story image
        const imageBuffer = await generateEventStory(eventData);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=3600',
                'Content-Disposition': `inline; filename="event-story-${eventData.slug || eventData.id}.png"`
            },
            body: imageBuffer.toString('base64'),
            isBase64Encoded: true
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

async function generateEventStory(eventData) {
    // Create canvas
    const canvas = createCanvas(STORY_WIDTH, STORY_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Extract event data
    const eventName = eventData['Event Name'] || eventData.name || 'Event';
    const eventDate = eventData['Date'] || eventData.date;
    const eventDescription = eventData['Description'] || eventData.description || '';
    const venueName = eventData['Venue Name'] || eventData.venueName || 'Venue TBC';
    const eventImage = eventData.image?.url || eventData.promoImage || null;
    const categories = eventData.category || eventData.categories || [];
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
    gradient.addColorStop(0, COLORS.background);
    gradient.addColorStop(0.5, '#1e293b');
    gradient.addColorStop(1, COLORS.background);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
    
    // Add subtle pattern overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < STORY_WIDTH; i += 40) {
        for (let j = 0; j < STORY_HEIGHT; j += 40) {
            if ((i + j) % 80 === 0) {
                ctx.fillRect(i, j, 20, 20);
            }
        }
    }
    
    // Event image (if available)
    if (eventImage) {
        try {
            const image = await loadImage(eventImage);
            
            // Create a circular mask for the image
            const imageSize = 400;
            const imageX = (STORY_WIDTH - imageSize) / 2;
            const imageY = 200;
            
            // Draw circular background
            ctx.save();
            ctx.beginPath();
            ctx.arc(imageX + imageSize/2, imageY + imageSize/2, imageSize/2 + 10, 0, 2 * Math.PI);
            ctx.fillStyle = COLORS.primary;
            ctx.fill();
            
            // Clip to circle
            ctx.beginPath();
            ctx.arc(imageX + imageSize/2, imageY + imageSize/2, imageSize/2, 0, 2 * Math.PI);
            ctx.clip();
            
            // Draw image
            ctx.drawImage(image, imageX, imageY, imageSize, imageSize);
            ctx.restore();
            
        } catch (error) {
            console.log('Could not load event image, using placeholder');
            // Draw placeholder circle
            ctx.save();
            ctx.beginPath();
            ctx.arc(STORY_WIDTH/2, 400, 200, 0, 2 * Math.PI);
            ctx.fillStyle = COLORS.primary;
            ctx.fill();
            ctx.restore();
        }
    } else {
        // Draw placeholder circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(STORY_WIDTH/2, 400, 200, 0, 2 * Math.PI);
        ctx.fillStyle = COLORS.primary;
        ctx.fill();
        ctx.restore();
    }
    
    // Event name
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    
    // Wrap text if too long
    const maxWidth = STORY_WIDTH - 100;
    const words = eventName.split(' ');
    let lines = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);
    
    // Draw event name lines
    const nameY = eventImage ? 650 : 450;
    lines.forEach((line, index) => {
        ctx.fillText(line, STORY_WIDTH/2, nameY + (index * 60));
    });
    
    // Date
    if (eventDate) {
        const date = new Date(eventDate);
        const formattedDate = date.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        ctx.fillStyle = COLORS.gray;
        ctx.font = '24px Arial';
        ctx.fillText(formattedDate, STORY_WIDTH/2, nameY + (lines.length * 60) + 40);
    }
    
    // Venue
    ctx.fillStyle = COLORS.secondary;
    ctx.font = 'bold 28px Arial';
    ctx.fillText(venueName, STORY_WIDTH/2, nameY + (lines.length * 60) + 80);
    
    // Categories
    if (categories.length > 0) {
        const categoryY = nameY + (lines.length * 60) + 140;
        ctx.fillStyle = COLORS.white;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        
        const categoryText = categories.slice(0, 3).join(' • ');
        ctx.fillText(categoryText, STORY_WIDTH/2, categoryY);
    }
    
    // Bottom section with gradient
    const bottomGradient = ctx.createLinearGradient(0, STORY_HEIGHT - 300, 0, STORY_HEIGHT);
    bottomGradient.addColorStop(0, 'transparent');
    bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, STORY_HEIGHT - 300, STORY_WIDTH, 300);
    
    // Website branding
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BRUM OUTLOUD', STORY_WIDTH/2, STORY_HEIGHT - 200);
    
    ctx.fillStyle = COLORS.primary;
    ctx.font = '20px Arial';
    ctx.fillText('LGBTQ+ EVENTS IN BIRMINGHAM', STORY_WIDTH/2, STORY_HEIGHT - 160);
    
    // Call to action
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 24px Arial';
    ctx.fillText('TAP TO VIEW DETAILS', STORY_WIDTH/2, STORY_HEIGHT - 100);
    
    // Decorative elements
    // Top accent line
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(STORY_WIDTH/2 - 100, 100);
    ctx.lineTo(STORY_WIDTH/2 + 100, 100);
    ctx.stroke();
    
    // Bottom accent line
    ctx.beginPath();
    ctx.moveTo(STORY_WIDTH/2 - 100, STORY_HEIGHT - 50);
    ctx.lineTo(STORY_WIDTH/2 + 100, STORY_HEIGHT - 50);
    ctx.stroke();
    
    // Corner decorations
    ctx.fillStyle = COLORS.primary;
    ctx.fillRect(0, 0, 60, 4);
    ctx.fillRect(0, 0, 4, 60);
    ctx.fillRect(STORY_WIDTH - 60, 0, 60, 4);
    ctx.fillRect(STORY_WIDTH - 4, 0, 4, 60);
    ctx.fillRect(0, STORY_HEIGHT - 4, 60, 4);
    ctx.fillRect(0, STORY_HEIGHT - 60, 4, 60);
    ctx.fillRect(STORY_WIDTH - 60, STORY_HEIGHT - 4, 60, 4);
    ctx.fillRect(STORY_WIDTH - 4, STORY_HEIGHT - 60, 4, 60);
    
    return canvas.toBuffer('image/png');
}
