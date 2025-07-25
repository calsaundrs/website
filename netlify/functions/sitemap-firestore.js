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
        
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        const baseUrl = process.env.URL || 'https://www.brumoutloud.co.uk'; // Use Netlify URL or fallback

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

        // Add dynamic event pages from Firestore
        console.log("Fetching events for sitemap...");
        const eventsRef = db.collection('events');
        const eventSnapshot = await eventsRef
            .where('status', '==', 'approved')
            .select('slug', 'date')
            .get();

        console.log(`Found ${eventSnapshot.size} approved events`);

        eventSnapshot.forEach(doc => {
            const eventData = doc.data();
            const slug = escapeXml(eventData.slug);
            const lastMod = eventData.date ? new Date(eventData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            sitemap += `  <url>\n    <loc>${baseUrl}/event/${slug}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
        });

        // Add dynamic venue pages from Firestore
        console.log("Fetching venues for sitemap...");
        const venuesRef = db.collection('venues');
        const venueSnapshot = await venuesRef
            .where('status', '==', 'approved')
            .select('slug')
            .get();

        console.log(`Found ${venueSnapshot.size} approved venues`);

        venueSnapshot.forEach(doc => {
            const venueData = doc.data();
            const slug = escapeXml(venueData.slug);
            sitemap += `  <url>\n    <loc>${baseUrl}/venue/${slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
        });

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
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-cache'
            },
            body: 'Error generating sitemap.',
        };
    }
};