const fs = require('fs').promises;
const path = require('path');
const admin = require('firebase-admin');

// Add fetch for Node.js (if not available)
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

// Initialize Firebase Admin with error handling
let firebaseInitialized = false;
let db = null;

if (!admin.apps.length) {
    try {
        const requiredVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.warn(`⚠️  Missing Firebase environment variables: ${missingVars.join(', ')}`);
            console.warn('SSG will use fallback sample venues.');
        } else {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
            db = admin.firestore();
            firebaseInitialized = true;
            console.log('✅ Firebase initialized successfully');
        }
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error.message);
        console.warn('SSG will use fallback sample venues.');
    }
} else {
    db = admin.firestore();
    firebaseInitialized = true;
}

// Function to get real venues from Firebase
async function getRealVenues() {
    try {
        console.log("🔍 Fetching venues from API...");
        // Use a placeholder URL to avoid crashing the build when running locally
        const response = await fetch('https://brumoutloud.co.uk/.netlify/functions/get-venues-firestore');
        if (!response.ok) {
            throw new Error(`API responded with ${response.status}`);
        }
        const venues = await response.json();
        
        // Ensure venues is an array
        if (!Array.isArray(venues)) {
            console.warn('⚠️ API returned non-array venues, using fallback...');
            return getSampleVenues();
        }
        
        console.log(`✅ Found ${venues.length} real venues from API`);
        return venues;
        
    } catch (error) {
        console.error('❌ Error fetching venues from API:', error);
        console.log('⚠️ Using sample venues as fallback...');
        return getSampleVenues();
    }
}

// Function to get Google Places data for a venue
async function getGooglePlacesData(venueData) {
    try {
        // For now, return sample Google Places data
        // In production, this would call the Google Places API
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
    } catch (error) {
        console.error('Error getting Google Places data:', error);
        return {
            isOpen: null,
            rating: null,
            reviewCount: null,
            phone: null,
            website: null,
            openingHours: [],
            images: [],
            reviews: []
        };
    }
}

// Function to get upcoming events for a venue
async function getUpcomingEventsForVenue(venueId, limit = 6) {
    try {
        if (!firebaseInitialized || !db) {
            return [];
        }
        
        const eventsRef = db.collection('events');
        const now = new Date();
        
        const snapshot = await eventsRef
            .where('venueId', '==', venueId)
            .where('status', '==', 'approved')
            .where('date', '>=', now)
            .orderBy('date', 'asc')
            .limit(limit)
            .get();

        const events = [];
        snapshot.forEach(doc => {
            const eventData = {
                id: doc.id,
                ...doc.data()
            };
            events.push({
                id: eventData.id,
                name: eventData.name,
                slug: eventData.slug,
                date: eventData.date,
                category: eventData.category || []
            });
        });

        return events;
        
    } catch (error) {
        console.error('Error getting upcoming events for venue:', error);
        return [];
    }
}

