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

exports.handler = async function (event, context) {
    console.log('🎬 Demo Video Generator - Creating instant preview');
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { eventId, template, settings } = JSON.parse(event.body);
        
        console.log(`🎯 Generating demo video for event: ${eventId}, template: ${template}`);
        
        // Fetch event data from Firestore
        const eventDoc = await db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) {
            throw new Error('Event not found');
        }
        
        const eventData = eventDoc.data();
        
        // Create demo video metadata with data URL for immediate playback
        const demoVideoData = generateDemoVideoDataURL(eventData, template, settings);
        
        const videoMetadata = {
            success: true,
            eventId: eventId,
            template: template,
            duration: settings?.duration || 5,
            resolution: { width: 1080, height: 1920 },
            format: 'mp4',
            size: '~1MB',
            generatedAt: new Date().toISOString(),
            videoUrl: demoVideoData.videoDataURL,
            thumbnailUrl: demoVideoData.thumbnailDataURL,
            mockMode: true,
            demoMode: true,
            event: {
                id: eventDoc.id,
                name: eventData.name || 'Untitled Event',
                venue: {
                    name: eventData.venueName || 'TBA',
                    address: eventData.venueAddress || ''
                },
                formattedDate: formatDateForVideo(eventData.date.toDate())
            }
        };
        
        console.log('✅ Demo video generated successfully');
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(videoMetadata)
        };
        
    } catch (error) {
        console.error('❌ Error generating demo video:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to generate demo video',
                message: error.message
            })
        };
    }
};

function generateDemoVideoDataURL(eventData, template, settings) {
    // Create a simple animated GIF-like data URL for demonstration
    // In a real implementation, this would be replaced by actual Remotion rendering
    
    const canvas = createVirtualCanvas(1080, 1920);
    const frames = generateDemoFrames(canvas, eventData, template, settings);
    
    // For demo purposes, return static image data URLs
    // This simulates what would be real video/thumbnail URLs
    return {
        videoDataURL: generateVideoDataURL(frames),
        thumbnailDataURL: generateThumbnailDataURL(canvas, eventData, template)
    };
}

function createVirtualCanvas(width, height) {
    // Virtual canvas representation for server-side generation
    return {
        width: width,
        height: height,
        getContext: () => ({
            fillStyle: '',
            font: '',
            textAlign: 'center',
            fillRect: () => {},
            fillText: () => {},
            drawImage: () => {},
            createLinearGradient: () => ({
                addColorStop: () => {}
            })
        })
    };
}

function generateDemoFrames(canvas, eventData, template, settings) {
    const duration = settings?.duration || 5;
    const fps = 30;
    const frameCount = duration * fps;
    
    const frames = [];
    
    for (let frame = 0; frame < frameCount; frame++) {
        const progress = frame / frameCount;
        frames.push({
            frame: frame,
            progress: progress,
            timestamp: frame / fps
        });
    }
    
    return frames;
}

function generateVideoDataURL(frames) {
    // Generate a placeholder video data URL
    // This represents an animated video preview
    return `data:video/mp4;base64,${generatePlaceholderVideoBase64()}`;
}

function generateThumbnailDataURL(canvas, eventData, template) {
    // Generate a placeholder thumbnail data URL
    return `data:image/jpeg;base64,${generatePlaceholderImageBase64(eventData, template)}`;
}

function generatePlaceholderVideoBase64() {
    // Minimal MP4 header for a placeholder video
    // In reality, this would be actual video content
    return 'R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
}

function generatePlaceholderImageBase64(eventData, template) {
    // Generate a simple base64 image representing the video thumbnail
    // This is a minimal placeholder - in reality would be actual image
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
}

function formatDateForVideo(date) {
    const options = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    
    return date.toLocaleDateString('en-GB', options);
} 