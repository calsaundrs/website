const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
const fetch = require('node-fetch');

// Initialize Firebase with explicit environment variables to prevent init conflicts
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
        }),
    });
}
const db = admin.firestore();

// Initialize Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event, context) => {
    // CORS configuration allowing external API calls
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS, POST'
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
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const body = JSON.parse(event.body);

        // Custom simple hardcoded token check for script automation
        if (body.token !== process.env.MIGRATION_TOKEN || !process.env.MIGRATION_TOKEN) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing MIGRATION_TOKEN' })
            };
        }

        const events = body.events || [];
        if (!Array.isArray(events)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Bad Request', message: 'Payload must contain an "events" array' })
            };
        }

        const results = [];

        for (const evt of events) {
            const currentResult = { name: evt.name || 'Unnamed Event' };
            try {
                // Generate slug from name and date
                const rawName = evt.name || 'Event';
                const dateSuffix = evt.date ? `-${evt.date}` : '';
                const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + dateSuffix;

                // Handle image upload to Cloudinary if imageUrl is provided
                let cloudinaryResult = null;
                if (evt.imageUrl) {
                    try {
                        cloudinaryResult = await cloudinary.uploader.upload(evt.imageUrl, {
                            folder: 'brumoutloud/events',
                            format: 'jpg',
                            width: 1200,
                            height: 630,
                            crop: 'fill',
                            gravity: 'auto',
                            quality: 'auto'
                        });
                    } catch (uploadError) {
                        console.error('Cloudinary upload failed for', evt.imageUrl, uploadError);
                        // Continue to save the event without an image instead of failing entirely
                    }
                }

                const eventData = {
                    name: evt.name || '',
                    description: evt.description || '',
                    date: evt.date || '',
                    category: Array.isArray(evt.category) ? evt.category : [],
                    venueName: evt.venueName || '',
                    venueSlug: evt.venueSlug || '',
                    image: cloudinaryResult ? { url: cloudinaryResult.secure_url } : null,
                    link: evt.link || '',
                    price: evt.price || '',
                    ageRestriction: evt.ageRestriction || '',
                    status: 'approved',
                    isRecurring: !!evt.isRecurring,
                    recurringGroupId: evt.recurringGroupId || null,
                    recurringInstance: evt.recurringInstance || 1,
                    totalInstances: evt.totalInstances || 1,
                    recurringStartDate: evt.recurringStartDate || null,
                    recurringEndDate: evt.recurringEndDate || null,
                    recurringPattern: evt.recurringPattern || null,
                    slug: slug,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Add to Firestore
                const docRef = await db.collection('events').add(eventData);

                currentResult.success = true;
                currentResult.id = docRef.id;
            } catch (itemError) {
                console.error(`Failed to process event ${currentResult.name}:`, itemError);
                currentResult.success = false;
                currentResult.error = itemError.message;
            }

            results.push(currentResult);
        }

        // Trigger Netlify Rebuild if configured
        if (process.env.NETLIFY_BUILD_HOOK_URL) {
            try {
                await fetch(process.env.NETLIFY_BUILD_HOOK_URL, {
                    method: 'POST',
                    body: ''
                });
                console.log("Triggered Netlify build hook");
            } catch (e) {
                console.error("Failed to trigger rebuild:", e);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Processed ${events.length} events`,
                results: results
            })
        };

    } catch (error) {
        console.error('Import function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server Error', message: error.message })
        };
    }
};