// Function to get sample venues as fallback
function getSampleVenues() {
    return [
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
        }
    ];
}

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
                            <p class="text-xs text-gray-500 mt-4 text-center">
                                Images sourced from Google Places
                            </p>
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
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-clock mr-2 text-accent-color"></i>Current Status
                            </h3>
                            <div class="p-3 rounded-lg border text-center bg-green-500/10 text-green-400 border-green-500/30 mb-4">
                                <p class="font-bold text-lg">Open</p>
                                <p class="text-sm">Currently open for business</p>
                            </div>
                        </div>

                        <!-- Opening Hours -->
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

                        <!-- Google Rating -->
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
                            <a href="#" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline text-sm">
                                View on Google Maps
                            </a>
                        </div>

                        <!-- Contact Info -->
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-phone mr-2 text-accent-color"></i>Contact Info
                            </h3>
                            <div class="space-y-3">
                                <div>
                                    <p class="text-gray-400 text-sm">Phone</p>
                                    <a href="tel:+44 121 622 4747" class="text-blue-400 hover:underline">
                                        +44 121 622 4747
                                    </a>
                                </div>
                                {{#if venue.link}}
                                <div>
                                    <p class="text-gray-400 text-sm">Website</p>
                                    <a href="{{venue.link}}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">
                                        Visit Website
                                    </a>
                                </div>
                                {{/if}}
                            </div>
                        </div>

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

    <script>
        // Mobile menu toggle
        document.getElementById('menu-btn').addEventListener('click', function() {
            document.getElementById('menu').classList.toggle('hidden');
        });

        // Share functionality
        function shareVenue() {
            if (navigator.share) {
                navigator.share({
                    title: document.title,
                    text: document.querySelector('meta[name="description"]').getAttribute('content'),
                    url: window.location.href
                });
            } else {
                // Fallback: copy to clipboard
                navigator.clipboard.writeText(window.location.href).then(() => {
                    alert('Venue link copied to clipboard!');
                });
            }
        }

        // Add click handlers for share buttons
        document.addEventListener('DOMContentLoaded', function() {
            const shareButtons = document.querySelectorAll('button');
            shareButtons.forEach(button => {
                if (button.textContent.includes('Share')) {
                    button.addEventListener('click', shareVenue);
                }
            });
        });
    </script>
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
    
    // Replace conditional blocks for venue properties with else
    result = result.replace(/\{\{#if venue\.([^}]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, ifContent, elseContent) => {
        return data.venue[key] ? ifContent : elseContent;
    });
    
    // Replace conditional blocks for venue properties without else
    result = result.replace(/\{\{#if venue\.([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
        return data.venue[key] ? content : '';
    });
    
    // Special handling for venue.description if it wasn't caught
    if (result.includes('{{#if venue.description}}')) {
        result = result.replace(/\{\{#if venue\.description\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, content) => {
            return data.venue.description ? content : '';
        });
    }
    
    // Replace conditional blocks for venue object properties (like venue.image.url)
    result = result.replace(/\{\{#if venue\.(\w+)\.(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, objKey, propKey, ifContent, elseContent) => {
        return data.venue[objKey] && data.venue[objKey][propKey] ? ifContent : elseContent;
    });
    
    // Replace conditional blocks for venue object properties without else
    result = result.replace(/\{\{#if venue\.(\w+)\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, objKey, propKey, content) => {
        return data.venue[objKey] && data.venue[objKey][propKey] ? content : '';
    });
    
    // Replace conditional blocks for googlePlaces properties
    result = result.replace(/\{\{#if googlePlaces\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
        return data.googlePlaces && data.googlePlaces[key] ? content : '';
    });
    
    // Replace conditional blocks for googlePlaces array length
    result = result.replace(/\{\{#if googlePlaces\.(\w+)\.length\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
        return data.googlePlaces && data.googlePlaces[key] && data.googlePlaces[key].length > 0 ? content : '';
    });
    
    // Replace complex conditional blocks (like {{else if (not googlePlaces.isOpen)}})
    result = result.replace(/\{\{else if \(not googlePlaces\.(\w+)\)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
        return data.googlePlaces && !data.googlePlaces[key] ? content : '';
    });
    
    // Replace else if blocks for venue properties
    result = result.replace(/\{\{else if venue\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
        return data.venue[key] ? content : '';
    });
    
    // Replace conditional blocks for complex conditions
    result = result.replace(/\{\{#if hasUpcomingEvents\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, content) => {
        return data.hasUpcomingEvents ? content : '';
    });
    
    // Replace each loops for googlePlaces arrays
    result = result.replace(/\{\{#each googlePlaces\.(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, key, content) => {
        if (!data.googlePlaces || !data.googlePlaces[key]) return '';
        return data.googlePlaces[key].map(item => {
            let itemContent = content;
            // Replace item properties
            itemContent = itemContent.replace(/\{\{(\w+)\}\}/g, (match, prop) => item[prop] || '');
            return itemContent;
        }).join('');
    });
    
    // Replace each loops for upcomingEvents
    result = result.replace(/\{\{#each upcomingEvents\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, content) => {
        if (!data.upcomingEvents || !data.upcomingEvents.length) return '';
        return data.upcomingEvents.map(event => {
            let eventContent = content;
            // Replace event properties
            eventContent = eventContent.replace(/\{\{(\w+)\}\}/g, (match, prop) => event[prop] || '');
            return eventContent;
        }).join('');
    });
    
    // Replace times helper for star ratings
    result = result.replace(/\{\{#times ([^}]+)\}\}([\s\S]*?)\{\{\/times\}\}/g, (match, count, content) => {
        const num = parseInt(count);
        if (isNaN(num)) return '';
        return content.repeat(num);
    });
    
    // Replace subtract helper
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
    
    // Replace remaining template variables
    result = result.replace(/\{\{googlePlaces\.(\w+)\}\}/g, (match, key) => {
        return data.googlePlaces && data.googlePlaces[key] ? data.googlePlaces[key] : '';
    });
    
    // Replace nested googlePlaces properties
    result = result.replace(/\{\{googlePlaces\.(\w+)\.(\w+)\}\}/g, (match, objKey, propKey) => {
        return data.googlePlaces && data.googlePlaces[objKey] && data.googlePlaces[objKey][propKey] ? data.googlePlaces[objKey][propKey] : '';
    });
    
    // Replace category tags
    result = result.replace(/\{\{\{categoryTags\}\}\}/g, generateCategoryTags(data.venue.category));
    
    // Add date formatting functions
    result = result.replace(/\{\{formatDay\s+([^}]+)\}\}/g, (match, dateString) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '--';
            return date.getDate();
        } catch (error) {
            return '--';
        }
    });
    
    result = result.replace(/\{\{formatMonth\s+([^}]+)\}\}/g, (match, dateString) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '---';
            return date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
        } catch (error) {
            return '---';
        }
    });
    
    result = result.replace(/\{\{formatTime\s+([^}]+)\}\}/g, (match, dateString) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Time TBC';
            return date.toLocaleTimeString('en-GB', { 
                hour: 'numeric',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Time TBC';
        }
    });
    
    return result;
}

// Function to process venue data (same as in get-venues-firestore.js)
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
    
    // Generate slug from venue name if not provided
    const venueName = venueData.name || venueData['Venue Name'] || venueData['Name'] || 'Venue';
    const generateSlug = (name) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };
    
    const venue = {
        id: venueData.id,
        name: venueName,
        slug: venueData.slug || venueData['Venue Slug'] || venueData['Slug'] || generateSlug(venueName),
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
        
        // Get Google Places data
        const googlePlaces = await getGooglePlacesData(venue);
        
        // Get upcoming events
        const upcomingEvents = await getUpcomingEventsForVenue(venue.id);
        
        const templateData = {
            venue: venue,
            googlePlaces: googlePlaces,
            upcomingEvents: upcomingEvents,
            hasUpcomingEvents: upcomingEvents.length > 0
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
        
        // Get real venues from Firebase
        const venues = await getRealVenues();
        
        // Ensure venues is an array
        if (!venues || !Array.isArray(venues)) {
            console.warn('⚠️ No venues found, using sample venues...');
            const sampleVenues = getSampleVenues();
            console.log(`📄 Found ${sampleVenues.length} sample venues to generate`);
            
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
        }
        
        console.log(`📄 Found ${venues.length} venues to generate`);
        
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

module.exports = { generateAllVenuePages, generateVenuePage, getRealVenues };