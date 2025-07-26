const admin = require('firebase-admin');
const Handlebars = require('handlebars');

// Initialize Firebase Admin if not already initialized
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

exports.handler = async function (event, context) {
    console.log("get-venue-details function called");
    console.log("Event path:", event.path);
    console.log("Event queryStringParameters:", event.queryStringParameters);
    console.log("Full event object:", JSON.stringify(event, null, 2));
    
    // Extract slug from query parameters (as configured in netlify.toml)
    let slug = event.queryStringParameters?.slug;
    
    // Fallback: try to extract from path if not in query params
    if (!slug) {
        const pathParts = event.path.split("/");
        slug = pathParts[pathParts.length - 1];
    }
    
    // Additional fallback: try to extract from the full path
    if (!slug && event.path.includes('/venue/')) {
        slug = event.path.split('/venue/')[1];
    }
    
    console.log("Extracted slug:", slug);
    
    if (!slug) {
        console.log("No slug provided");
        return { 
            statusCode: 400, 
            body: 'Error: Venue slug not provided.' 
        };
    }

    try {
        console.log("Attempting to fetch venue with slug:", slug);
        
        // Get venue data from Firestore
        const venueData = await getVenueBySlug(slug);
        
        if (!venueData) {
            console.log("No venue found with slug:", slug);
            return { 
                statusCode: 404, 
                body: 'Venue not found.' 
            };
        }

        console.log("Venue found:", venueData.name);

        // Get upcoming events for this venue
        const upcomingEvents = await getUpcomingEventsForVenue(venueData.id, 6);

        // Embedded template to avoid file system issues in Netlify Functions
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
        :root {
            --accent-color: #ff6b6b;
            --accent-color-secondary: #4ecdc4;
        }
        
        .accent-color { color: var(--accent-color); }
        .accent-color-secondary { color: var(--accent-color-secondary); }
        .bg-accent-color { background-color: var(--accent-color); }
        .bg-accent-color-secondary { background-color: var(--accent-color-secondary); }
        
        .heading-gradient {
            background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
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
        
        .animate-fade-in {
            animation: fadeIn 0.5s ease-in-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .category-tag {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            display: inline-block;
            margin: 0.125rem;
        }
        
        .event-card {
            background: rgba(31, 41, 55, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(75, 85, 99, 0.3);
            transition: all 0.3s ease;
        }
        
        .event-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
        }
        
        .hero-image-container {
            position: relative;
            width: 100%;
            aspect-ratio: 16 / 9;
            background-color: #1e1e1e;
            overflow: hidden;
            border-radius: 1.25rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .hero-image-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            filter: blur(24px) brightness(0.5);
            transform: scale(1.1);
            transition: opacity 0.4s ease;
        }
        
        .hero-image-container:hover .hero-image-bg {
            opacity: 1;
        }
        
        .hero-image-fg {
            position: relative;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 10;
            transition: all 0.4s ease;
        }
        
        .hero-image-container:hover .hero-image-fg {
            object-fit: contain;
            transform: scale(0.9);
        }
    </style>
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <!-- Header -->
    <header class="border-b-2 border-gray-800">
        <div class="container mx-auto px-4 py-6">
            <div class="flex justify-between items-center">
                <a href="/" class="font-anton text-4xl heading-gradient">
                    BRUM<span class="accent-color">OUT</span>LOUD
                </a>
                <nav class="hidden md:flex space-x-8">
                    <a href="/events.html" class="text-gray-300 hover:text-white transition-colors">Events</a>
                    <a href="/all-venues.html" class="text-gray-300 hover:text-white transition-colors">Venues</a>
                    <a href="/community.html" class="text-gray-300 hover:text-white transition-colors">Community</a>
                </nav>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8">
        <!-- Back Button -->
        <div class="mb-6">
            <a href="/all-venues.html" class="inline-flex items-center text-gray-400 hover:text-white transition-colors">
                <i class="fas fa-arrow-left mr-2"></i>
                Back to Venues
            </a>
        </div>

        <!-- Hero Image -->
        {{#if venue.image}}
        <div class="hero-image-container mb-8">
            <img src="{{venue.image.url}}" alt="" class="hero-image-bg" aria-hidden="true">
            <img src="{{venue.image.url}}" alt="{{venue.name}}" class="hero-image-fg">
            <div class="absolute top-4 right-4">
                <button class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                    <i class="fas fa-share mr-1"></i>Share
                </button>
            </div>
        </div>
        {{/if}}

        <!-- Venue Header -->
        <div class="mb-8">
            <p class="font-semibold accent-color mb-2">VENUE DETAILS</p>
            <h1 class="font-anton text-6xl lg:text-8xl heading-gradient leading-none mb-8">{{venue.name}}</h1>
            <p class="text-xl text-gray-300 mb-4">
                <i class="fas fa-map-marker-alt mr-2 accent-color"></i>
                {{venue.address}}
            </p>
            <div class="flex flex-wrap gap-2 mb-6">
                {{#each venue.category}}
                <span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">{{this}}</span>
                {{/each}}
            </div>
        </div>

        <!-- Venue Content -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Main Content -->
            <div class="lg:col-span-2">
                <!-- About This Venue -->
                {{#if venue.description}}
                <div class="venue-card p-6 mb-6">
                    <h2 class="text-2xl font-bold text-white mb-4">
                        <i class="fas fa-info-circle mr-3 accent-color"></i>About This Venue
                    </h2>
                    <p class="text-gray-300 leading-relaxed">{{venue.description}}</p>
                </div>
                {{/if}}

                <!-- Gallery Placeholder -->
                <div class="venue-card p-6 mb-6">
                    <h2 class="text-2xl font-bold text-white mb-4">
                        <i class="fas fa-images mr-3 accent-color"></i>Gallery
                    </h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        <div class="aspect-square bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg flex items-center justify-center">
                            <i class="fas fa-image text-2xl text-gray-600"></i>
                        </div>
                        <div class="aspect-square bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg flex items-center justify-center">
                            <i class="fas fa-image text-2xl text-gray-600"></i>
                        </div>
                        <div class="aspect-square bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg flex items-center justify-center">
                            <i class="fas fa-image text-2xl text-gray-600"></i>
                        </div>
                        <div class="aspect-square bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg flex items-center justify-center">
                            <i class="fas fa-image text-2xl text-gray-600"></i>
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 mt-4 text-center">
                        Please note: these images are sourced from the venue's Google Places listing. We do not have control over which photos are displayed.
                    </p>
                </div>

                <!-- Google Reviews Placeholder -->
                <div class="venue-card p-6 mb-6">
                    <h2 class="text-2xl font-bold text-white mb-4">
                        <i class="fab fa-google mr-3 accent-color"></i>Recent Reviews from Google
                    </h2>
                    <div class="space-y-4">
                        <div class="p-4 bg-gray-800/50 rounded-lg">
                            <div class="flex items-center justify-between mb-2">
                                <p class="font-semibold text-white">Sarah Johnson</p>
                                <div class="text-xs">
                                    <i class="fas fa-star text-yellow-400"></i>
                                    <i class="fas fa-star text-yellow-400"></i>
                                    <i class="fas fa-star text-yellow-400"></i>
                                    <i class="fas fa-star text-yellow-400"></i>
                                    <i class="fas fa-star text-yellow-400"></i>
                                </div>
                            </div>
                            <p class="text-gray-300 text-sm">Amazing atmosphere and great drag shows! The staff are friendly and the drinks are reasonably priced. Highly recommend for a night out.</p>
                        </div>
                        <div class="p-4 bg-gray-800/50 rounded-lg">
                            <div class="flex items-center justify-between mb-2">
                                <p class="font-semibold text-white">Mike Thompson</p>
                                <div class="text-xs">
                                    <i class="fas fa-star text-yellow-400"></i>
                                    <i class="fas fa-star text-yellow-400"></i>
                                    <i class="fas fa-star text-yellow-400"></i>
                                    <i class="fas fa-star text-yellow-400"></i>
                                    <i class="far fa-star text-yellow-400"></i>
                                </div>
                            </div>
                            <p class="text-gray-300 text-sm">Great venue with multiple floors. The music is always on point and the crowd is welcoming. Perfect for the LGBTQ+ community.</p>
                        </div>
                    </div>
                    <div class="mt-8 text-center">
                        <img src="https://www.gstatic.com/marketing-cms/assets/images/c5/3a/200414104c669203c62270f7884f/google-wordmarks-2x.webp" alt="Powered by Google" style="max-width:120px; height: auto; margin: 0 auto;">
                    </div>
                </div>

                <!-- Regular Events -->
                {{#if hasUpcomingEvents}}
                <div class="venue-card p-6 mb-6">
                    <h2 class="text-2xl font-bold text-white mb-4">
                        <i class="fas fa-redo mr-3 accent-color"></i>Regular Events
                    </h2>
                    <div class="space-y-4">
                        {{#each upcomingEvents}}
                        <div class="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
                            <div class="w-16 h-16 bg-gradient-to-br from-green-600/20 to-blue-600/20 rounded flex items-center justify-center">
                                <i class="fas fa-calendar-alt text-green-400"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="font-semibold text-white">{{name}}</h4>
                                <p class="text-gray-400 text-sm">{{formatDate date}}</p>
                                <p class="text-gray-300 text-sm">{{description}}</p>
                            </div>
                            <a href="/event/{{slug}}" class="btn-primary text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-eye mr-1"></i>View
                            </a>
                        </div>
                        {{/each}}
                    </div>
                </div>
                {{/if}}

                <!-- Upcoming Special Events -->
                {{#if hasUpcomingEvents}}
                <div class="venue-card p-6">
                    <h2 class="text-2xl font-bold text-white mb-4">
                        <i class="fas fa-calendar mr-3 accent-color"></i>Upcoming Special Events
                    </h2>
                    <div class="space-y-4">
                        {{#each upcomingEvents}}
                        <div class="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
                            <div class="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded flex items-center justify-center">
                                <i class="fas fa-image text-gray-600"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="font-semibold text-white">{{name}}</h4>
                                <p class="text-gray-400 text-sm">{{formatDate date}}</p>
                                <p class="text-gray-300 text-sm">{{description}}</p>
                            </div>
                            <a href="/event/{{slug}}" class="btn-primary text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-eye mr-1"></i>View
                            </a>
                        </div>
                        {{/each}}
                    </div>
                </div>
                {{/if}}
            </div>

            <!-- Sidebar -->
            <div class="space-y-6">
                <!-- Current Status -->
                <div class="venue-card p-6">
                    <h3 class="text-xl font-bold text-white mb-4">
                        <i class="fas fa-clock mr-2 accent-color"></i>Current Status
                    </h3>
                    <!-- Open Status -->
                    <div class="p-3 rounded-lg border text-center bg-green-500/10 text-green-400 border-green-500/30 mb-4">
                        <p class="font-bold text-lg">Open</p>
                        <p class="text-sm">Open until 2:00 AM</p>
                    </div>
                </div>

                <!-- Opening Hours -->
                {{#if venue.openingHours}}
                <div class="venue-card p-6">
                    <h3 class="text-xl font-bold text-white mb-4">
                        <i class="fas fa-clock mr-2 accent-color"></i>Opening Hours
                    </h3>
                    <div class="space-y-2 text-gray-300 text-sm">
                        <pre class="whitespace-pre-wrap">{{venue.openingHours}}</pre>
                    </div>
                </div>
                {{/if}}

                <!-- Google Rating -->
                <div class="venue-card p-6">
                    <h3 class="text-xl font-bold text-white mb-4">
                        <i class="fab fa-google mr-2 accent-color"></i>Google Rating
                    </h3>
                    <div class="flex items-center space-x-2 text-xl mb-2">
                        <div>
                            <i class="fas fa-star text-yellow-400"></i>
                            <i class="fas fa-star text-yellow-400"></i>
                            <i class="fas fa-star text-yellow-400"></i>
                            <i class="fas fa-star text-yellow-400"></i>
                            <i class="fas fa-star text-yellow-400"></i>
                        </div>
                        <p class="text-white font-semibold">4.8 <span class="text-gray-400">(247)</span></p>
                    </div>
                    <a href="#" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline text-sm">
                        View on Google Maps
                    </a>
                </div>

                <!-- Contact Info -->
                <div class="venue-card p-6">
                    <h3 class="text-xl font-bold text-white mb-4">
                        <i class="fas fa-info-circle mr-2 accent-color"></i>Contact Info
                    </h3>
                    <div class="space-y-3">
                        <div>
                            <p class="text-gray-400 text-sm">Address</p>
                            <p class="text-white">{{venue.address}}</p>
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
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="border-t-2 border-gray-800 p-8 mt-16">
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
        // Helper function to format dates
        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        }
        
        // Format all dates on the page
        document.addEventListener('DOMContentLoaded', function() {
            const dateElements = document.querySelectorAll('[data-date]');
            dateElements.forEach(element => {
                const dateString = element.getAttribute('data-date');
                element.textContent = formatDate(dateString);
            });
        });
    </script>
</body>
</html>`;

        // Compile the template
        const template = Handlebars.compile(templateContent);

        // Prepare template data
        const templateData = {
            venue: venueData,
            upcomingEvents: upcomingEvents,
            hasUpcomingEvents: upcomingEvents.length > 0,
            categoryTags: (venueData.category || []).map(tag => 
                '<span class="category-tag">' + tag + '</span>'
            ).join(''),
            formatDate: (dateString) => {
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return 'Date TBC';
                    }
                    return date.toLocaleDateString('en-GB', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                } catch (error) {
                    return 'Date TBC';
                }
            }
        };

        // Render the page
        const html = template(templateData);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
            body: html
        };

    } catch (error) {
        console.error('Error in get-venue-details:', error);
        
        return {
            statusCode: 500,
            body: 'Internal server error. Please try again later.'
        };
    }
};

async function getVenueBySlug(slug) {
    try {
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef
            .where('slug', '==', slug)
            .limit(1)
            .get();

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        const venueData = doc.data();
        
        // Process venue data for display
        return processVenueForDetails({
            id: doc.id,
            ...venueData
        });
        
    } catch (error) {
        console.error('Error finding venue by slug:', error);
        return null;
    }
}

function processVenueForDetails(venueData) {
    // Extract image URL from various possible formats
    let imageUrl = null;
    
    // 1. First try Cloudinary public ID
    const cloudinaryId = venueData['Cloudinary Public ID'] || venueData['cloudinaryPublicId'];
    if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
        imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_fill,g_auto/${cloudinaryId}`;
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
            imageUrl = `https://placehold.co/1200x675/1e1e1e/EAEAEA?text=${encodedName}`;
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

async function getUpcomingEventsForVenue(venueId, limit = 6) {
    try {
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
                date: eventData.date,
                category: eventData.category || eventData.tags || [],
                description: eventData.description || eventData['Description']
            });
        });

        return events;
        
    } catch (error) {
        console.error('Error fetching upcoming events for venue:', error);
        return [];
    }
}