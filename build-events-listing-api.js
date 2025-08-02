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
                <div class="venue-card rounded-xl overflow-hidden cursor-pointer" 
                     onclick="window.location.href='/event/${event.slug}'">
                    <div class="aspect-video bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${event.name}" class="w-full h-full object-cover">` : '<i class="fas fa-image text-4xl text-gray-600"></i>'}
                    </div>
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-sm text-gray-400">${dateDisplay}</span>
                        </div>
                        <h3 class="text-xl font-bold text-white mb-2">${event.name}</h3>
                        <p class="text-gray-400 text-sm mb-3">${event.venueName || event.venue?.name || 'TBC'}</p>
                        <p class="text-gray-300 text-sm mb-4 line-clamp-2">${event.description || 'Click to view event details and get tickets.'}</p>
                        <div class="flex flex-wrap gap-1 mb-4">
                            ${categoryTags}
                        </div>
                        <div class="flex justify-between items-center">
                            <button class="btn-primary text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-eye mr-1"></i>View Details
                            </button>
                            <button class="btn-secondary text-white px-3 py-2 rounded-lg text-sm">
                                <i class="fas fa-share"></i>
                            </button>
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