const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

// Initialize Firebase Admin with error handling
let firebaseInitialized = false;
if (!admin.apps.length) {
    try {
        // Check if all required environment variables are present
        const requiredVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL', 
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.warn(`⚠️  Missing Firebase environment variables: ${missingVars.join(', ')}`);
            console.warn('SSG will be skipped. Venue pages will not be generated.');
            console.warn('Please set the following environment variables in Netlify:');
            console.warn('- FIREBASE_PROJECT_ID');
            console.warn('- FIREBASE_CLIENT_EMAIL');
            console.warn('- FIREBASE_PRIVATE_KEY');
            console.warn('- CLOUDINARY_CLOUD_NAME (optional)');
            console.warn('');
            console.warn('The site will continue to work with dynamic venue pages.');
        } else {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
            firebaseInitialized = true;
            console.log('✅ Firebase initialized successfully');
        }
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error.message);
        console.warn('SSG will be skipped. Venue pages will not be generated.');
        console.warn('The site will continue to work with dynamic venue pages.');
    }
} else {
    firebaseInitialized = true;
}

let db;
if (firebaseInitialized) {
    try {
        db = admin.firestore();
    } catch(e) {
        console.warn('Could not initialize firestore', e.message);
        firebaseInitialized = false;
    }
}

// The exact template from get-venue-details.js
const templateContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{venue.name}} Reviews, Photos & Events | LGBTQ+ Birmingham Gay Bar | Brum Outloud</title>
    <meta name="description" content="Read reviews, view photos, and see upcoming events for {{venue.name}}, a popular LGBTQ+ venue and gay bar in Birmingham. {{venue.description}}">
    <meta name="keywords" content="{{venue.name}} birmingham, {{venue.name}} reviews, {{venue.name}} photos, gay bar birmingham, gay village birmingham venues">
    
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
    
    <!-- FOUC Prevention: Critical CSS and Loading Screen -->
    <style>
        /* FOUC Prevention - Hide content until styles are loaded */
        .fouc-prevention {
            visibility: hidden;
            opacity: 0;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .fouc-prevention.loaded {
            visibility: visible;
            opacity: 1;
        }
        
        /* Loading screen */
        .loading-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #121212 0%, #1a1a1a 50%, #2d1b69 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            transition: opacity 0.5s ease, visibility 0.5s ease;
        }
        
        .loading-screen.hidden {
            opacity: 0;
            visibility: hidden;
        }
        
        .loading-logo {
            width: 80px;
            height: 80px;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }
        
        .loading-text {
            color: #B564F7;
            font-family: 'Poppins', sans-serif;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(181, 100, 247, 0.3);
            border-top: 3px solid #B564F7;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Critical CSS to prevent flashing */
        body {
            background-color: #121212;
            color: #EAEAEA;
            font-family: 'Poppins', system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            margin: 0;
            padding: 0;
        }
        
        /* Basic layout styles to prevent layout shift */
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
        }
        
        /* Prevent pride flag from flashing at full size */
        img[src*="progressflag"] {
            height: 1.5rem !important;
            width: auto !important;
            max-width: 1.5rem !important;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        /* Show flag after page loads */
        .flag-loaded img[src*="progressflag"] {
            opacity: 1;
        }
    </style>
    
    <!-- Performance: Optimized external resource loading -->
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;900&display=swap" rel="stylesheet"></noscript>
    
    <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"></noscript>
    
    <link rel="preload" href="/css/main.css" as="style">
    <link rel="stylesheet" href="/css/main.css">
    
    <!-- FOUC Prevention Script -->
    <script src="/js/fouc-prevention.js"></script>
    
    <!-- Tailwind loaded with defer to avoid render blocking -->
    <script src="https://cdn.tailwindcss.com" defer></script>
    
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
<body class="fouc-prevention">
    <!-- Loading Screen -->
    <div class="loading-screen" id="loadingScreen">
        <img src="/progressflag.svg.png" alt="Brum Outloud" class="loading-logo">
        <div class="loading-text">Loading Brum Outloud...</div>
        <div class="loading-spinner"></div>
    </div>

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
                                <i class="fas fa-info-circle mr-3 text-accent-color"></i>About {{venue.name}}
                            </h2>
                            <p class="text-gray-300 leading-relaxed">{{venue.description}}</p>
                        </div>
                        {{/if}}

                        <!-- Gallery -->
                        {{#if googlePlaces.images.length}}
                        <div class="venue-card p-6 mb-6" id="photos">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-images mr-3 text-accent-color"></i>Photos of {{venue.name}}
                            </h2>
                            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {{#each googlePlaces.images}}
                                <div class="aspect-square bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg overflow-hidden">
                                    <img src="{{url}}" alt="Venue photo" class="w-full h-full object-cover">
                                </div>
                                {{/each}}
                            </div>
                            <p class="text-xs text-gray-500 mt-4 text-center">
                                Images sourced from Google Places
                            </p>
                        </div>
                        {{/if}}

                        <!-- Google Reviews -->
                        {{#if googlePlaces.reviews.length}}
                        <div class="venue-card p-6 mb-6" id="reviews">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fab fa-google mr-3 text-accent-color"></i>{{venue.name}} Reviews
                            </h2>
                            <p class="text-gray-300 mb-4">Looking for reviews of {{venue.name}}? Here is what people are saying about this Birmingham venue.</p>
                            <div class="space-y-4">
                                {{#each googlePlaces.reviews}}
                                <div class="p-4 bg-gray-800/50 rounded-lg">
                                    <div class="flex items-center justify-between mb-2">
                                        <p class="font-semibold text-white">{{author}}</p>
                                        <div class="text-xs">
                                            {{#times rating}}
                                            <i class="fas fa-star text-yellow-400"></i>
                                            {{/times}}
                                            {{#times (subtract 5 rating)}}
                                            <i class="far fa-star text-yellow-400"></i>
                                            {{/times}}
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

                        <!-- Current Status -->
                        {{#if googlePlaces.isOpen}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-clock mr-2 text-accent-color"></i>Current Status
                            </h3>
                            <div class="p-3 rounded-lg border text-center bg-green-500/10 text-green-400 border-green-500/30 mb-4">
                                <p class="font-bold text-lg">Open</p>
                                <p class="text-sm">Currently open for business</p>
                            </div>
                        </div>
                        {{else if (not googlePlaces.isOpen)}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-clock mr-2 text-accent-color"></i>Current Status
                            </h3>
                            <div class="p-3 rounded-lg border text-center bg-red-500/10 text-red-400 border-red-500/30 mb-4">
                                <p class="font-bold text-lg">Closed</p>
                                <p class="text-sm">Currently closed</p>
                            </div>
                        </div>
                        {{/if}}

                        <!-- Opening Hours -->
                        {{#if googlePlaces.openingHours.length}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-clock mr-2 text-accent-color"></i>Opening Hours
                            </h3>
                            <div class="space-y-2 text-gray-300 text-sm">
                                {{#each googlePlaces.openingHours}}
                                <p>{{this}}</p>
                                {{/each}}
                            </div>
                        </div>
                        {{else if venue.openingHours}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-clock mr-2 text-accent-color"></i>Opening Hours
                            </h3>
                            <div class="space-y-2 text-gray-300 text-sm">
                                <pre class="whitespace-pre-wrap">{{venue.openingHours}}</pre>
                            </div>
                        </div>
                        {{/if}}

                        <!-- Google Rating -->
                        {{#if googlePlaces.rating}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fab fa-google mr-2 text-accent-color"></i>Google Rating
                            </h3>
                            <div class="flex items-center space-x-2 text-xl mb-2">
                                <div>
                                    {{#times googlePlaces.rating}}
                                    <i class="fas fa-star text-yellow-400"></i>
                                    {{/times}}
                                    {{#times (subtract 5 googlePlaces.rating)}}
                                    <i class="far fa-star text-yellow-400"></i>
                                    {{/times}}
                                </div>
                                <p class="text-white font-semibold">{{googlePlaces.rating}} <span class="text-gray-400">({{googlePlaces.reviewCount}})</span></p>
                            </div>
                            <a href="#" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline text-sm">
                                View on Google Maps
                            </a>
                        </div>
                        {{/if}}

                        <!-- Contact Info -->
                        {{#if googlePlaces.phone}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-phone mr-2 text-accent-color"></i>Contact Info
                            </h3>
                            <div class="space-y-3">
                                <div>
                                    <p class="text-gray-400 text-sm">Phone</p>
                                    <a href="tel:{{googlePlaces.phone}}" class="text-blue-400 hover:underline">
                                        {{googlePlaces.phone}}
                                    </a>
                                </div>
                                {{#if googlePlaces.website}}
                                <div>
                                    <p class="text-gray-400 text-sm">Website</p>
                                    <a href="{{googlePlaces.website}}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">
                                        Visit Website
                                    </a>
                                </div>
                                {{/if}}
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

// Register Handlebars helpers
Handlebars.registerHelper('times', function(n, block) {
    let accum = '';
    for (let i = 0; i < n; ++i) {
        accum += block.fn(i);
    }
    return accum;
});

Handlebars.registerHelper('subtract', function(a, b) {
    return a - b;
});

Handlebars.registerHelper('formatDay', function(dateString) {
    const date = new Date(dateString);
    return date.getDate();
});

Handlebars.registerHelper('formatMonth', function(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short' });
});

Handlebars.registerHelper('formatTime', function(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
});

// Create the Handlebars template
const template = Handlebars.compile(templateContent);

// Function to get all venues from Firestore
async function getAllVenues() {
    try {
        if (!firebaseInitialized) {
            console.log('⚠️  Firebase not initialized. Cannot fetch venues.');
            return [];
        }
        
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.get();
        
        const venues = [];
        snapshot.forEach(doc => {
            const venueData = doc.data();
            const processedVenue = processVenueForPublic({
                id: doc.id,
                ...venueData
            });
            
            // Only include venues that have actual images (not placeholders)
            if (processedVenue.image && processedVenue.image.url && !processedVenue.image.url.includes('placehold.co')) {
                venues.push(processedVenue);
            }
        });
        
        return venues;
    } catch (error) {
        console.error('Error fetching venues:', error);
        throw error;
    }
}

// Function to process venue data (same as in get-venues.js)
function processVenueForPublic(venueData) {
    // Extract image URL from various possible formats
    let imageUrl = null;
    
    // 1. First try Cloudinary public ID
    const cloudinaryId = venueData['Cloudinary Public ID'] || venueData['cloudinaryPublicId'];
    if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_800,h_400,c_fill,g_auto/${cloudinaryId}`;
    } else {
        // 2. Try to find any image field that might contain a Cloudinary URL
        const possibleImageFields = ['image', 'Image', 'Photo', 'Photo URL', 'imageUrl'];
        for (const field of possibleImageFields) {
            const imageData = venueData[field];
            if (imageData) {
                // Check if it's already a Cloudinary URL
                if (typeof imageData === 'string' && imageData.includes('cloudinary.com')) {
                    imageUrl = imageData;
                    break;
                }
                // Check if it's an object with a Cloudinary URL
                if (imageData && typeof imageData === 'object' && imageData.url && imageData.url.includes('cloudinary.com')) {
                    imageUrl = imageData.url;
                    break;
                }
            }
        }
        
        // 3. If still no image, generate a consistent placeholder based on venue name
        if (!imageUrl) {
            const venueName = venueData.name || venueData['Venue Name'] || venueData['Name'] || 'Venue';
            const encodedName = encodeURIComponent(venueName);
            imageUrl = `https://placehold.co/800x400/1e1e1e/EAEAEA?text=${encodedName}`;
        }
    }
    
    const venue = {
        id: venueData.id,
        name: venueData.name || venueData['Venue Name'] || venueData['Name'],
        slug: venueData.slug || venueData['Venue Slug'] || venueData['Slug'],
        description: venueData.description || venueData['Description'] || `Venue hosting events`,
        address: venueData.address || venueData['Venue Address'] || venueData['Address'] || 'Address TBC',
        link: venueData.link || venueData['Venue Link'] || venueData['Link'],
        image: imageUrl ? { url: imageUrl } : null,
        category: venueData.category || venueData.tags || venueData['Tags'] || [],
        type: venueData.type || venueData['Type'] || 'venue',
        status: venueData.status || venueData['Status'] || venueData['Listing Status'] || 'Listed',
        openingHours: venueData.openingHours || venueData['Opening Hours'],
        popular: venueData.popular || venueData['Popular'] || false
    };
    
    if (!venue.category || venue.category.length === 0) {
        venue.category = ['LGBTQ+', 'Venue'];
    }
    
    return venue;
}

// Function to get upcoming events for a venue
async function getUpcomingEventsForVenue(venueId, limit = 6) {
    try {
        if (!firebaseInitialized) {
            console.log('⚠️  Firebase not initialized. Cannot fetch upcoming events.');
            return [];
        }
        
        const now = new Date();
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef
            .where('venueId', '==', venueId)
            .where('date', '>=', now)
            .orderBy('date', 'asc')
            .limit(limit)
            .get();
        
        const events = [];
        snapshot.forEach(doc => {
            const eventData = doc.data();
            events.push({
                id: doc.id,
                name: eventData.name || eventData['Event Name'],
                slug: eventData.slug || eventData['Event Slug'],
                date: eventData.date ? eventData.date.toDate().toISOString() : new Date().toISOString(),
                description: eventData.description || eventData['Description']
            });
        });
        
        return events;
    } catch (error) {
        console.error('Error fetching upcoming events:', error);
        return [];
    }
}

// Function to get Google Places data (simplified for SSG)
async function getGooglePlacesData(venueData) {
    // For SSG, we'll return empty data since Google Places API calls are expensive
    // and the data changes frequently. This maintains the template structure.
    return {
        isOpen: null,
        rating: null,
        reviewCount: 0,
        images: [],
        reviews: [],
        openingHours: [],
        phone: null,
        website: null
    };
}

// Function to generate category tags HTML
function generateCategoryTags(categories) {
    if (!categories || categories.length === 0) {
        return '<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full">LGBTQ+</span>';
    }
    
    return categories.map(category => 
        `<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full">${category}</span>`
    ).join('');
}

// Function to create fallback mechanism when SSG is not available
async function createFallbackMechanism() {
    try {
        console.log('Creating fallback mechanism for venue pages...');
        
        // Create venue directory if it doesn't exist
        const venueDir = path.join(__dirname, 'venue');
        await fs.mkdir(venueDir, { recursive: true });
        
        // Create a fallback HTML file that redirects to the dynamic function
        const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading Venue...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%);
            color: #EAEAEA;
        }
        .loader {
            border: 3px solid rgba(75, 85, 99, 0.3);
            border-top: 3px solid #E83A99;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <h1>Loading Venue...</h1>
    <div class="loader"></div>
    <p>Redirecting to dynamic venue page...</p>
    <script>
        // Extract the venue slug from the URL
        const pathParts = window.location.pathname.split('/');
        const slug = pathParts[pathParts.length - 1];
        
        // Redirect to the dynamic function
        if (slug) {
            window.location.href = '/.netlify/functions/get-venue-details?slug=' + slug;
        } else {
            window.location.href = '/all-venues.html';
        }
    </script>
</body>
</html>`;
        
        // Create a generic fallback file
        const fallbackPath = path.join(venueDir, 'fallback.html');
        await fs.writeFile(fallbackPath, fallbackHtml, 'utf8');
        
        console.log('✓ Created fallback mechanism');
        console.log('  - Fallback file: venue/fallback.html');
        console.log('  - Dynamic function: /.netlify/functions/get-venue-details');
        
    } catch (error) {
        console.error('Error creating fallback mechanism:', error);
    }
}

// Function to generate a single venue page
async function generateVenuePage(venue) {
    try {
        console.log(`Generating page for venue: ${venue.name}`);
        
        // Get upcoming events for this venue
        const upcomingEvents = await getUpcomingEventsForVenue(venue.id, 6);
        
        // Get Google Places data (empty for SSG)
        const googlePlaces = await getGooglePlacesData(venue);
        
        // Generate category tags
        const categoryTags = generateCategoryTags(venue.category);
        
        // Prepare template data
        const templateData = {
            venue: venue,
            upcomingEvents: upcomingEvents,
            hasUpcomingEvents: upcomingEvents.length > 0,
            googlePlaces: googlePlaces,
            categoryTags: categoryTags
        };
        
        // Generate HTML
        const html = template(templateData);
        
        // Create venue directory if it doesn't exist
        const venueDir = path.join(__dirname, 'venue');
        await fs.mkdir(venueDir, { recursive: true });
        
        // Write the HTML file
        const filePath = path.join(venueDir, `${venue.slug}.html`);
        await fs.writeFile(filePath, html, 'utf8');
        
        console.log(`✓ Generated: ${filePath}`);
        return filePath;
        
    } catch (error) {
        console.error(`Error generating page for venue ${venue.name}:`, error);
        throw error;
    }
}

// Main function to generate all venue pages
async function generateAllVenuePages() {
    try {
        console.log('🚀 Starting SSG for venues...');
        
        // Check if Firebase is initialized
        if (!firebaseInitialized) {
            console.log('⚠️  Firebase not initialized. Skipping venue SSG.');
            console.log('The site will continue to work with dynamic venue pages.');
            console.log('To enable SSG, set the required environment variables in Netlify.');
            
            return {
                totalVenues: 0,
                generatedFiles: 0,
                sitemapEntries: [],
                skipped: true,
                reason: 'Firebase not initialized - missing environment variables'
            };
        }
        
        // Get all venues
        const venues = await getAllVenues();
        console.log(`Found ${venues.length} venues to generate`);
        
        // Generate pages for each venue
        const generatedFiles = [];
        for (const venue of venues) {
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
            totalVenues: venues.length,
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
            if (result.skipped) {
                console.log('⚠️  SSG skipped due to missing configuration');
                console.log(`Reason: ${result.reason}`);
                console.log('The site will continue to work with dynamic venue pages.');
                process.exit(0); // Exit successfully even when skipped
            } else {
                console.log('🎉 SSG completed successfully!');
                console.log(`Generated ${result.generatedFiles} venue pages`);
                process.exit(0);
            }
        })
        .catch(error => {
            console.error('💥 SSG failed:', error);
            process.exit(1);
        });
}

module.exports = {
    generateAllVenuePages,
    generateVenuePage,
    getAllVenues
};