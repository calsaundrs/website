const https = require('https');

// Function to make HTTPS request
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Function to escape XML
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

async function generateSitemap() {
    try {
        console.log('Generating static sitemap...');
        
        const baseUrl = 'https://www.brumoutloud.co.uk';
        
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        
        // Add static pages
        const staticPages = [
            '/',
            '/all-venues.html',
            '/events.html',
            '/clubs',
            '/birmingham-pride',
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

        // Fetch events from API
        try {
            console.log('Fetching events...');
            const eventsData = await makeRequest('https://brumoutloud.co.uk/.netlify/functions/get-events');
            const events = eventsData.events || [];
            
            console.log(`Found ${events.length} events`);
            
            events.forEach(event => {
                if (event.slug) {
                    const slug = escapeXml(event.slug);
                    const lastMod = event.date ? new Date(event.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                    sitemap += `  <url>\n    <loc>${baseUrl}/event/${slug}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
                }
            });
            
            console.log(`Added ${events.length} events to sitemap`);
        } catch (eventError) {
            console.error('Error fetching events:', eventError.message);
        }

        // Fetch venues from API
        try {
            console.log('Fetching venues...');
            const venuesData = await makeRequest('https://brumoutloud.co.uk/.netlify/functions/get-venues');
            const venues = venuesData.venues || [];
            
            console.log(`Found ${venues.length} venues`);
            
            venues.forEach(venue => {
                if (venue.slug && venue.image && venue.image.url && !venue.image.url.includes('placehold.co')) {
                    const slug = escapeXml(venue.slug);
                    sitemap += `  <url>\n    <loc>${baseUrl}/venue/${slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
                }
            });
            
            console.log(`Added ${venues.filter(v => v.slug && v.image && v.image.url && !v.image.url.includes('placehold.co')).length} venues to sitemap`);
        } catch (venueError) {
            console.error('Error fetching venues:', venueError.message);
        }

        sitemap += `</urlset>`;
        
        // Write to file
        const fs = require('fs');
        fs.writeFileSync('sitemap.xml', sitemap);
        
        console.log('Static sitemap generated successfully!');
        console.log('File saved as: sitemap.xml');
        
        // Count URLs
        const urlCount = (sitemap.match(/<url>/g) || []).length;
        console.log(`Total URLs in sitemap: ${urlCount}`);
        
    } catch (error) {
        console.error('Error generating sitemap:', error);
    }
}

generateSitemap();
