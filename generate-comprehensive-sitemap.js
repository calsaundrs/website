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
  
  // Today's date for per-page lastmod overrides below. Use ISO (YYYY-MM-DD)
  // which is the form Google prefers.
  const today = new Date().toISOString().slice(0, 10);

  // Add static pages (using clean canonical URLs without .html extensions)
  const staticPages = [
    { url: '/', changefreq: 'weekly', priority: '1.0' },
    { url: '/events', changefreq: 'daily', priority: '0.9' },
    { url: '/all-venues', changefreq: 'weekly', priority: '0.8' },
    { url: '/clubs', changefreq: 'weekly', priority: '0.8' },
    // Pride page: weeks before the festival we want Google to recrawl
    // daily — priority bumped to 0.95 during the seasonal surge and
    // lastmod set to today so the page is re-queued on every build.
    { url: '/birmingham-pride', changefreq: 'daily', priority: '0.95', lastmod: today },
    { url: '/community', changefreq: 'monthly', priority: '0.7' },
    { url: '/contact', changefreq: 'monthly', priority: '0.6' },
    { url: '/promoter-submit-new', changefreq: 'monthly', priority: '0.6' },
    { url: '/promoter-tool', changefreq: 'monthly', priority: '0.6' },
    { url: '/get-listed', changefreq: 'monthly', priority: '0.5' },
    { url: '/birmingham-gay-bars', changefreq: 'monthly', priority: '0.8' },
    { url: '/gay-birmingham-guide', changefreq: 'monthly', priority: '0.8' },
    { url: '/birmingham-drag-shows', changefreq: 'monthly', priority: '0.8' },
    { url: '/accessibility', changefreq: 'yearly', priority: '0.3' },
    { url: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
    { url: '/terms-and-conditions', changefreq: 'yearly', priority: '0.3' },
    { url: '/terms-of-submission', changefreq: 'yearly', priority: '0.3' },
    // Series / recurring event landing pages
    { url: '/series/xxl', changefreq: 'weekly', priority: '0.8' },
    { url: '/series/hard-on', changefreq: 'weekly', priority: '0.8' },
    { url: '/series/beefmince', changefreq: 'weekly', priority: '0.8' },
    { url: '/series/dilf', changefreq: 'weekly', priority: '0.8' }
  ];

  console.log('Adding static pages...');
  staticPages.forEach(page => {
    const lastmodLine = page.lastmod ? `    <lastmod>${page.lastmod}</lastmod>\n` : '';
    sitemap += `  <url>\n    <loc>${baseUrl}${page.url}</loc>\n${lastmodLine}    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
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

  // Add ALL venues (excluding closed venues)
  const excludedVenueSlugs = new Set(['sidewalk']); // Closed venues
  const addedVenueSlugs = new Set();
  try {
    console.log('Fetching all venues...');
    const venuesData = await makeRequest('https://brumoutloud.co.uk/.netlify/functions/get-venues');
    const venues = venuesData.venues || [];
    console.log(`Found ${venues.length} venues`);

    venues.forEach(venue => {
      if (venue.slug && !excludedVenueSlugs.has(venue.slug)) {
        addedVenueSlugs.add(venue.slug);
        const venueUrl = `${baseUrl}/venue/${venue.slug}`;
        sitemap += `  <url>\n    <loc>${escapeXml(venueUrl)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }
    });
  } catch (venueError) {
    console.error('Error fetching venues:', venueError.message);
  }

  // Fallback: add known static venue pages if API fetch failed or missed them
  const knownVenueSlugs = [
    'eden-bar', 'equator-bar', 'glamorous', 'missing-bar',
    'the-fountain-inn', 'the-fox', 'the-hub', 'the-nightingale-club', 'the-village-inn'
  ];
  knownVenueSlugs.forEach(slug => {
    if (!addedVenueSlugs.has(slug)) {
      console.log(`Adding fallback venue: ${slug}`);
      sitemap += `  <url>\n    <loc>${escapeXml(baseUrl + '/venue/' + slug)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }
  });

  sitemap += `</urlset>`;
  
  // Write to file
  const fs = require('fs');
  fs.writeFileSync('sitemap.xml', sitemap);
  console.log('Comprehensive sitemap generated successfully!');
}

generateComprehensiveSitemap().catch(console.error);
