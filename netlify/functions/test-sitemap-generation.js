exports.handler = async function (event, context) {
    console.log("sitemap-test function called");
    
    const baseUrl = 'https://www.brumoutloud.co.uk';
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    // Add static pages
    const staticPages = [
        '/',
        '/all-venues.html',
        '/events.html',
        '/community.html',
        '/contact.html'
    ];

    staticPages.forEach(page => {
        sitemap += `  <url>\n    <loc>${baseUrl}${page}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    sitemap += `</urlset>`;

    console.log("Test sitemap generated successfully");

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600'
        },
        body: sitemap,
    };
};
