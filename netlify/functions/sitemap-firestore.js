const admin = require('firebase-admin');

// Version: 2025-01-27-v1 - Firestore-based sitemap generation

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
        console.log("sitemap-firestore function called");
        
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

        // Try to add dynamic event pages from Firestore with timeout
        try {
            console.log("Fetching events for sitemap...");
            const eventsRef = db.collection('events');
            
            // Get all events (not just approved ones) to see what's available
            const eventSnapshot = await Promise.race([
                eventsRef.select('slug', 'date', 'status', 'name').get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Events fetch timeout')), 10000))
            ]);

            console.log(`Found ${eventSnapshot.size} total events`);

            let eventCount = 0;
            eventSnapshot.forEach(doc => {
                const eventData = doc.data();
                if (eventData.slug) {
                    const slug = escapeXml(eventData.slug);
                    const lastMod = eventData.date ? new Date(eventData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                    sitemap += `  <url>\n    <loc>${baseUrl}/event/${slug}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
                    eventCount++;
                }
            });
            
            console.log(`Added ${eventCount} events with slugs to sitemap`);
        } catch (eventError) {
            console.warn("Failed to fetch events for sitemap:", eventError.message);
            // Continue without events
        }

        // Try to add dynamic venue pages from Firestore with timeout
        try {
            console.log("Fetching venues for sitemap...");
            const venuesRef = db.collection('venues');
            
            // Get all venues to see what's available
            const venueSnapshot = await Promise.race([
                venuesRef.select('slug', 'name', 'image', 'Photo', 'Cloudinary Public ID').get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Venues fetch timeout')), 10000))
            ]);

            console.log(`Found ${venueSnapshot.size} total venues`);

            let includedCount = 0;
            venueSnapshot.forEach(doc => {
                const venueData = doc.data();
                if (venueData.slug) {
                    // Check if venue has a valid image (similar to venues function logic)
                    const hasValidImage = venueData.image || venueData.Photo || venueData['Cloudinary Public ID'];
                    
                    if (hasValidImage) {
                        const slug = escapeXml(venueData.slug);
                        sitemap += `  <url>\n    <loc>${baseUrl}/venue/${slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
                        includedCount++;
                    }
                }
            });
            
            console.log(`Added ${includedCount} venues with images to sitemap`);
        } catch (venueError) {
            console.warn("Failed to fetch venues for sitemap:", venueError.message);
            // Continue without venues
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