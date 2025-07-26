const fs = require('fs').promises;
const path = require('path');

// Sample venue data (you can replace this with your actual venue data)
const sampleVenues = [
    {
        id: 'nightingale-club',
        name: 'The Nightingale Club',
        slug: 'nightingale-club',
        description: 'Birmingham\'s premier LGBTQ+ nightclub, featuring multiple floors of entertainment, drag shows, and themed nights.',
        address: '18 Kent Street, Birmingham, B5 6RD',
        link: 'https://nightingaleclub.co.uk',
        image: { url: 'https://placehold.co/800x400/1e1e1e/EAEAEA?text=The+Nightingale+Club' },
        category: ['LGBTQ+', 'Nightclub', 'Drag Shows'],
        openingHours: 'Mon-Sun: 9pm-3am',
        popular: true
    },
    {
        id: 'village-inn',
        name: 'The Village Inn',
        slug: 'village-inn',
        description: 'A welcoming LGBTQ+ pub in the heart of Birmingham\'s Gay Village, offering great drinks and a friendly atmosphere.',
        address: '22 Hurst Street, Birmingham, B5 4TD',
        link: 'https://villageinnbirmingham.co.uk',
        image: { url: 'https://placehold.co/800x400/1e1e1e/EAEAEA?text=The+Village+Inn' },
        category: ['LGBTQ+', 'Pub', 'Bar'],
        openingHours: 'Mon-Sun: 12pm-12am',
        popular: true
    },
    {
        id: 'loft-lounge',
        name: 'The Loft Lounge',
        slug: 'loft-lounge',
        description: 'Sophisticated cocktail bar with stunning city views, perfect for pre-drinks or a relaxed evening out.',
        address: '15 Hurst Street, Birmingham, B5 4TD',
        link: 'https://loftloungebirmingham.co.uk',
        image: { url: 'https://placehold.co/800x400/1e1e1e/EAEAEA?text=The+Loft+Lounge' },
        category: ['LGBTQ+', 'Cocktail Bar', 'Lounge'],
        openingHours: 'Tue-Sun: 5pm-2am',
        popular: false
    },
    {
        id: 'rainbow-bar',
        name: 'The Rainbow Bar',
        slug: 'rainbow-bar',
        description: 'Vibrant LGBTQ+ bar with regular karaoke nights, quiz events, and a welcoming community atmosphere.',
        address: '28 Hurst Street, Birmingham, B5 4TD',
        link: 'https://rainbowbarbirmingham.co.uk',
        image: { url: 'https://placehold.co/800x400/1e1e1e/EAEAEA?text=The+Rainbow+Bar' },
        category: ['LGBTQ+', 'Bar', 'Karaoke'],
        openingHours: 'Mon-Sun: 2pm-2am',
        popular: false
    },
    {
        id: 'pride-center',
        name: 'The Pride Center',
        slug: 'pride-center',
        description: 'Community center and event space for LGBTQ+ groups, offering support services and social events.',
        address: '38-40 Hurst Street, Birmingham, B5 4TD',
        link: 'https://pridecenterbirmingham.co.uk',
        image: { url: 'https://placehold.co/800x400/1e1e1e/EAEAEA?text=The+Pride+Center' },
        category: ['LGBTQ+', 'Community Center', 'Support'],
        openingHours: 'Mon-Fri: 10am-6pm, Sat: 10am-4pm',
        popular: true
    }
];

