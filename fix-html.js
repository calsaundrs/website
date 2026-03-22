const fs = require('fs');

// Fix events.html
let eventsHtml = fs.readFileSync('events.html', 'utf8');

// The event grid starts with id="event-grid" and ends before id="no-results"
eventsHtml = eventsHtml.replace(
    /(<div class="grid[^>]*id="event-grid"[^>]*>)([\s\S]*?)(?=<\/div>\s*<!-- No Results State -->)/,
    '$1\n                <!-- EVENTS_GRID_SSG_PLACEHOLDER -->\n            '
);

// Featured slideshow
eventsHtml = eventsHtml.replace(
    /(<div class="slideshow-container"[^>]*>)([\s\S]*?)(?=<\/div>\s*<!-- Navigation Dots -->)/,
    '$1\n                <!-- FEATURED_SLIDESHOW_SSG_PLACEHOLDER -->\n            '
);

// Featured dots
eventsHtml = eventsHtml.replace(
    /(<div class="slideshow-dots[^>]*>)([\s\S]*?)(?=<\/div>\s*<\/div>\s*<!-- Next\/Prev Buttons -->)/,
    '$1\n                    <!-- FEATURED_DOTS_SSG_PLACEHOLDER -->\n                '
);

fs.writeFileSync('events.html', eventsHtml);

// Fix all-venues.html
let venuesHtml = fs.readFileSync('all-venues.html', 'utf8');

// The venue grid
venuesHtml = venuesHtml.replace(
    /(<div class="grid[^>]*id="venue-grid"[^>]*>)([\s\S]*?)(?=<\/div>\s*<!-- No Results State -->)/,
    '$1\n                <!-- VENUES_GRID_SSG_PLACEHOLDER -->\n            '
);

fs.writeFileSync('all-venues.html', venuesHtml);
console.log('Fixed HTML files');
