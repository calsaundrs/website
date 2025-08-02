const fs = require('fs').promises;
const path = require('path');

// Build events listing page using deployed API endpoints
async function generateEventsListingPage() {
    try {
        console.log('🚀 Starting Events Listing SSG from API...');
        
        // Try to fetch from deployed API endpoint
        // Use existing production site during builds
        const apiUrl = 'https://new.brumoutloud.co.uk';
        const eventsApiUrl = `${apiUrl}/.netlify/functions/get-events-firestore-simple`;
        
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
        
        // Generate event cards HTML
        const eventCardsHtml = events.map(event => {
            const imageUrl = event.imageUrl || event.image?.url || '';
            const categories = Array.isArray(event.category) ? event.category : (event.category ? [event.category] : []);
            
            const categoryTags = categories.map(cat => 
                `<span class="bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full">${cat}</span>`
            ).join(' ');
            
            // Format date safely
            let dateDisplay = '';
            let timeDisplay = '';
            try {
                const eventDate = new Date(event.date || event.startDate);
                if (!isNaN(eventDate.getTime())) {
                    dateDisplay = eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    timeDisplay = eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                }
            } catch (e) {
                dateDisplay = 'TBC';
                timeDisplay = 'TBC';
            }
            
            return `
                <div class="event-card rounded-xl overflow-hidden cursor-pointer hover:transform hover:scale-105 transition-all duration-300" 
                     onclick="window.location.href='/event/${event.slug}'">
                    <div class="aspect-[4/3] bg-gradient-to-br from-purple-600/20 to-blue-600/20 overflow-hidden">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${event.name}" class="w-full h-full object-cover">` : ''}
                    </div>
                    <div class="p-4">
                        <div class="flex justify-between items-start mb-2">
                            <span class="bg-accent-color text-white text-xs px-2 py-1 rounded-full font-bold">
                                ${dateDisplay}
                            </span>
                        </div>
                        <h3 class="text-lg font-bold text-white mb-2 line-clamp-2">${event.name}</h3>
                        <p class="text-gray-400 text-sm mb-3 flex items-center">
                            <i class="fas fa-clock text-xs mr-1"></i>
                            ${timeDisplay}
                            • 
                            <i class="fas fa-map-marker-alt text-xs ml-2 mr-1"></i>
                            ${event.venueName || event.venue?.name || 'TBC'}
                        </p>
                        <div class="flex flex-wrap gap-1">
                            ${categoryTags}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
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
        
        // Replace placeholders with generated content
        eventsHtml = eventsHtml.replace(
            /<!-- EVENTS_GRID_SSG_PLACEHOLDER -->/g,
            eventCardsHtml
        );
        
        eventsHtml = eventsHtml.replace(
            /<!-- FEATURED_SLIDESHOW_SSG_PLACEHOLDER -->/g,
            featuredSlideshowHtml
        );
        
        eventsHtml = eventsHtml.replace(
            /<!-- FEATURED_DOTS_SSG_PLACEHOLDER -->/g,
            featuredDotsHtml
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