// The exact same HTML template as used in the dynamic system
const templateContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{venue.name}} - BrumOutLoud</title>
    <meta name="description" content="{{venue.description}}">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="{{venue.name}}">
    <meta property="og:description" content="{{venue.description}}">
    <meta property="og:type" content="business.business">
    <meta property="og:url" content="https://brumoutloud.co.uk/venue/{{venue.slug}}">
    {{#if venue.image}}
    <meta property="og:image" content="{{venue.image.url}}">
    {{/if}}
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{venue.name}}">
    <meta name="twitter:description" content="{{venue.description}}">
    {{#if venue.image}}
    <meta name="twitter:image" content="{{venue.image.url}}">
    {{/if}}
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    
    <!-- Styles -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    
    <style>
        /* Base Styles */
        body {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%);
            color: #EAEAEA;
            font-family: 'Poppins', sans-serif;
            min-height: 100vh;
        }
        .font-anton {
            font-family: 'Anton', sans-serif;
            letter-spacing: 0.05em;
        }

        /* Updated Core Colour Palette Classes */
        .accent-color { color: #E83A99; }
        .bg-accent-color { background-color: #E83A99; }
        .border-accent-color { border-color: #E83A99; }
        .accent-color-secondary { color: #8B5CF6; }
        .bg-accent-color-secondary { background-color: #8B5CF6; }

        /* Modern Glassmorphism Components */
        .card-bg {
            background: rgba(17, 24, 39, 0.7);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(75, 85, 99, 0.3);
            border-radius: 1.25rem;
        }

        .venue-card {
            background: rgba(31, 41, 55, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(75, 85, 99, 0.3);
            border-radius: 1rem;
        }

        .btn-primary {
            background: linear-gradient(135deg, #E83A99 0%, #8B5CF6 100%);
            border: 1px solid rgba(232, 58, 153, 0.3);
            transition: all 0.3s ease;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #D61F69 0%, #7C3AED 100%);
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: rgba(75, 85, 99, 0.3);
            border: 1px solid rgba(75, 85, 99, 0.5);
            transition: all 0.3s ease;
        }
        .btn-secondary:hover {
            background: rgba(75, 85, 99, 0.5);
        }

        .heading-gradient {
            background: linear-gradient(135deg, #FFFFFF 0%, #E83A99 50%, #8B5CF6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            display: inline-block;
        }
        .status-badge.approved {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <!-- Site name with consolidated flag image and fallback -->
            <a href="/" class="flex items-center text-2xl tracking-widest text-white"
               style="font-family: 'Omnes Pro', sans-serif;">
                <span>Brum Outloud</span>
                <!-- Consolidated flag image: tries to load header_flag.png, falls back to emoji placeholder -->
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded" loading="lazy"
                     onerror="this.src='https://placehold.co/24x24/000000/FFFFFF?text=🏳️‍🌈'; this.onerror=null;"
                     onload="document.body.classList.add('flag-loaded')">
            </a>
            <div class="hidden lg:flex items-center space-x-8">
                <a href="/events.html" class="text-gray-300 hover:text-white">WHAT'S ON</a>
                <a href="/all-venues.html" class="text-gray-300 hover:text-white">VENUES</a>
                <a href="/community.html" class="text-gray-300 hover:text-white">COMMUNITY</a>
                <a href="/contact.html" class="text-gray-300 hover:text-white">CONTACT</a>
                <!-- GET LISTED button styling reverted to original Tailwind classes -->
                <a href="/promoter-tool.html" class="inline-block bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200">GET LISTED</a>
            </div>
            <div class="lg:hidden relative z-[60]">
                <button id="menu-btn" class="text-white text-2xl">
                    <i class="fas fa-bars"></i>
                </button>
            </div>
        </nav>
        <div id="menu" class="hidden lg:hidden fixed inset-0 bg-gray-900 z-50 flex-col items-center justify-center space-y-6">
            <a href="/events.html" class="block text-white text-4xl py-4 hover:text-gray-300">WHAT'S ON</a>
            <a href="/all-venues.html" class="block text-white text-4xl py-4 hover:text-gray-300">VENUES</a>
            <a href="/community.html" class="block text-white text-4xl py-4 hover:text-gray-300">COMMUNITY</a>
            <a href="/contact.html" class="block text-white text-4xl py-4 hover:text-gray-300">CONTACT</a>
            <a href="/promoter-tool.html" class="block mt-4 text-center bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors duration-200 text-2xl px-8 py-4">GET LISTED</a>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8">

        <!-- Venue Details -->
        <div class="venue-card rounded-xl overflow-hidden">
            <!-- Hero Image -->
            <div class="aspect-[2/1] bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center relative">
                {{#if venue.image}}
                <img src="{{venue.image.url}}" alt="{{venue.name}}" class="w-full h-full object-cover">
                {{else}}
                <i class="fas fa-building text-6xl text-gray-600"></i>
                {{/if}}
                <div class="absolute top-4 left-4">
                    <a href="/all-venues.html" class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                        <i class="fas fa-arrow-left mr-1"></i>Back
                    </a>
                </div>
                <div class="absolute top-4 right-4">
                    <button class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                        <i class="fas fa-share mr-1"></i>Share
                    </button>
                </div>
            </div>
            
            <div class="p-8">
                <!-- Venue Header -->
                <div class="mb-8">
                    <h1 class="text-4xl font-bold text-white mb-4">{{venue.name}}</h1>
                    <p class="text-xl text-gray-300 mb-4">
                        <i class="fas fa-map-marker-alt mr-2 text-accent-color"></i>
                        {{venue.address}}
                    </p>
                    <div class="flex flex-wrap gap-2 mb-6">
                        {{{categoryTags}}}
                    </div>
                </div>

                <!-- Venue Content -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Main Content -->
                    <div class="lg:col-span-2">
                        {{#if venue.description}}
                        <div class="venue-card p-6 mb-6">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-info-circle mr-3 text-accent-color"></i>About This Venue
                            </h2>
                            <p class="text-gray-300 leading-relaxed">{{venue.description}}</p>
                        </div>
                        {{/if}}

                        <!-- Upcoming Events -->
                        {{#if hasUpcomingEvents}}
                        <div class="venue-card p-6">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-calendar mr-3 text-accent-color"></i>Upcoming Events
                            </h2>
                            <div class="space-y-4">
                                {{#each upcomingEvents}}
                                <a href="/event/{{slug}}" class="venue-card p-4 flex items-center space-x-4 hover:bg-gray-800 transition-colors duration-200 block">
                                    <div class="text-center w-20 flex-shrink-0">
                                        <p class="text-2xl font-bold text-white">{{formatDay date}}</p>
                                        <p class="text-lg text-gray-400">{{formatMonth date}}</p>
                                    </div>
                                    <div class="flex-grow">
                                        <h4 class="font-bold text-white text-xl">{{name}}</h4>
                                        <p class="text-sm text-gray-400">{{formatTime date}}</p>
                                    </div>
                                    <div class="text-accent-color">
                                        <i class="fas fa-arrow-right"></i>
                                    </div>
                                </a>
                                {{/each}}
                            </div>
                        </div>
                        {{/if}}
                    </div>

                    <!-- Sidebar -->
                    <div class="space-y-6">

                        <!-- Action Buttons -->
                        {{#if venue.link}}
                        <div class="venue-card p-6">
                            <div class="space-y-3">
                                <a href="{{venue.link}}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold flex items-center justify-center">
                                    <i class="fas fa-external-link-alt mr-2"></i>Visit Website
                                </a>
                            </div>
                        </div>
                        {{/if}}

                        <!-- Opening Hours -->
                        {{#if venue.openingHours}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-clock mr-2 text-accent-color"></i>Opening Hours
                            </h3>
                            <div class="space-y-2 text-gray-300 text-sm">
                                <pre class="whitespace-pre-wrap">{{venue.openingHours}}</pre>
                            </div>
                        </div>
                        {{/if}}

                        <!-- Share Venue -->
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-share-alt mr-2 text-accent-color"></i>Share This Venue
                            </h3>
                            <button class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold">
                                <i class="fas fa-share-alt mr-2"></i>Share Venue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="border-t-2 border-gray-800 p-8">
        <div class="container mx-auto grid md:grid-cols-2">
            <div>
                 <h3 class="font-anton text-5xl leading-tight text-white">BE SEEN,<br>BE HEARD.</h3>
                 <div class="flex space-x-6 text-2xl mt-6 text-gray-400">
                    <a href="https://www.instagram.com/brumoutloud/" target="_blank" rel="noopener noreferrer" class="hover:accent-color"><i class="fab fa-instagram"></i></a>
                 </div>
            </div>
            <div class="grid grid-cols-2 gap-8 mt-8 md:mt-0">
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">Explore</h4>
                    <ul>
                        <li class="mb-2"><a href="/events.html" class="text-gray-400 hover:text-white">Events</a></li>
                        <li class="mb-2"><a href="/all-venues.html" class="text-gray-400 hover:text-white">Venues</a></li>
                        <li class="mb-2"><a href="/promoter-tool" class="text-gray-400 hover:text-white">Promoter Tools</a></li>
                        <li class="mb-2"><a href="/admin/settings" class="text-gray-400 hover:text-white">ADMIN</a></li>
                    </ul>
                </div>
                 <div>
                    <h4 class="font-bold text-lg mb-4 text-white">About</h4>
                    <ul>
                        <li class="mb-2"><a href="/community.html" class="text-gray-400 hover:text-white">Community & FAQ</a></li>
                        <li class="mb-2"><a href="/contact" class="text-gray-400 hover:text-white">Contact</a></li>
                        <li class="mb-2"><a href="/privacy-policy.html" class="text-gray-400 hover:text-white">Privacy Policy</a></li>
                        <li class="mb-2"><a href="/terms-and-conditions.html" class="text-gray-400 hover:text-white">Terms and Conditions</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>
</body>
</html>`;

// Simple template engine (no Handlebars dependency)
function renderTemplate(template, data) {
    let result = template;
    
    // Replace simple variables
    result = result.replace(/\{\{venue\.(\w+)\}\}/g, (match, key) => {
        return data.venue[key] || '';
    });
    
    // Replace nested object properties (like venue.image.url)
    result = result.replace(/\{\{venue\.(\w+)\.(\w+)\}\}/g, (match, objKey, propKey) => {
        return data.venue[objKey] && data.venue[objKey][propKey] ? data.venue[objKey][propKey] : '';
    });
    
    // Replace conditional blocks
    result = result.replace(/\{\{#if venue\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
        return data.venue[key] ? content : '';
    });
    
    // Replace category tags
    result = result.replace(/\{\{\{categoryTags\}\}\}/g, generateCategoryTags(data.venue.category));
    
    // Replace upcoming events
    result = result.replace(/\{\{#if hasUpcomingEvents\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, content) => {
        return data.hasUpcomingEvents ? content : '';
    });
    
    return result;
}

function generateCategoryTags(categories) {
    if (!categories || categories.length === 0) {
        return '<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full">LGBTQ+</span>';
    }
    
    return categories.map(category => 
        `<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full">${category}</span>`
    ).join('');
}

async function generateVenuePage(venue) {
    try {
        console.log(`📝 Generating page for: ${venue.name}`);
        
        const templateData = {
            venue: venue,
            hasUpcomingEvents: false, // No events for sample data
            upcomingEvents: []
        };
        
        const html = renderTemplate(templateContent, templateData);
        
        // Create venue directory if it doesn't exist
        const venueDir = path.join(__dirname, 'venue');
        await fs.mkdir(venueDir, { recursive: true });
        
        // Write the HTML file
        const filePath = path.join(venueDir, `${venue.slug}.html`);
        await fs.writeFile(filePath, html, 'utf8');
        
        console.log(`✅ Generated: ${filePath}`);
        return filePath;
        
    } catch (error) {
        console.error(`❌ Failed to generate page for ${venue.name}:`, error);
        throw error;
    }
}

async function generateAllVenuePages() {
    try {
        console.log('🚀 Starting Simple Venue SSG Build...');
        console.log(`📄 Found ${sampleVenues.length} venues to generate`);
        
        const generatedFiles = [];
        
        for (const venue of sampleVenues) {
            try {
                const filePath = await generateVenuePage(venue);
                generatedFiles.push(filePath);
            } catch (error) {
                console.error(`Failed to generate page for ${venue.name}:`, error);
            }
        }
        
        console.log(`✅ Successfully generated ${generatedFiles.length} venue pages`);
        
        // Create a sitemap entry for venues
        const sitemapEntries = generatedFiles.map(filePath => {
            const slug = path.basename(filePath, '.html');
            return `https://www.brumoutloud.co.uk/venue/${slug}`;
        });
        
        console.log('📋 Venue URLs for sitemap:');
        sitemapEntries.forEach(url => console.log(`  ${url}`));
        
        return {
            totalVenues: sampleVenues.length,
            generatedFiles: generatedFiles.length,
            sitemapEntries: sitemapEntries
        };
        
    } catch (error) {
        console.error('❌ Error during SSG:', error);
        throw error;
    }
}

// Run the SSG if this script is executed directly
if (require.main === module) {
    generateAllVenuePages()
        .then(result => {
            console.log('🎉 Simple SSG completed successfully!');
            console.log(`Generated ${result.generatedFiles} venue pages`);
            console.log('📁 Files are ready in the venue/ directory');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Simple SSG failed:', error);
            process.exit(1);
        });
}

module.exports = { generateAllVenuePages, generateVenuePage, sampleVenues };