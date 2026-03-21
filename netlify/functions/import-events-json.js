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

// Category auto-suggestion rules: match keywords in event name + description
const CATEGORY_RULES = [
    {
        keywords: ['fetish', 'glory hole', 'play area', 'leather daddies', 'kink', ' pup ', 'hardon'],
        category: 'Adult',
        reason: 'NSFW content detected'
    },
    {
        keywords: ['drag queen', 'drag host', 'drag performer', 'in drag'],
        category: 'Drag',
        reason: 'Drag performance detected'
    },
    {
        keywords: [' bingo'],
        category: 'Bingo',
        reason: 'Bingo format detected'
    },
    {
        keywords: ['cabaret'],
        category: 'Cabaret',
        reason: 'Cabaret format detected'
    },
    {
        keywords: ['karaoke'],
        category: 'Karaoke',
        reason: 'Karaoke format detected'
    },
    {
        keywords: ['speed dating', 'singles night'],
        category: 'Social',
        reason: 'Dating/social event detected'
    }
];

// Also detect "rubber" + "dress code" together as Adult content
function hasRubberDressCode(text) {
    return text.includes('rubber') && text.includes('dress code');
}

/**
 * Validates and auto-suggests categories for an event based on keyword matching.
 * Mutates the categories array in place and logs warnings.
 */
function validateAndSuggestCategories(evt, categories) {
    const text = ` ${(evt.name || '')} ${(evt.description || '')} `.toLowerCase();

    // Apply keyword-based auto-categorisation rules
    for (const rule of CATEGORY_RULES) {
        if (categories.includes(rule.category)) continue;
        const matched = rule.keywords.some(kw => text.includes(kw));
        if (matched) {
            categories.push(rule.category);
            console.warn(`[import] Auto-added category '${rule.category}' to '${evt.name}': ${rule.reason}`);
        }
    }

    // Special compound rule: rubber + dress code → Adult
    if (!categories.includes('Adult') && hasRubberDressCode(text)) {
        categories.push('Adult');
        console.warn(`[import] Auto-added category 'Adult' to '${evt.name}': NSFW content detected (rubber + dress code)`);
    }

    // Warn about under-categorised events
    if (categories.length === 0 || (categories.length === 1 && categories[0] === 'LGBT+')) {
        console.warn(`[import] WARNING: '${evt.name}' has only generic categories ${JSON.stringify(categories)} — consider adding a specific category`);
    }

    return categories;
}

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

        // Optional token for programmatic authorization, but we do not strictly block requests 
        // coming from the admin UI since it is already gated.
        if (process.env.MIGRATION_TOKEN && body.token && body.token !== process.env.MIGRATION_TOKEN) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized', message: 'Invalid MIGRATION_TOKEN provided in payload' })
            };
        }

        let upsertEvents = [];
        let deleteSlugs = [];
        let dryRun = false;

        if (Array.isArray(body)) {
            upsertEvents = body;
        } else {
            if (Array.isArray(body.events)) {
                upsertEvents = body.events;
            } else if (Array.isArray(body.upsert)) {
                upsertEvents = body.upsert;
            }
            if (Array.isArray(body.delete)) {
                deleteSlugs = body.delete;
            }
            dryRun = body.dryRun === true;
        }

        if (upsertEvents.length === 0 && deleteSlugs.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Bad Request', message: 'Payload must contain an "upsert", "events", or "delete" array' })
            };
        }

        const results = [];

        // 1. Process deletions
        for (const slug of deleteSlugs) {
            const currentResult = { action: 'delete', slug: slug };
            try {
                if (dryRun) {
                    console.log(`[DRY RUN] Would delete event with slug: ${slug}`);
                    currentResult.success = true;
                    currentResult.dryRun = true;
                } else {
                    const snapshot = await db.collection('events').where('slug', '==', slug).get();
                    if (snapshot.empty) {
                        console.warn(`Delete warning: No event found with slug ${slug}`);
                        currentResult.success = false;
                        currentResult.warning = 'No matching document found';
                    } else {
                        for (const doc of snapshot.docs) {
                            await doc.ref.delete();
                        }
                        currentResult.success = true;
                    }
                }
            } catch (err) {
                console.error(`Failed to delete event with slug ${slug}:`, err);
                currentResult.success = false;
                currentResult.error = err.message;
            }
            results.push(currentResult);
        }

        // 2. Process upserts
        for (const evt of upsertEvents) {
            const currentResult = { action: 'upsert', name: evt.name || 'Unnamed Event' };
            try {
                // Generate slug from name and date
                const rawName = evt.name || 'Event';
                const dateSuffix = evt.date ? `-${evt.date}` : '';
                const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + dateSuffix;
                currentResult.slug = slug;

                // Handle date conversion to ISO string with optional time
                let isoDate = evt.date || '';
                if (evt.date) {
                    try {
                        let timeStr = evt.startTime || '00:00';
                        const dateTimeStr = `${evt.date}T${timeStr}:00.000Z`;
                        const d = new Date(dateTimeStr);
                        if (!isNaN(d.getTime())) {
                            isoDate = dateTimeStr;
                        }
                    } catch (e) {
                        // ignore error and fallback to raw string
                    }
                }

                // Handle category array
                let categories = [];
                if (Array.isArray(evt.category)) {
                    categories = evt.category;
                } else if (typeof evt.category === 'string') {
                    categories = [evt.category];
                } else if (Array.isArray(evt.categories)) {
                    categories = evt.categories;
                }

                // Validate and auto-suggest categories based on event content
                categories = validateAndSuggestCategories(evt, categories);

                let exists = false;
                let existingDocId = null;
                const existingSnapshot = await db.collection('events').where('slug', '==', slug).get();
                if (!existingSnapshot.empty) {
                    exists = true;
                    existingDocId = existingSnapshot.docs[0].id;
                }

                if (dryRun) {
                    currentResult.success = true;
                    currentResult.dryRun = true;
                    currentResult.intendedAction = exists ? 'update' : 'create';
                    console.log(`[DRY RUN] Would ${currentResult.intendedAction} event: ${rawName} (slug: ${slug})`);
                } else {
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
                        date: isoDate,
                        time: evt.startTime || '',
                        category: categories,
                        venueName: evt.venueName || '',
                        venueSlug: evt.venueSlug || '',
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
                        updatedAt: new Date().toISOString()
                    };

                    // Only set the image if we uploaded one, otherwise keep existing image if updating
                    if (cloudinaryResult) {
                        eventData.image = { url: cloudinaryResult.secure_url };
                    }

                    if (exists) {
                        await db.collection('events').doc(existingDocId).update(eventData);
                        currentResult.success = true;
                        currentResult.id = existingDocId;
                        currentResult.action = 'update';
                    } else {
                        eventData.createdAt = new Date().toISOString();
                        const docRef = await db.collection('events').add(eventData);
                        currentResult.success = true;
                        currentResult.id = docRef.id;
                        currentResult.action = 'create';
                    }
                }
            } catch (itemError) {
                console.error(`Failed to process event ${currentResult.name}:`, itemError);
                currentResult.success = false;
                currentResult.error = itemError.message;
            }

            results.push(currentResult);
        }

        // Trigger Netlify Rebuild if configured and not dry run
        if (!dryRun && process.env.NETLIFY_BUILD_HOOK_URL) {
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
                message: `Processed operations: ${upsertEvents.length} upserts, ${deleteSlugs.length} deletes${dryRun ? ' (DRY RUN)' : ''}`,
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
