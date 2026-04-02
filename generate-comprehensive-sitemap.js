const https = require('https');

// Helper function to make HTTPS requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });
  });
}

// Helper function to escape XML special characters
function escapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper function to format date for lastmod
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

async function generateComprehensiveSitemap() {
  const baseUrl = 'https://www.brumoutloud.co.uk';
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  // Add static pages
  const staticPages = [
    { url: '/', changefreq: 'weekly', priority: '1.0' },
    { url: '/events.html', changefreq: 'daily', priority: '0.9' },
    { url: '/all-venues.html', changefreq: 'weekly', priority: '0.8' },
    { url: '/clubs', changefreq: 'monthly', priority: '0.7' },
    { url: '/birmingham-pride', changefreq: 'monthly', priority: '0.7' },
    { url: '/community.html', changefreq: 'monthly', priority: '0.7' },
    { url: '/contact.html', changefreq: 'monthly', priority: '0.6' },
    { url: '/promoter-submit-new', changefreq: 'monthly', priority: '0.6' },
    { url: '/privacy-policy.html', changefreq: 'yearly', priority: '0.3' },
    { url: '/terms-and-conditions.html', changefreq: 'yearly', priority: '0.3' },
    { url: '/terms-of-submission.html', changefreq: 'yearly', priority: '0.3' }
  ];

  console.log('Adding static pages...');
  staticPages.forEach(page => {
    sitemap += `  <url>\n    <loc>${baseUrl}${page.url}</loc>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
  });

  // Add ALL events
  try {
    console.log('Fetching all events...');
    const eventsData = await makeRequest('https://brumoutloud.co.uk/.netlify/functions/get-events');
    const events = eventsData.events || [];
    console.log(`Found ${events.length} events`);

    events.forEach(event => {
      if (event.slug) {
        const eventUrl = `${baseUrl}/event/${event.slug}`;
        const lastmod = event.date ? formatDate(event.date) : '';
        sitemap += `  <url>\n    <loc>${escapeXml(eventUrl)}</loc>\n`;
        if (lastmod) {
          sitemap += `    <lastmod>${lastmod}</lastmod>\n`;
        }
        sitemap += `    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }
    });
  } catch (eventError) {
    console.error('Error fetching events:', eventError.message);
  }

  // Add ALL venues with valid images
  try {
    console.log('Fetching all venues...');
    const venuesData = await makeRequest('https://brumoutloud.co.uk/.netlify/functions/get-venues');
    const venues = venuesData.venues || [];
    console.log(`Found ${venues.length} venues`);

    venues.forEach(venue => {
      if (venue.slug && venue.image && venue.image.url && !venue.image.url.includes('placehold.co')) {
        const venueUrl = `${baseUrl}/venue/${venue.slug}`;
        sitemap += `  <url>\n    <loc>${escapeXml(venueUrl)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }
    });
  } catch (venueError) {
    console.error('Error fetching venues:', venueError.message);
  }

  sitemap += `</urlset>`;
  
  // Write to file
  const fs = require('fs');
  fs.writeFileSync('sitemap.xml', sitemap);
  console.log('Comprehensive sitemap generated successfully!');
}

generateComprehensiveSitemap().catch(console.error);
