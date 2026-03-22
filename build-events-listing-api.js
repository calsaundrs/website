const fs = require('fs').promises;
const path = require('path');

// Build events listing page using deployed API endpoints
async function generateEventsListingPage() {
    try {
        console.log('🚀 Starting Events Listing SSG from API...');
        
        // Try to fetch from deployed API endpoint
        // Use existing production site during builds
        const apiUrl = 'https://brumoutloud.co.uk';
        const eventsApiUrl = `${apiUrl}/.netlify/functions/get-events`;
        
        console.log('📡 Fetching events from:', eventsApiUrl);
        
        // Use dynamic import for fetch
        const { default: fetch } = await import('node-fetch');
        
        const response = await fetch(eventsApiUrl, {
            headers: {
                'User-Agent': 'Netlify-Build-SSG'
            }
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
        
        // Read the current events.html template
        const eventsHtmlPath = path.join(process.cwd(), 'events.html');
        let eventsHtml = await fs.readFile(eventsHtmlPath, 'utf8');
        
        // Generate event cards HTML matching design system
        const eventCardsHtml = events.map(event => {
            const imageUrl = event.imageUrl || event.image?.url || '';
            const categories = Array.isArray(event.category) ? event.category : (event.category ? [event.category] : []);
            
            const categoryTags = categories.map(cat => 
                `<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full">${cat}</span>`
            ).join(' ');
            
            // Format date safely
            let dateDisplay = '';
            let timeDisplay = '';
            try {
                const eventDate = new Date(event.date || event.startDate);
                if (!isNaN(eventDate.getTime())) {
                    dateDisplay = eventDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
                    timeDisplay = eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                }
            } catch (e) {
                dateDisplay = 'TBC';
                timeDisplay = 'TBC';
            }
            
            return `
                <div class="event-card p-0 group" 
                     onclick="window.location.href='/event/${event.slug}'" style="cursor:pointer">
                    <div class="relative h-48 overflow-hidden bg-black">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${event.name}" class="w-full h-full object-cover">` : `
                            <div class="event-hero-fallback h-full w-full bg-black flex items-center justify-center">
                                <i class="fas fa-image text-4xl text-gray-800"></i>
                            </div>
                        `}
                        <div class="absolute top-3 right-3 z-20">
                            <span class="filter-chip">
                                ${getCategoryLabel(categories, event.name)}
                            </span>
                        </div>
                    </div>
                    <div class="p-4">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center text-[var(--color-toxic)] font-bold text-xs">
                                <i class="far fa-calendar-alt mr-1"></i>
                                ${dateDisplay}
                            </div>
                            <div class="text-[var(--color-pink)] font-bold text-xs">
                                <i class="far fa-clock mr-1"></i>
                                ${timeDisplay}
                            </div>
                        </div>
                        <h3 class="text-lg font-bold mb-2">${event.name}</h3>
                        <p class="text-gray-400 text-xs mb-2 flex items-center">
                            <i class="fas fa-map-marker-alt mr-1"></i>
                            ${event.venueName || event.venue?.name || 'Venue TBC'}
                        </p>
                        <p class="text-gray-300 text-xs mb-4 line-clamp-2">
                            ${event.description || 'Join us for this fantastic LGBTQ+ event in Birmingham.'}
                        </p>
                        <div class="flex gap-3">
                            <a href="/event/${event.slug}" class="btn-primary flex-1 text-sm">
                                <i class="fas fa-ticket-alt mr-1"></i>VIEW DETAILS
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Helper function for category labels
        function getCategoryLabel(categories, eventName) {
            const cats = (categories || []).map(c => c.toLowerCase());
            const name = (eventName || '').toLowerCase();

            if (cats.some(c => c.includes('trans')) || name.includes('trans')) return 'Trans';
            if (cats.some(c => c.includes('pride')) || name.includes('pride')) return 'Pride';
            if (cats.some(c => c.includes('drag')) || name.includes('drag')) return 'Drag';
            if (cats.some(c => c.includes('cabaret')) || name.includes('cabaret')) return 'Cabaret';
            if (cats.some(c => c.includes('clubbing')) || name.includes('club')) return 'Club Night';
            return 'Event';
        }
        
        // Generate featured events slideshow (use first 5 events)
        const featuredEvents = events.slice(0, 5);
        const featuredSlideshowHtml = featuredEvents.map((event, index) => {
            const imageUrl = event.imageUrl || event.image?.url || '';
            
            return `
                <div class="slide ${index === 0 ? 'active' : ''}" style="background-image: url('${imageUrl}');">
                    <div class="slide-content">
                        <h2>${event.name}</h2>
                        <p>${event.venueName || event.venue?.name || 'TBC'}</p>
                        <a href="/event/${event.slug}" class="btn-primary">View Event</a>
                    </div>
                </div>
            `;
        }).join('');
        
        const featuredDotsHtml = featuredEvents.map((_, index) => 
            `<span class="dot ${index === 0 ? 'active' : ''}" onclick="currentSlide(${index + 1})"></span>`
        ).join('');
        
        // Replace placeholders with generated content, removing any old content until the end of the container
        // Replace placeholder with generated content
        eventsHtml = eventsHtml.replace(
            /<!-- EVENTS_GRID_START -->[\s\S]*?<!-- EVENTS_GRID_END -->/g,
            `<!-- EVENTS_GRID_START -->\n${eventCardsHtml}\n<!-- EVENTS_GRID_END -->`
        );
        
        eventsHtml = eventsHtml.replace(
            /<!-- FEATURED_SLIDESHOW_SSG_PLACEHOLDER -->[\s\S]*?(?=\s*<\/div>\s*<!-- Navigation Dots -->)/g,
            `<!-- FEATURED_SLIDESHOW_SSG_PLACEHOLDER -->\n${featuredSlideshowHtml}`
        );
        
        eventsHtml = eventsHtml.replace(
            /<!-- FEATURED_DOTS_SSG_PLACEHOLDER -->[\s\S]*?(?=\s*<\/div>\s*<\/div>\s*<!-- Next\/Prev Buttons -->)/g,
            `<!-- FEATURED_DOTS_SSG_PLACEHOLDER -->\n${featuredDotsHtml}`
        );
        
        // Remove the loading state
        eventsHtml = eventsHtml.replace(
            /<div class="col-span-full text-center text-gray-400 flex justify-center items-center gap-4 py-12">[\s\S]*?<\/div>/,
            ''
        );
        
        // Write the updated HTML
        await fs.writeFile(eventsHtmlPath, eventsHtml, 'utf8');
        
        console.log('✅ Successfully generated static events listing page');
        console.log(`📊 Generated ${events.length} event cards`);
        console.log(`🎯 Generated ${featuredEvents.length} featured slides`);
        
    } catch (error) {
        console.error('❌ Error generating events listing SSG:', error);
        console.log('⚠️ Events listing will remain dynamic');
    }
}

// Run if called directly
if (require.main === module) {
    generateEventsListingPage();
}

module.exports = { generateEventsListingPage }; 