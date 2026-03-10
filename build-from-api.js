const fs = require('fs');
const path = require('path');

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
        }

        .status-open {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
            border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .status-closed {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .status-unknown {
            background: rgba(156, 163, 175, 0.1);
            color: #9ca3af;
            border: 1px solid rgba(156, 163, 175, 0.3);
        }

        .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .aspect-2-1 {
            aspect-ratio: 2 / 1;
        }

        /* Mobile menu styles */
        .mobile-menu {
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out;
        }
        .mobile-menu.open {
            transform: translateX(0);
        }

        /* Share button styles */
        .share-button {
            position: relative;
        }
        .share-dropdown {
            position: absolute;
            top: 100%;
            right: 0;
            background: rgba(31, 41, 55, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(75, 85, 99, 0.3);
            border-radius: 0.5rem;
            padding: 0.5rem;
            z-index: 50;
            min-width: 200px;
            display: none;
        }
        .share-dropdown.show {
            display: block;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-40">
        <div class="container mx-auto px-4">
            <div class="flex justify-between items-center h-16">
                <!-- Logo -->
                <a href="/" class="font-anton text-2xl text-white hover:text-accent-color transition-colors">
                    BRUM OUT LOUD
                </a>

                <!-- Desktop Navigation -->
                <div class="hidden md:flex space-x-8">
                    <a href="/events.html" class="text-gray-300 hover:text-white transition-colors">Events</a>
                    <a href="/all-venues.html" class="text-gray-300 hover:text-white transition-colors">Venues</a>
                    <a href="/community.html" class="text-gray-300 hover:text-white transition-colors">Community</a>
                    <a href="/contact.html" class="text-gray-300 hover:text-white transition-colors">Contact</a>
                </div>

                <!-- Mobile menu button -->
                <button id="mobile-menu-btn" class="md:hidden text-white">
                    <i class="fas fa-bars text-xl"></i>
                </button>
            </div>
        </div>

        <!-- Mobile Navigation -->
        <div id="mobile-menu" class="mobile-menu md:hidden bg-gray-900/95 backdrop-blur-md border-t border-gray-800">
            <div class="container mx-auto px-4 py-4 space-y-4">
                <a href="/events.html" class="block text-gray-300 hover:text-white transition-colors">Events</a>
                <a href="/all-venues.html" class="block text-gray-300 hover:text-white transition-colors">Venues</a>
                <a href="/community.html" class="block text-gray-300 hover:text-white transition-colors">Community</a>
                <a href="/contact.html" class="block text-gray-300 hover:text-white transition-colors">Contact</a>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative">
        {{#if venue.image}}
        <div class="aspect-2-1 bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center overflow-hidden">
            <img src="{{venue.image.url}}" alt="{{venue.name}}" class="w-full h-full object-cover object-center">
        </div>
        {{else}}
        <div class="aspect-2-1 bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center">
            <div class="text-center">
                <i class="fas fa-store-alt text-6xl text-gray-600 mb-4"></i>
                <h1 class="text-4xl font-bold text-white">{{venue.name}}</h1>
            </div>
        </div>
        {{/if}}
        
        <!-- Hero Content Overlay -->
        <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div class="text-center">
                <h1 class="text-5xl md:text-7xl font-anton text-white mb-4">{{venue.name}}</h1>
                <p class="text-xl text-gray-300 mb-6 max-w-2xl mx-auto">{{venue.description}}</p>
                <div class="flex flex-wrap justify-center gap-4 mb-8">
                    {{#each venue.category}}
                    <span class="bg-accent-color/20 text-accent-color px-4 py-2 rounded-full text-sm font-semibold">{{this}}</span>
                    {{/each}}
                </div>
                <div class="flex justify-center space-x-4">
                    {{#if venue.link}}
                    <a href="{{venue.link}}" target="_blank" rel="noopener noreferrer" class="btn-primary px-8 py-3 rounded-lg font-semibold">
                        <i class="fas fa-external-link-alt mr-2"></i>Visit Website
                    </a>
                    {{/if}}
                    <button class="share-button btn-secondary px-6 py-3 rounded-lg font-semibold">
                        <i class="fas fa-share mr-2"></i>Share
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- Share Dropdown -->
    <div class="share-dropdown">
        <div class="space-y-2">
            <button onclick="shareOnFacebook()" class="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm">
                <i class="fab fa-facebook mr-2"></i>Share on Facebook
            </button>
            <button onclick="shareOnTwitter()" class="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm">
                <i class="fab fa-twitter mr-2"></i>Share on Twitter
            </button>
            <button onclick="copyLink()" class="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm">
                <i class="fas fa-link mr-2"></i>Copy Link
            </button>
        </div>
    </div>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-12">
        <div class="grid lg:grid-cols-3 gap-8">
            <!-- Main Content Column -->
            <div class="lg:col-span-2 space-y-6">
                <!-- About Section -->
                <div class="venue-card p-6">
                    <h2 class="text-2xl font-bold text-white mb-4">
                        <i class="fas fa-info-circle mr-3 text-accent-color"></i>About {{venue.name}}
                    </h2>
                    {{#if venue.description}}
                    <p class="text-gray-300 leading-relaxed">{{venue.description}}</p>
                    {{else}}
                    <p class="text-gray-400 italic">No description available.</p>
                    {{/if}}
                </div>

                <!-- Gallery -->
                {{#if googlePlaces.images.length}}
                <div class="venue-card p-6 mb-6">
                    <h2 class="text-2xl font-bold text-white mb-4">
                        <i class="fas fa-images mr-3 text-accent-color"></i>Gallery
                    </h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {{#each googlePlaces.images}}
                        <div class="aspect-square bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg overflow-hidden">
                            <img src="{{url}}" alt="Venue photo" class="w-full h-full object-cover">
                        </div>
                        {{/each}}
                    </div>
                    <p class="text-xs text-gray-500 mt-4 text-center">Images sourced from Google Places</p>
                </div>
                {{/if}}

                <!-- Google Reviews -->
                {{#if googlePlaces.reviews.length}}
                <div class="venue-card p-6 mb-6">
                    <h2 class="text-2xl font-bold text-white mb-4">
                        <i class="fab fa-google mr-3 text-accent-color"></i>Recent Reviews from Google
                    </h2>
                    <div class="space-y-4">
                        {{#each googlePlaces.reviews}}
                        <div class="p-4 bg-gray-800/50 rounded-lg">
                            <div class="flex items-center justify-between mb-2">
                                <p class="font-semibold text-white">{{author}}</p>
                                <div class="text-xs">
                                    {{#times rating}}<i class="fas fa-star text-yellow-400"></i>{{/times}}
                                    {{#times (subtract 5 rating)}}<i class="far fa-star text-yellow-400"></i>{{/times}}
                                </div>
                            </div>
                            <p class="text-gray-300 text-sm">{{text}}</p>
                        </div>
                        {{/each}}
                    </div>
                    <div class="mt-8 text-center">
                        <img src="https://www.gstatic.com/marketing-cms/assets/images/c5/3a/200414104c669203c62270f7884f/google-wordmarks-2x.webp" alt="Powered by Google" style="max-width:120px; height: auto; margin: 0 auto;">
                    </div>
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
                            <div class="text-accent-color"><i class="fas fa-arrow-right"></i></div>
                        </a>
                        {{/each}}
                    </div>
                </div>
                {{/if}}
            </div>

            <!-- Sidebar -->
            <div class="space-y-6">
                <!-- Current Status (simplified/hardcoded for now) -->
                <div class="venue-card p-6">
                    <h3 class="text-xl font-bold text-white mb-4 text-center">
                        <i class="fas fa-clock mr-2 text-accent-color"></i>Current Status
                    </h3>
                    <div class="p-3 rounded-lg border text-center bg-green-500/10 text-green-400 border-green-500/30 mb-4">
                        <p class="font-bold text-lg">Open</p>
                        <p class="text-sm">Currently open for business</p>
                    </div>
                </div>

                <!-- Opening Hours (simplified/hardcoded for now) -->
                <div class="venue-card p-6">
                    <h3 class="text-xl font-bold text-white mb-4 text-center">
                        <i class="fas fa-clock mr-2 text-accent-color"></i>Opening Hours
                    </h3>
                    <div class="space-y-2 text-gray-300 text-sm">
                        <p>Monday: 9:00 PM – 3:00 AM</p>
                        <p>Tuesday: 9:00 PM – 3:00 AM</p>
                        <p>Wednesday: 9:00 PM – 3:00 AM</p>
                        <p>Thursday: 9:00 PM – 3:00 AM</p>
                        <p>Friday: 9:00 PM – 3:00 AM</p>
                        <p>Saturday: 9:00 PM – 3:00 AM</p>
                        <p>Sunday: 9:00 PM – 3:00 AM</p>
                    </div>
                </div>

                <!-- Google Rating (simplified/hardcoded for now) -->
                <div class="venue-card p-6">
                    <h3 class="text-xl font-bold text-white mb-4 text-center">
                        <i class="fab fa-google mr-2 text-accent-color"></i>Google Rating
                    </h3>
                    <div class="flex items-center space-x-2 text-xl mb-2">
                        <div>
                            <i class="fas fa-star text-yellow-400"></i>
                            <i class="fas fa-star text-yellow-400"></i>
                            <i class="fas fa-star text-yellow-400"></i>
                            <i class="fas fa-star text-yellow-400"></i>
                            <i class="far fa-star text-yellow-400"></i>
                        </div>
                        <p class="text-white font-semibold">4.2 <span class="text-gray-400">(156)</span></p>
                    </div>
                    <a href="#" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline text-sm">View on Google Maps</a>
                </div>

                <!-- Contact Info (simplified/hardcoded for phone, dynamic for website) -->
                <div class="venue-card p-6">
                    <h3 class="text-xl font-bold text-white mb-4 text-center">
                        <i class="fas fa-phone mr-2 text-accent-color"></i>Contact Info
                    </h3>
                    <div class="space-y-3">
                        <div>
                            <p class="text-gray-400 text-sm">Phone</p>
                            <a href="tel:+44 121 622 4747" class="text-blue-400 hover:underline">+44 121 622 4747</a>
                        </div>
                        {{#if venue.link}}
                        <div>
                            <p class="text-gray-400 text-sm">Website</p>
                            <a href="{{venue.link}}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">Visit Website</a>
                        </div>
                        {{/if}}
                    </div>
                </div>

                <!-- Address -->
                <div class="venue-card p-6">
                    <h3 class="text-xl font-bold text-white mb-4 text-center">
                        <i class="fas fa-map-marker-alt mr-2 text-accent-color"></i>Address
                    </h3>
                    <p class="text-gray-300 text-center">{{venue.address}}</p>
                    <div class="mt-4 text-center">
                        <a href="#" target="_blank" rel="noopener noreferrer" class="btn-primary px-6 py-2 rounded-lg text-sm">
                            <i class="fas fa-directions mr-2"></i>Get Directions
                        </a>
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
                    <a href="https://www.instagram.com/brumoutloud/" target="_blank" rel="noopener noreferrer" class="hover:text-accent-color transition-colors"><i class="fab fa-instagram"></i></a>
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
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');

        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('open');
        });

        // Share functionality
        const shareButton = document.querySelector('.share-button');
        const shareDropdown = document.querySelector('.share-dropdown');

        shareButton.addEventListener('click', () => {
            shareDropdown.classList.toggle('show');
        });

        // Close share dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!shareButton.contains(e.target) && !shareDropdown.contains(e.target)) {
                shareDropdown.classList.remove('show');
            }
        });

        function shareOnFacebook() {
            const url = encodeURIComponent(window.location.href);
            const text = encodeURIComponent('Check out {{venue.name}} on Brum Out Loud!');
            window.open(\`https://www.facebook.com/sharer/sharer.php?u=\${url}&quote=\${text}\`, '_blank');
        }

        function shareOnTwitter() {
            const url = encodeURIComponent(window.location.href);
            const text = encodeURIComponent('Check out {{venue.name}} on Brum Out Loud!');
            window.open(\`https://twitter.com/intent/tweet?url=\${url}&text=\${text}\`, '_blank');
        }

        function copyLink() {
            navigator.clipboard.writeText(window.location.href).then(() => {
                alert('Link copied to clipboard!');
            });
        }
    </script>
</body>
</html>`;

// Simple template engine (same as in build-venues-simple.js)
function renderTemplate(template, data) {
    let result = template;

    // Replace simple variables (e.g., {{venue.name}})
    result = result.replace(/\{\{venue\.(\w+)\}\}/g, (match, key) => data.venue[key] || '');

    // Replace nested object properties (e.g., {{venue.image.url}})
    result = result.replace(/\{\{venue\.(\w+)\.(\w+)\}\}/g, (match, objKey, propKey) => data.venue[objKey] && data.venue[objKey][propKey] ? data.venue[objKey][propKey] : '');

    // Replace conditional blocks for venue properties with else (e.g., {{#if venue.description}}...{{else}}...{{/if}})
    result = result.replace(/\{\{#if venue\.([^}]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, ifContent, elseContent) => data.venue[key] ? ifContent : elseContent);

    // Replace conditional blocks for venue properties without else (e.g., {{#if venue.description}}...{{/if}})
    result = result.replace(/\{\{#if venue\.([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => data.venue[key] ? content : '');

    // Replace conditional blocks for venue object properties with else (e.g., {{#if venue.image.url}}...{{else}}...{{/if}})
    result = result.replace(/\{\{#if venue\.(\w+)\.(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, objKey, propKey, ifContent, elseContent) => data.venue[objKey] && data.venue[objKey][propKey] ? ifContent : elseContent);

    // Replace conditional blocks for venue object properties without else (e.g., {{#if venue.image.url}}...{{/if}})
    result = result.replace(/\{\{#if venue\.(\w+)\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, objKey, propKey, content) => data.venue[objKey] && data.venue[objKey][propKey] ? content : '');

    // Replace conditional blocks for googlePlaces properties (e.g., {{#if googlePlaces.rating}})
    result = result.replace(/\{\{#if googlePlaces\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => data.googlePlaces && data.googlePlaces[key] ? content : '');

    // Replace conditional blocks for googlePlaces array length (e.g., {{#if googlePlaces.images.length}})
    result = result.replace(/\{\{#if googlePlaces\.(\w+)\.length\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => data.googlePlaces && data.googlePlaces[key] && data.googlePlaces[key].length > 0 ? content : '');

    // Replace complex conditional blocks (e.g., {{else if (not googlePlaces.isOpen)}})
    result = result.replace(/\{\{else if \(not googlePlaces\.(\w+)\)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => data.googlePlaces && !data.googlePlaces[key] ? content : '');

    // Replace else if blocks for venue properties (e.g., {{else if venue.openingHours}})
    result = result.replace(/\{\{else if venue\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => data.venue[key] ? content : '');

    // Replace conditional blocks for complex conditions (e.g., {{#if hasUpcomingEvents}})
    result = result.replace(/\{\{#if hasUpcomingEvents\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, content) => data.hasUpcomingEvents ? content : '');

    // Replace each loops for googlePlaces arrays (e.g., {{#each googlePlaces.images}})
    result = result.replace(/\{\{#each googlePlaces\.(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, key, content) => {
        if (!data.googlePlaces || !data.googlePlaces[key]) return '';
        return data.googlePlaces[key].map(item => {
            let itemContent = content;
            itemContent = itemContent.replace(/\{\{(\w+)\}\}/g, (match, prop) => item[prop] || '');
            return itemContent;
        }).join('');
    });

    // Replace each loops for upcomingEvents (e.g., {{#each upcomingEvents}})
    result = result.replace(/\{\{#each upcomingEvents\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, content) => {
        if (!data.upcomingEvents || !data.upcomingEvents.length) return '';
        return data.upcomingEvents.map(event => {
            let eventContent = content;
            eventContent = eventContent.replace(/\{\{(\w+)\}\}/g, (match, prop) => event[prop] || '');
            return eventContent;
        }).join('');
    });

    // Replace times helper for star ratings (e.g., {{#times rating}})
    result = result.replace(/\{\{#times ([^}]+)\}\}([\s\S]*?)\{\{\/times\}\}/g, (match, count, content) => {
        const num = parseInt(count);
        if (isNaN(num)) return '';
        return content.repeat(num);
    });

    // Replace subtract helper (e.g., {{#times (subtract 5 rating)}})
    result = result.replace(/\{\{#times \(subtract ([^)]+)\)\}\}([\s\S]*?)\{\{\/times\}\}/g, (match, expression, content) => {
        const parts = expression.split(' ');
        if (parts.length === 3 && parts[1] === '-') {
            const a = parseFloat(parts[0]);
            const b = parseFloat(parts[2]);
            const result = a - b;
            if (isNaN(result)) return '';
            return content.repeat(Math.max(0, result));
        }
        return '';
    });

    // Replace remaining template variables (e.g., {{googlePlaces.rating}})
    result = result.replace(/\{\{googlePlaces\.(\w+)\}\}/g, (match, key) => data.googlePlaces && data.googlePlaces[key] ? data.googlePlaces[key] : '');
    result = result.replace(/\{\{googlePlaces\.(\w+)\.(\w+)\}\}/g, (match, objKey, propKey) => data.googlePlaces && data.googlePlaces[objKey] && data.googlePlaces[objKey][propKey] ? data.googlePlaces[objKey][propKey] : '');

    // Add date formatting functions (e.g., {{formatDay date}})
    result = result.replace(/\{\{formatDay\s+([^}]+)\}\}/g, (match, dateString) => {
        try {
            const date = new Date(dateString);
            return date.getDate().toString();
        } catch (error) {
            return '';
        }
    });
    result = result.replace(/\{\{formatMonth\s+([^}]+)\}\}/g, (match, dateString) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { month: 'short' });
        } catch (error) {
            return '';
        }
    });
    result = result.replace(/\{\{formatTime\s+([^}]+)\}\}/g, (match, dateString) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            return '';
        }
    });

    return result;
}

// Function to get Google Places data for a venue (sample data)
function getGooglePlacesData(venueData) {
    return {
        isOpen: true,
        rating: 4.2,
        reviewCount: 156,
        phone: '+44 121 622 4747',
        website: venueData.link || null,
        openingHours: [
            'Monday: 9:00 PM – 3:00 AM',
            'Tuesday: 9:00 PM – 3:00 AM',
            'Wednesday: 9:00 PM – 3:00 AM',
            'Thursday: 9:00 PM – 3:00 AM',
            'Friday: 9:00 PM – 3:00 AM',
            'Saturday: 9:00 PM – 3:00 AM',
            'Sunday: 9:00 PM – 3:00 AM'
        ],
        images: [
            { url: 'https://placehold.co/400x400/1e1e1e/EAEAEA?text=Venue+Photo+1' },
            { url: 'https://placehold.co/400x400/1e1e1e/EAEAEA?text=Venue+Photo+2' },
            { url: 'https://placehold.co/400x400/1e1e1e/EAEAEA?text=Venue+Photo+3' },
            { url: 'https://placehold.co/400x400/1e1e1e/EAEAEA?text=Venue+Photo+4' }
        ],
        reviews: [
            {
                author: 'Sarah M.',
                rating: 5,
                text: 'Amazing atmosphere and great music! The staff are friendly and the venue is always clean.'
            },
            {
                author: 'James L.',
                rating: 4,
                text: 'Really enjoyed the drag show last night. Great venue with a welcoming community feel.'
            },
            {
                author: 'Emma R.',
                rating: 5,
                text: 'Best LGBTQ+ venue in Birmingham! Always a fantastic night out with great entertainment.'
            }
        ]
    };
}

async function generateVenuePage(venue) {
    try {
        const googlePlaces = getGooglePlacesData(venue);
        const upcomingEvents = []; // No events for now

        const templateData = {
            venue: venue,
            googlePlaces: googlePlaces,
            upcomingEvents: upcomingEvents,
            hasUpcomingEvents: false
        };
        
        const html = renderTemplate(templateContent, templateData);
        
        // Ensure venue directory exists
        const venueDir = path.join(__dirname, 'venue');
        if (!fs.existsSync(venueDir)) {
            fs.mkdirSync(venueDir, { recursive: true });
        }
        
        const filePath = path.join(venueDir, `${venue.slug}.html`);
        fs.writeFileSync(filePath, html);
        
        console.log(`✅ Generated: ${filePath}`);
        return filePath;
    } catch (error) {
        console.error(`❌ Error generating page for ${venue.name}:`, error);
        return null;
    }
}

async function main() {
    console.log('🚀 Starting API-based Venue SSG Build...');
    
    try {
        // Fetch venues from the API
        const response = await fetch('http://localhost:8888/.netlify/functions/get-venues');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const venues = data.venues || [];
        
        console.log(`📄 Found ${venues.length} venues to generate`);
        
        // Generate pages for all venues
        const generatedFiles = [];
        for (const venue of venues) {
            console.log(`📝 Generating page for: ${venue.name}`);
            const filePath = await generateVenuePage(venue);
            if (filePath) {
                generatedFiles.push(filePath);
            }
        }
        
        console.log(`✅ Successfully generated ${generatedFiles.length} venue pages`);
        console.log('📁 Files are ready in the venue/ directory');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('💡 Make sure the local server is running on port 8888');
    }
}

// Run the script
main();