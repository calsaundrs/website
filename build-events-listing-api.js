const fs = require('fs').promises;
const path = require('path');

// Build events listing page by pre-rendering event cards into events.html
// This replaces skeleton loaders with real event cards so Googlebot can index them
async function generateEventsListingPage() {
    try {
        console.log('🚀 Starting Events Listing SSG from API...');

        const apiUrl = 'https://brumoutloud.co.uk';
        const eventsApiUrl = `${apiUrl}/.netlify/functions/get-events`;

        console.log('📡 Fetching events from:', eventsApiUrl);

        const { default: fetch } = await import('node-fetch');

        const response = await fetch(eventsApiUrl, {
            headers: { 'User-Agent': 'Netlify-Build-SSG' }
        });

        if (!response.ok) {
            throw new Error(`API responded with ${response.status}: ${response.statusText}`);
        }

        const apiData = await response.json();
        const events = apiData.events || [];

        console.log(`📊 Fetched ${events.length} events from API`);

        if (events.length === 0) {
            console.log('⚠️ No events found, skipping SSG generation');
            return;
        }

        // Filter to future events and sort by date
        const now = new Date();
        now.setUTCHours(0, 0, 0, 0);
        const futureEvents = events.filter(ev => {
            const d = new Date(ev.date);
            return !isNaN(d.getTime()) && d >= now;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log(`📊 ${futureEvents.length} future events to pre-render`);

        // Read the current events.html
        const eventsHtmlPath = path.join(process.cwd(), 'events.html');
        let eventsHtml = await fs.readFile(eventsHtmlPath, 'utf8');

        // Generate event cards matching the existing createCard() format in events.html
        const eventCardsHtml = futureEvents.map(ev => {
            const date = formatDate(ev.date);
            const time = formatTime(ev.date);
            const name = ev.name || 'Untitled Event';
            const escapedName = escapeHtml(name);
            const slug = ev.slug || '';

            // Get image URL
            const rawUrl = ev.image ? (typeof ev.image === 'string' ? ev.image : ev.image.url) : null;
            const isPlaceholder = !rawUrl || rawUrl.includes('placehold');
            const imgHtml = isPlaceholder
                ? '<div class="event-placeholder"><i class="fas fa-image"></i></div>'
                : `<img src="${escapeHtml(rawUrl)}" alt="${escapedName} — LGBTQ+ event in Birmingham" loading="lazy">`;

            // Get venue name
            let venue = '';
            if (ev.venueName) {
                venue = Array.isArray(ev.venueName) ? ev.venueName[0] : ev.venueName;
            } else if (ev.venue && ev.venue.name) {
                venue = Array.isArray(ev.venue.name) ? ev.venue.name[0] : ev.venue.name;
            }

            return `<a href="/event/${slug}" class="event-card">`
                + imgHtml
                + '<div class="card-body">'
                + '<p class="text-[var(--color-toxic)] font-bold text-sm mb-1">'
                + '<i class="fas fa-calendar-day mr-1"></i>' + date
                + (time ? ' <span class="text-white ml-2"><i class="fas fa-clock mr-1 text-[var(--color-toxic)]"></i>' + time + '</span>' : '')
                + '</p>'
                + '<h3 class="text-xl font-black text-white uppercase font-display leading-tight mb-2">' + escapedName + '</h3>'
                + (venue ? '<p class="text-gray-400 text-sm"><i class="fas fa-map-marker-alt mr-1 text-[var(--color-pink)]"></i>' + escapeHtml(venue) + '</p>' : '')
                + '</div>'
                + '</a>';
        }).join('\n            ');

        // Replace skeleton loaders inside #event-grid with pre-rendered cards
        const skeletonRegex = /<div id="event-grid"[^>]*>[\s\S]*?<\/main>/;
        const replacement = `<div id="event-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            ${eventCardsHtml}
        </div>
    </main>`;

        eventsHtml = eventsHtml.replace(skeletonRegex, replacement);

        // Write the updated HTML
        await fs.writeFile(eventsHtmlPath, eventsHtml, 'utf8');

        console.log('✅ Successfully pre-rendered events listing page');
        console.log(`📊 Injected ${futureEvents.length} event cards`);

    } catch (error) {
        console.error('❌ Error generating events listing SSG:', error);
        console.log('⚠️ Events listing will remain dynamic (skeleton loaders preserved)');
    }
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Date TBC';
    return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC'
    });
}

function formatTime(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const s = typeof dateStr === 'string' ? dateStr : '';
    if (!s.includes('T') || s.includes('T00:00')) return '';
    const t = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
    return (t === '0:00' || t === '00:00') ? '' : t;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Run if called directly
if (require.main === module) {
    generateEventsListingPage();
}

module.exports = { generateEventsListingPage };
