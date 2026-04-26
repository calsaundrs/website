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

  // Add static pages (using clean canonical URLs without .html extensions).
  // Every entry gets a <lastmod> at build time. For frequently-edited
  // pages this defaults to today; for slow-moving legal/info pages we
  // can pin it (none currently — review if a real "last edited" date
  // ever matters for trust signals).
  const staticPages = [
    { url: '/', changefreq: 'weekly', priority: '1.0' },
    { url: '/events', changefreq: 'daily', priority: '0.9' },
    { url: '/all-venues', changefreq: 'weekly', priority: '0.8' },
    { url: '/clubs', changefreq: 'weekly', priority: '0.8' },
    // Pride: bumped priority during seasonal surge.
    { url: '/birmingham-pride', changefreq: 'daily', priority: '0.95' },
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
    // Every entry gets a <lastmod> — defaults to today on each build so
    // the entire sitemap signals "fresh" and Google re-queues whatever
    // its crawl scheduler thinks is stale. Per-page overrides win.
    sitemap += [
      '  <url>',
      `    <loc>${baseUrl}${page.url}</loc>`,
      `    <lastmod>${page.lastmod || today}</lastmod>`,
      `    <changefreq>${page.changefreq}</changefreq>`,
      `    <priority>${page.priority}</priority>`,
      '  </url>',
    ].join('\n') + '\n';
  });

  // Add ALL events. Recurring series can return the same slug for
  // each instance; dedupe before writing so the sitemap doesn't list
  // the same URL twice (Google sees it as a quality signal regression).
  try {
    console.log('Fetching all events...');
    const eventsData = await makeRequest('https://brumoutloud.co.uk/.netlify/functions/get-events');
    const events = eventsData.events || [];
    console.log(`Found ${events.length} events`);

    const seenEventSlugs = new Set();
    let dupeCount = 0;
    events.forEach(event => {
      if (!event.slug) return;
      if (seenEventSlugs.has(event.slug)) { dupeCount++; return; }
      seenEventSlugs.add(event.slug);
      const eventUrl = `${baseUrl}/event/${event.slug}`;
      const lastmod = event.date ? formatDate(event.date) : today;
      sitemap += `  <url>\n    <loc>${escapeXml(eventUrl)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });
    if (dupeCount > 0) {
      console.log(`Skipped ${dupeCount} duplicate event slug(s)`);
    }
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
        const lastmod = venue.updatedAt ? formatDate(venue.updatedAt) : today;
        sitemap += `  <url>\n    <loc>${escapeXml(venueUrl)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
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
      sitemap += `  <url>\n    <loc>${escapeXml(baseUrl + '/venue/' + slug)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }
  });

  sitemap += `</urlset>`;
  
  // Write to file
  const fs = require('fs');
  fs.writeFileSync('sitemap.xml', sitemap);
  console.log('Comprehensive sitemap generated successfully!');
}

generateComprehensiveSitemap().catch(console.error);
