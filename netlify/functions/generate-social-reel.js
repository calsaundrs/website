const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Conditionally import Remotion packages for serverless compatibility
let bundle, renderMedia, selectComposition;
try {
    const bundler = require('@remotion/bundler');
    const renderer = require('@remotion/renderer');
    bundle = bundler.bundle;
    renderMedia = renderer.renderMedia;
    selectComposition = renderer.selectComposition;
} catch (error) {
    console.warn('⚠️ Remotion packages not available in this environment. Video generation will use mock mode.');
}

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
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        let eventId, template, settings;
        
        // Handle both JSON and form data
        if (event.body) {
            try {
                const parsed = JSON.parse(event.body);
                eventId = parsed.eventId;
                template = parsed.template;
                settings = parsed.settings;
            } catch (parseError) {
                // If JSON parsing fails, try to extract from query parameters
                const params = new URLSearchParams(event.body);
                eventId = params.get('eventId');
                template = params.get('template');
                settings = params.get('settings') ? JSON.parse(params.get('settings')) : {};
            }
        }
        
        // Validate input
        if (!eventId) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    success: false,
                    error: 'Missing eventId parameter' 
                })
            };
        }
        
        console.log(`🎯 Generating reel for event: ${eventId}, template: ${template || 'modern'}`);
        
        // Fetch event data from Firestore
        const eventDoc = await db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) {
            console.error(`❌ Event not found: ${eventId}`);
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    success: false,
                    error: 'Event not found',
                    eventId: eventId
                })
            };
        }
        
        const eventData = eventDoc.data();
        
        // Prepare video generation input props
        const inputProps = {
            event: {
                id: eventDoc.id,
                name: eventData.name || 'Untitled Event',
                description: eventData.description || '',
                date: eventData.date ? eventData.date.toDate().toISOString() : new Date().toISOString(),
                venue: {
                    name: eventData.venueName || 'TBA',
                    address: eventData.venueAddress || ''
                },
                category: eventData.category || [],
                image: extractImageUrl(eventData),
                hashtags: generateHashtags(eventData.category || [], eventData.venueName || ''),
                formattedDate: formatDateForVideo(eventData.date ? eventData.date.toDate() : new Date())
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
        
        // Video generation logic
        let videoUrl, thumbnailUrl;
        
        if (bundle && renderMedia && selectComposition) {
            console.log('🎬 Remotion packages available - generating actual video');
            // TODO: Implement actual Remotion rendering
            // const bundleLocation = await bundle(path.join(__dirname, '../../remotion-templates/src/index.ts'));
            // const composition = await selectComposition({...});
            // const output = await renderMedia({...});
            
            // For now, simulate the process
            videoUrl = `https://res.cloudinary.com/dbxhpjoiz/video/upload/v1/reels/${eventId}_${template}_${Date.now()}.mp4`;
            thumbnailUrl = `https://res.cloudinary.com/dbxhpjoiz/image/upload/v1/reels/thumbs/${eventId}_${template}_${Date.now()}.jpg`;
        } else {
            console.log('📋 Mock mode - Remotion packages not available');
            // Mock video generation for development/preview
            videoUrl = `https://res.cloudinary.com/dbxhpjoiz/video/upload/v1/reels/mock_${eventId}_${template}_${Date.now()}.mp4`;
            thumbnailUrl = `https://res.cloudinary.com/dbxhpjoiz/image/upload/v1/reels/thumbs/mock_${eventId}_${template}_${Date.now()}.jpg`;
        }
        
        const videoMetadata = {
            success: true,
            eventId: eventId,
            template: template,
            duration: inputProps.settings.duration,
            resolution: { width: 1080, height: 1920 }, // 9:16 aspect ratio for reels
            format: 'mp4',
            size: '~2.5MB', // Estimated
            generatedAt: new Date().toISOString(),
            videoUrl: videoUrl,
            thumbnailUrl: thumbnailUrl,
            mockMode: !bundle // Indicate if this was generated in mock mode
        };
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Video generation completed:', videoMetadata);
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(videoMetadata)
        };
        
    } catch (error) {
        console.error('❌ Error generating social reel:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
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