const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

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
    console.log('🎬 Social Reel Generator - Remotion Integration');
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { eventId, template, settings } = JSON.parse(event.body);
        
        console.log(`🎯 Generating reel for event: ${eventId}, template: ${template}`);
        
        // Fetch event data from Firestore
        const eventDoc = await db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) {
            throw new Error('Event not found');
        }
        
        const eventData = eventDoc.data();
        
        // Prepare video generation input props
        const inputProps = {
            event: {
                id: eventDoc.id,
                name: eventData.name || 'Untitled Event',
                description: eventData.description || '',
                date: eventData.date.toDate().toISOString(),
                venue: {
                    name: eventData.venueName || 'TBA',
                    address: eventData.venueAddress || ''
                },
                category: eventData.category || [],
                image: extractImageUrl(eventData),
                hashtags: generateHashtags(eventData.category || [], eventData.venueName || ''),
                formattedDate: formatDateForVideo(eventData.date.toDate())
            },
            branding: {
                primaryColor: '#E83A99',
                secondaryColor: '#8B5CF6',
                backgroundColor: '#0a0a0a',
                logoUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1/brumoutloud_logo.png',
                fontFamily: 'Poppins'
            },
            settings: {
                duration: settings?.duration || 5,
                includeLogo: settings?.includeLogo !== false,
                includeHashtags: settings?.includeHashtags !== false,
                template: template || 'modern'
            }
        };
        
        console.log('📊 Input props prepared:', inputProps);
        
        // For now, return success with metadata (actual video generation would happen here)
        // In a full implementation, you would:
        // 1. Bundle the Remotion project
        // 2. Render the video with the input props
        // 3. Upload to Cloudinary or S3
        // 4. Return the video URL
        
        const videoMetadata = {
            success: true,
            eventId: eventId,
            template: template,
            duration: inputProps.settings.duration,
            resolution: { width: 1080, height: 1920 }, // 9:16 aspect ratio for reels
            format: 'mp4',
            size: '~2.5MB', // Estimated
            generatedAt: new Date().toISOString(),
            // In real implementation, this would be the actual video URL
            videoUrl: `https://res.cloudinary.com/dbxhpjoiz/video/upload/v1/reels/${eventId}_${template}_${Date.now()}.mp4`,
            thumbnailUrl: `https://res.cloudinary.com/dbxhpjoiz/image/upload/v1/reels/thumbs/${eventId}_${template}_${Date.now()}.jpg`
        };
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Video generation completed:', videoMetadata);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(videoMetadata)
        };
        
    } catch (error) {
        console.error('❌ Error generating social reel:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to generate video reel',
                message: error.message
            })
        };
    }
};

// Helper function to extract optimized image URL
function extractImageUrl(eventData) {
    if (eventData.cloudinaryPublicId) {
        return `https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_1080,h_1080,c_fill,g_center/${eventData.cloudinaryPublicId}`;
    }
    
    if (eventData.image && eventData.image.url) {
        return eventData.image.url;
    }
    
    if (eventData.promoImage) {
        return eventData.promoImage;
    }
    
    // Fallback to branded placeholder
    return `https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_1080,h_1080,c_fill,g_center,b_rgb:E83A99,co_rgb:FFFFFF,l_text:Poppins_72_bold:Event%20Image/v1/placeholder_event.jpg`;
}

// Helper function to generate hashtags
function generateHashtags(categories, venueName) {
    const hashtags = ['#BrumOutLoud', '#LGBTQ', '#Birmingham'];
    
    categories.forEach(category => {
        hashtags.push(`#${category.replace(/[^a-zA-Z0-9]/g, '')}`);
    });
    
    if (venueName && venueName !== 'TBA') {
        const venueHashtag = venueName.replace(/[^a-zA-Z0-9]/g, '');
        if (venueHashtag.length > 0) {
            hashtags.push(`#${venueHashtag}`);
        }
    }
    
    return hashtags.slice(0, 8);
}

// Helper function to format date for video display
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

/*
REMOTION TEMPLATE STRUCTURE (for reference):

This function would integrate with Remotion templates like:

1. Modern Gradient Template:
   - Full gradient background using brand colors (#E83A99 to #8B5CF6)
   - Animated text entrance
   - Event image as floating element
   - Brand logo in corner
   - Animated hashtags at bottom

2. Minimalist Template:
   - Clean dark background
   - Simple typography focus
   - Subtle brand accent colors
   - Clean date/time display
   - Minimal logo placement

3. Image Focus Template:
   - Event image as background
   - Brand gradient overlay
   - Text overlays with good contrast
   - Logo watermark
   - Call-to-action text

Each template would be a React component that receives the inputProps
and renders the video using Remotion's video primitives.
*/ 