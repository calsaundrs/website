const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
        console.log("Firebase initialized successfully");
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
}

const db = admin.firestore();

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&apos;';
        }
    });
}

exports.handler = async function (event, context) {
    try {
        console.log("sitemap-simple function called");
        
        // Check if Firebase is properly initialized
        if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
            console.warn("Firebase environment variables not available, generating static sitemap only");
            return generateStaticSitemap();
        }
        
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        const baseUrl = process.env.URL || 'https://www.brumoutloud.co.uk';

        // Add static pages
        const staticPages = [
            '/',
            '/all-venues.html',
            '/events.html',
            '/community.html',
            '/contact.html',
            '/promoter-tool.html',
            '/promoter-submit.html',
            '/get-listed.html',
            '/privacy-policy.html',
            '/terms-and-conditions.html',
            '/terms-of-submission.html'
        ];

        staticPages.forEach(page => {
            sitemap += `  <url>\n    <loc>${baseUrl}${page}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        });

        // Add events - use same approach as get-events-firestore
        try {
            console.log("Fetching events for sitemap...");
            const eventsRef = db.collection('events');
            let query = eventsRef.where('status', '==', 'approved');
            query = query.limit(50); // Same limit as events page
            
            console.log("Executing Firestore query...");
            const snapshot = await query.get();
            console.log(`Query returned ${snapshot.size} documents`);
            
            let eventCount = 0;
            for (const doc of snapshot.docs) {
                const rawData = doc.data();
                
                // Map Firestore field names to expected field names (same as events function)
                const eventData = {
                    slug: rawData['Slug'] || rawData.slug,
                    date: rawData['Date'] || rawData.date
                };
                
                if (eventData.slug) {
                    const slug = escapeXml(eventData.slug);
                    const lastMod = eventData.date ? new Date(eventData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                    sitemap += `  <url>\n    <loc>${baseUrl}/event/${slug}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
                    eventCount++;
                }
            }
            
            console.log(`Added ${eventCount} approved events with slugs to sitemap`);
        } catch (eventError) {
            console.warn("Failed to fetch events for sitemap:", eventError.message);
            console.error("Event error details:", eventError);
        }

        // Add venues - use same approach as get-venues-firestore
        try {
            console.log("Fetching venues for sitemap...");
            const venuesRef = db.collection('venues');
            const venueSnapshot = await venuesRef.get();
            console.log(`Found ${venueSnapshot.size} total venues`);
            
            let venueCount = 0;
            venueSnapshot.forEach(doc => {
                const venueData = doc.data();
                
                // Process venue like the venues function does
                const processedVenue = processVenueForPublic({
                    id: doc.id,
                    ...venueData
                });
                
                if (processedVenue.slug && processedVenue.image && processedVenue.image.url && !processedVenue.image.url.includes('placehold.co')) {
                    const slug = escapeXml(processedVenue.slug);
                    sitemap += `  <url>\n    <loc>${baseUrl}/venue/${slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
                    venueCount++;
                }
            });
            
            console.log(`Added ${venueCount} venues with valid images to sitemap`);
        } catch (venueError) {
            console.warn("Failed to fetch venues for sitemap:", venueError.message);
            console.error("Venue error details:", venueError);
        }

        sitemap += `</urlset>`;

        console.log("Sitemap generated successfully");

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            },
            body: sitemap,
        };
    } catch (error) {
        console.error('Error generating sitemap:', error);
        
        // Fallback to static sitemap on error
        console.log("Falling back to static sitemap");
        return generateStaticSitemap();
    }
};

// Process venue for public display (same as venues function)
function processVenueForPublic(venueData) {
    // Extract image URL from various possible formats
    let imageUrl = null;
    
    // 1. First try photoUrl (new venue format)
    const photoUrl = venueData.photoUrl || venueData['Photo URL'];
    if (photoUrl) {
        imageUrl = photoUrl;
    } else {
        // 2. Try Cloudinary public ID (legacy format)
        const cloudinaryId = venueData['Cloudinary Public ID'] || venueData['cloudinaryPublicId'];
        if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
            imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_800,h_400,c_fill,g_auto/${cloudinaryId}`;
        } else {
            // 3. Try to find any image field that might contain a Cloudinary URL
            const possibleImageFields = ['image', 'Image', 'Photo', 'Photo URL', 'imageUrl'];
            for (const field of possibleImageFields) {
                const imageData = venueData[field];
                if (imageData) {
                    // Check if it's already a Cloudinary URL
                    if (typeof imageData === 'string' && imageData.includes('cloudinary.com')) {
                        imageUrl = imageData;
                        break;
                    }
                    // Check if it's an object with a Cloudinary URL
                    if (imageData && typeof imageData === 'object' && imageData.url && imageData.url.includes('cloudinary.com')) {
                        imageUrl = imageData.url;
                        break;
                    }
                }
            }
        }
    }
    
    // Extract slug from various possible formats
    const slug = venueData.slug || venueData['Slug'] || venueData.slugId || venueData['slug'];
    
    return {
        id: venueData.id,
        name: venueData.name || venueData['Venue Name'] || venueData['Name'],
        slug: slug,
        image: imageUrl ? { url: imageUrl } : null
    };
}

// Generate static sitemap as fallback
function generateStaticSitemap() {
    const baseUrl = process.env.URL || 'https://www.brumoutloud.co.uk';
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const staticPages = [
        '/',
        '/all-venues.html',
        '/events.html',
        '/community.html',
        '/contact.html',
        '/promoter-tool.html',
        '/promoter-submit.html',
        '/get-listed.html',
        '/privacy-policy.html',
        '/terms-and-conditions.html',
        '/terms-of-submission.html'
    ];

    staticPages.forEach(page => {
        sitemap += `  <url>\n    <loc>${baseUrl}${page}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    sitemap += `</urlset>`;

    console.log("Generated static sitemap with", staticPages.length, "pages (no dynamic content)");

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600'
        },
        body: sitemap,
    };
}
