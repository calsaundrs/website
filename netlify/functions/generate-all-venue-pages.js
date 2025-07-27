const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Generate all venue pages function called');
    
    try {
        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }
        
        // Initialize Firebase
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
        }
        const db = admin.firestore();
        
        console.log('Firebase initialized successfully');
        
        // Get all venues from Firestore
        console.log('Fetching all venues from database...');
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.get();
        
        console.log(`Found ${snapshot.size} venues in database`);
        
        const venues = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const venue = {
                id: doc.id,
                name: data.name || data['Name'] || 'Untitled Venue',
                slug: data.slug || data['Slug'] || generateSlug(data.name || data['Name'] || 'venue'),
                description: data.description || data['Description'] || '',
                address: data.address || data['Address'] || '',
                status: data.status || 'pending',
                image: data.image || data['Image'] || null,
                website: data.website || data['Website'] || '',
                contactPhone: data.contactPhone || data['Contact Phone'] || '',
                openingHours: data.openingHours || data['Opening Hours'] || '',
                accessibility: data.accessibility || data['Accessibility'] || '',
                features: data.features || data['Features'] || [],
                socialMedia: data.socialMedia || data['Social Media'] || {},
                tags: data.tags || data['Tags'] || []
            };
            
            venues.push(venue);
            console.log(`Processing venue: ${venue.name} (${venue.slug})`);
        });
        
        // Ensure venue directory exists
        const venueDir = path.join(process.cwd(), 'venue');
        if (!fsSync.existsSync(venueDir)) {
            await fs.mkdir(venueDir, { recursive: true });
        }
        
        // Generate HTML template for venue pages
        const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{venue.name}} - LGBTQ+ Venue in Birmingham | Brum Outloud</title>
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
</head>
<body class="antialiased">
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MMTDFZGH"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
    
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-MMTDFZGH');</script>
    <!-- End Google Tag Manager -->
    
    <div class="bg-yellow-500 text-black text-center p-2 text-sm font-semibold">
        <p>Please note: This website is in active development. Things may break unexpectedly. Thank you for your patience!</p>
    </div>

    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="flex items-center text-2xl tracking-widest text-white"
               style="font-family: 'Omnes Pro', sans-serif;">
                <span>Brum Outloud</span>
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded"
                     onerror="this.src='https://placehold.co/24x24/000000/FFFFFF?text=🏳️‍🌈'; this.onerror=null;">
            </a>
            <div class="hidden lg:flex items-center space-x-8">
                <a href="/events.html" class="text-gray-300 hover:text-white">WHAT'S ON</a>
                <a href="/all-venues.html" class="text-gray-300 hover:text-white">VENUES</a>
                <a href="/community.html" class="text-gray-300 hover:text-white">COMMUNITY</a>
                <a href="/contact.html" class="text-gray-300 hover:text-white">CONTACT</a>
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

    <main class="container mx-auto px-4 py-12">
        <div class="max-w-4xl mx-auto">
            <!-- Breadcrumb -->
            <nav class="mb-8">
                <a href="/all-venues.html" class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Venues
                </a>
            </nav>
            
            <!-- Venue Header -->
            <div class="venue-card rounded-xl overflow-hidden mb-8">
                <div class="aspect-2-1 bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center overflow-hidden">
                    {{#if venue.image}}
                    <img src="{{venue.image.url}}" alt="{{venue.name}}" class="w-full h-full object-cover object-center">
                    {{else}}
                    <div class="text-center text-gray-400">
                        <i class="fas fa-store-alt fa-4x mb-4"></i>
                        <p>No image available</p>
                    </div>
                    {{/if}}
                </div>
                <div class="p-8">
                    <h1 class="text-4xl font-bold text-white mb-4">{{venue.name}}</h1>
                    {{#if venue.address}}
                    <p class="text-gray-400 text-lg mb-4">
                        <i class="fas fa-map-marker-alt mr-2"></i>{{venue.address}}
                    </p>
                    {{/if}}
                    {{#if venue.description}}
                    <p class="text-gray-300 text-lg leading-relaxed">{{venue.description}}</p>
                    {{/if}}
                </div>
            </div>
            
            <!-- Venue Details -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Contact Information -->
                <div class="venue-card p-6">
                    <h2 class="text-2xl font-bold text-white mb-4">Contact Information</h2>
                    <div class="space-y-3">
                        {{#if venue.website}}
                        <div class="flex items-center">
                            <i class="fas fa-globe text-accent-color mr-3"></i>
                            <a href="{{venue.website}}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300">Visit Website</a>
                        </div>
                        {{/if}}
                        {{#if venue.contactPhone}}
                        <div class="flex items-center">
                            <i class="fas fa-phone text-accent-color mr-3"></i>
                            <span class="text-gray-300">{{venue.contactPhone}}</span>
                        </div>
                        {{/if}}
                        {{#if venue.openingHours}}
                        <div class="flex items-center">
                            <i class="fas fa-clock text-accent-color mr-3"></i>
                            <span class="text-gray-300">{{venue.openingHours}}</span>
                        </div>
                        {{/if}}
                    </div>
                </div>
                
                <!-- Features & Accessibility -->
                <div class="venue-card p-6">
                    <h2 class="text-2xl font-bold text-white mb-4">Features & Accessibility</h2>
                    <div class="space-y-3">
                        {{#if venue.accessibility}}
                        <div class="flex items-start">
                            <i class="fas fa-wheelchair text-accent-color mr-3 mt-1"></i>
                            <span class="text-gray-300">{{venue.accessibility}}</span>
                        </div>
                        {{/if}}
                        {{#if venue.features}}
                        <div class="flex items-start">
                            <i class="fas fa-star text-accent-color mr-3 mt-1"></i>
                            <div class="text-gray-300">
                                {{#each venue.features}}
                                <span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full mr-2 mb-2">{{this}}</span>
                                {{/each}}
                            </div>
                        </div>
                        {{/if}}
                    </div>
                </div>
            </div>
            
            <!-- Social Media -->
            {{#if venue.socialMedia}}
            <div class="venue-card p-6 mt-8">
                <h2 class="text-2xl font-bold text-white mb-4">Follow Us</h2>
                <div class="flex space-x-4">
                    {{#if venue.socialMedia.instagram}}
                    <a href="{{venue.socialMedia.instagram}}" target="_blank" rel="noopener noreferrer" class="text-pink-400 hover:text-pink-300 text-2xl">
                        <i class="fab fa-instagram"></i>
                    </a>
                    {{/if}}
                    {{#if venue.socialMedia.facebook}}
                    <a href="{{venue.socialMedia.facebook}}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 text-2xl">
                        <i class="fab fa-facebook"></i>
                    </a>
                    {{/if}}
                    {{#if venue.socialMedia.twitter}}
                    <a href="{{venue.socialMedia.twitter}}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 text-2xl">
                        <i class="fab fa-twitter"></i>
                    </a>
                    {{/if}}
                </div>
            </div>
            {{/if}}
        </div>
    </main>
    
    <footer class="border-t-2 border-gray-800 p-8">
        <div class="container mx-auto grid md:grid-cols-2">
            <div>
                <h3 class="font-anton text-5xl leading-tight text-white">BE SEEN,<br>BE HEARD.</h3>
                <div class="flex space-x-6 text-2xl mt-6 text-gray-400">
                    <a href="https://www.instagram.com/brumoutloud/" target="_blank" rel="noopener noreferrer" class="hover:text-pink-400 transition-colors"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-8 mt-8 md:mt-0">
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">Explore</h4>
                    <ul>
                        <li class="mb-2"><a href="/events.html" class="text-gray-400 hover:text-white transition-colors">Events</a></li>
                        <li class="mb-2"><a href="/all-venues.html" class="text-gray-400 hover:text-white transition-colors">Venues</a></li>
                        <li class="mb-2"><a href="/promoter-tool" class="text-gray-400 hover:text-white transition-colors">Promoter Tools</a></li>
                        <li class="mb-2"><a href="/admin/settings" class="text-gray-400 hover:text-white transition-colors">ADMIN</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">About</h4>
                    <ul>
                        <li class="mb-2"><a href="/community.html" class="text-gray-400 hover:text-white transition-colors">Community & FAQ</a></li>
                        <li class="mb-2"><a href="/contact" class="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                        <li class="mb-2"><a href="/privacy-policy.html" class="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                        <li class="mb-2"><a href="/terms-and-conditions.html" class="text-gray-400 hover:text-white transition-colors">Terms and Conditions</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>

    <script>
        // Mobile menu toggle
        document.getElementById('menu-btn').addEventListener('click', function() {
            document.getElementById('menu').classList.toggle('hidden');
        });
    </script>
</body>
</html>`;
        
        // Simple template renderer
        function renderTemplate(template, data) {
            let result = template;
            
            // Replace simple variables
            result = result.replace(/\{\{venue\.(\w+)\}\}/g, (match, field) => {
                return data[field] || '';
            });
            
            // Handle conditional blocks
            result = result.replace(/\{\{#if venue\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, field, content) => {
                if (data[field] && data[field] !== '') {
                    return content;
                }
                return '';
            });
            
            // Handle arrays
            result = result.replace(/\{\{#each venue\.(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, field, content) => {
                if (Array.isArray(data[field])) {
                    return data[field].map(item => {
                        return content.replace(/\{\{this\}\}/g, item);
                    }).join('');
                }
                return '';
            });
            
            return result;
        }
        
        // Generate slug function
        function generateSlug(name) {
            return (name || 'venue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }
        
        // Generate pages for all venues
        const generatedFiles = [];
        for (const venue of venues) {
            try {
                console.log(`Generating page for: ${venue.name} (${venue.slug})`);
                
                const html = renderTemplate(template, venue);
                const filePath = path.join(venueDir, `${venue.slug}.html`);
                
                await fs.writeFile(filePath, html);
                generatedFiles.push(filePath);
                
                console.log(`✅ Generated: ${filePath}`);
            } catch (error) {
                console.error(`❌ Error generating page for ${venue.name}:`, error);
            }
        }
        
        console.log(`Successfully generated ${generatedFiles.length} venue pages`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'All venue pages generated successfully',
                totalVenues: venues.length,
                generatedFiles: generatedFiles.length,
                venues: venues.map(v => ({ name: v.name, slug: v.slug }))
            })
        };
        
    } catch (error) {
        console.error('Generate all venue pages failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Generate all venue pages failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};