const fs = require('fs').promises;
const path = require('path');

// Build venues listing page using deployed API endpoints
async function generateVenuesListingPage() {
    try {
        console.log('🚀 Starting Venues Listing SSG from API...');
        
        // Try to fetch from deployed API endpoint
        // Use existing production site during builds
        const apiUrl = 'https://brumoutloud.co.uk';
        const venuesApiUrl = `${apiUrl}/.netlify/functions/get-venues`;
        
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
        
        // Generate venue cards HTML matching design system
        const venueCardsHtml = venues.map(venue => {
            const imageUrl = venue.image?.url || '';
            const categories = Array.isArray(venue.category) ? venue.category : (venue.category ? [venue.category] : []);
            
            const categoryTags = categories.map(cat => 
                `<span class="inline-block bg-purple-100/20 text-purple-300 text-xs px-2 py-1 rounded-full">${cat}</span>`
            ).join(' ');
            
            return `
                <div class="venue-card p-0 group" 
                     onclick="window.location.href='/venue/${venue.slug}'">
                    <div class="item-card-image-container relative overflow-hidden bg-black">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${venue.name}" class="item-card-image w-full h-full object-cover">` : `
                            <div class="h-full w-full bg-black flex items-center justify-center">
                                <i class="fas fa-building text-4xl text-gray-800"></i>
                            </div>
                        `}
                    </div>
                    <div class="p-6">
                        <h3 class="text-2xl font-bold mb-3">${venue.name}</h3>
                        ${venue.address ? `
                            <p class="text-[var(--color-toxic)] font-bold text-sm mb-3 flex items-center">
                                <i class="fas fa-map-marker-alt mr-2"></i>${venue.address}
                            </p>
                        ` : ''}
                        <p class="text-gray-300 text-sm mb-6 line-clamp-2">
                            ${venue.description || 'A fantastic LGBTQ+ venue in Birmingham.'}
                        </p>
                        <div class="flex flex-wrap gap-2 mb-6">
                            ${categories.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
                        </div>
                        <div class="flex gap-4">
                            <button class="btn-primary flex-1">
                                <i class="fas fa-eye mr-2"></i>VIEW VENUE
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Replace placeholder with generated content, removing old content until the end of the container
        venuesHtml = venuesHtml.replace(
            /<!-- VENUES_GRID_SSG_PLACEHOLDER -->[\s\S]*?(?=\s*<\/div>\s*<!-- No Results State -->)/g,
            `<!-- VENUES_GRID_SSG_PLACEHOLDER -->\n${venueCardsHtml}`
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