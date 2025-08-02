const fs = require('fs').promises;
const path = require('path');

// Build venues listing page using deployed API endpoints
async function generateVenuesListingPage() {
    try {
        console.log('🚀 Starting Venues Listing SSG from API...');
        
        // Try to fetch from deployed API endpoint
        // Use existing production site during builds
        const apiUrl = 'https://new.brumoutloud.co.uk';
        const venuesApiUrl = `${apiUrl}/.netlify/functions/get-venues-firestore`;
        
        console.log('📡 Fetching venues from:', venuesApiUrl);
        
        // Use dynamic import for fetch
        const { default: fetch } = await import('node-fetch');
        
        const response = await fetch(venuesApiUrl, {
            headers: {
                'User-Agent': 'Netlify-Build-SSG'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API responded with ${response.status}: ${response.statusText}`);
        }
        
        const apiData = await response.json();
        const venues = apiData.venues || [];
        
        console.log(`📊 Fetched ${venues.length} venues from API`);
        
        if (venues.length === 0) {
            console.log('⚠️ No venues found, skipping SSG generation');
            return;
        }
        
        // Read the current all-venues.html template
        const venuesHtmlPath = path.join(process.cwd(), 'all-venues.html');
        let venuesHtml = await fs.readFile(venuesHtmlPath, 'utf8');
        
        // Generate venue cards HTML
        const venueCardsHtml = venues.map(venue => {
            const imageUrl = venue.image?.url || '';
            const categories = Array.isArray(venue.category) ? venue.category : (venue.category ? [venue.category] : []);
            
            const categoryTags = categories.map(cat => 
                `<span class="bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full">${cat}</span>`
            ).join(' ');
            
            return `
                <div class="venue-card rounded-xl overflow-hidden cursor-pointer hover:transform hover:scale-105 transition-all duration-300" 
                     onclick="window.location.href='/venue/${venue.slug}'">
                    <div class="aspect-[4/3] bg-gradient-to-br from-purple-600/20 to-blue-600/20 overflow-hidden">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${venue.name}" class="w-full h-full object-cover">` : ''}
                    </div>
                    <div class="p-4">
                        <h3 class="text-lg font-bold text-white mb-2 line-clamp-2">${venue.name}</h3>
                        ${venue.address ? `
                        <p class="text-gray-400 text-sm mb-3 flex items-center">
                            <i class="fas fa-map-marker-alt text-xs mr-1"></i>
                            ${venue.address}
                        </p>
                        ` : ''}
                        ${venue.description ? `
                        <p class="text-gray-300 text-sm mb-3 line-clamp-2">${venue.description}</p>
                        ` : ''}
                        <div class="flex flex-wrap gap-1">
                            ${categoryTags}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Replace placeholder with generated content
        venuesHtml = venuesHtml.replace(
            /<!-- VENUES_GRID_SSG_PLACEHOLDER -->/g,
            venueCardsHtml
        );
        
        // Remove the loading state
        venuesHtml = venuesHtml.replace(
            /<div class="col-span-full text-center venue-card p-12">[\s\S]*?<\/div>/,
            ''
        );
        
        // Write the updated HTML
        await fs.writeFile(venuesHtmlPath, venuesHtml, 'utf8');
        
        console.log('✅ Successfully generated static venues listing page');
        console.log(`📊 Generated ${venues.length} venue cards`);
        
    } catch (error) {
        console.error('❌ Error generating venues listing SSG:', error);
        console.log('⚠️ Venues listing will remain dynamic');
    }
}

// Run if called directly
if (require.main === module) {
    generateVenuesListingPage();
}

module.exports = { generateVenuesListingPage }; 