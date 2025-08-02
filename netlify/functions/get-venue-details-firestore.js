const admin = require('firebase-admin');
const Handlebars = require('handlebars');
const GooglePlacesService = require('./services/google-places-service');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const googlePlacesService = new GooglePlacesService();

exports.handler = async function(event, context) {
  try {
    const slug = event.queryStringParameters?.slug;
    
    if (!slug) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Venue slug is required' })
      };
    }

    console.log(`🏢 Getting venue details for slug: ${slug}`);

    // Get venue data from Firestore
    const venue = await getVenueBySlug(slug);
    
    if (!venue) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'text/html'
        },
        body: generate404Page(slug)
      };
    }

    // Get Google Places data for the venue
    const googlePlacesData = await googlePlacesService.getVenueGooglePlacesData(venue, {
      maxImages: 12,
      maxReviews: 6
    });

    // Get upcoming events for this venue
    const upcomingEvents = await getUpcomingEventsForVenue(venue.id);

    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Prepare template data
    const templateData = {
      venue: venue,
      googlePlaces: googlePlacesData,
      upcomingEvents: upcomingEvents,
      hasUpcomingEvents: upcomingEvents.length > 0,
      categoryTags: generateCategoryTags(venue.category || []),
      shareUrl: `https://brumoutloud.co.uk/venue/${slug}`,
      calendarLinks: generateCalendarLinks(upcomingEvents[0]) // For first upcoming event
    };

    // Use the embedded template
    const templateContent = getVenueTemplate();
    const template = Handlebars.compile(templateContent);
    const html = template(templateData);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Vary': 'Accept-Encoding'
      },
      body: html
    };

  } catch (error) {
    console.error('❌ Error in get-venue-details-firestore:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html'
      },
      body: generateErrorPage(error.message)
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
    
    return {
      id: doc.id,
      name: venueData.name || venueData['Venue Name'] || 'Unnamed Venue',
      description: venueData.description || venueData['Description'] || '',
      address: venueData.address || venueData['Address'] || '',
      website: venueData.website || venueData['Website'] || '',
      contactPhone: venueData.contactPhone || venueData['Contact Phone'] || '',
      slug: venueData.slug,
      category: venueData.category || venueData['Tags'] || [],
      image: extractImageUrl(venueData),
      accessibility: venueData.accessibility || venueData['Accessibility'] || '',
      features: venueData.features || venueData['Features'] || [],
      socialMedia: {
        instagram: venueData.instagram || venueData['Instagram'] || '',
        facebook: venueData.facebook || venueData['Facebook'] || '',
        twitter: venueData.twitter || venueData['Twitter'] || ''
      },
      googlePlaceId: venueData.googlePlaceId || venueData['Google Place ID'] || '',
      openingHours: venueData.openingHours || venueData['Opening Hours'] || '',
      status: venueData.status || 'approved'
    };
  } catch (error) {
    console.error('Error finding venue by slug:', error);
    return null;
  }
}

function extractImageUrl(venueData) {
  // Handle Cloudinary Public ID
  if (venueData.cloudinaryPublicId || venueData['Cloudinary Public ID']) {
    const publicId = venueData.cloudinaryPublicId || venueData['Cloudinary Public ID'];
    return {
      url: `https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${publicId}`,
      cloudinaryPublicId: publicId
    };
  }

  // Handle direct image URL
  if (venueData.image && venueData.image.url) {
    return venueData.image;
  }

  // Handle legacy image fields
  if (venueData.promoImage || venueData['Promo Image']) {
    const imageUrl = venueData.promoImage || venueData['Promo Image'];
    return { url: imageUrl };
  }

  // Return placeholder
  return {
    url: `https://placehold.co/1200x675/1e1e1e/EAEAEA?text=${encodeURIComponent(venueData.name || 'Venue Image')}`
  };
}

async function getUpcomingEventsForVenue(venueId, limit = 6) {
  try {
    const now = new Date();
    const eventsRef = db.collection('events');
    
    const snapshot = await eventsRef
      .where('venueId', '==', venueId)
      .where('date', '>=', now)
      .where('status', '==', 'approved')
      .orderBy('date', 'asc')
      .limit(limit)
      .get();

    const events = [];
    snapshot.forEach(doc => {
      const eventData = doc.data();
      events.push({
        id: doc.id,
        name: eventData.name || eventData['Event Name'],
        date: eventData.date.toDate(),
        slug: eventData.slug,
        image: extractImageUrl(eventData)
      });
    });

    return events;
  } catch (error) {
    console.error('Error fetching upcoming events for venue:', error);
    return [];
  }
}

function registerHandlebarsHelpers() {
  // Helper for displaying star ratings
  Handlebars.registerHelper('times', function(n, block) {
    let accum = '';
    for (let i = 0; i < n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });

  // Helper for subtracting numbers
  Handlebars.registerHelper('subtract', function(a, b) {
    return a - b;
  });

  // Date formatting helpers
  Handlebars.registerHelper('formatDay', function(date) {
    return new Date(date).getDate();
  });

  Handlebars.registerHelper('formatMonth', function(date) {
    return new Date(date).toLocaleDateString('en-GB', { month: 'short' });
  });

  Handlebars.registerHelper('formatTime', function(date) {
    return new Date(date).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  });

  Handlebars.registerHelper('formatDate', function(date) {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });
}

function generateCategoryTags(categories) {
  if (!categories || categories.length === 0) return '';
  
  return categories.map(category => 
    `<span class="inline-block bg-purple-500/20 text-purple-300 text-xs px-3 py-1 rounded-full mr-2 mb-2">${category}</span>`
  ).join('');
}

function generateCalendarLinks(event) {
  if (!event) return { google: '#', ical: '#' };
  
  const startDate = new Date(event.date);
  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // 3 hours later
  
  const googleDate = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const googleEndDate = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${googleDate}/${googleEndDate}`;
  
  return {
    google: googleUrl,
    ical: `/.netlify/functions/generate-ical?eventId=${event.id}`
  };
}

function generate404Page(slug) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Venue Not Found - Brum Outloud</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-white min-h-screen flex items-center justify-center">
    <div class="text-center">
        <h1 class="text-6xl font-bold mb-4">404</h1>
        <p class="text-xl mb-4">Venue "${slug}" not found</p>
        <a href="/all-venues.html" class="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700">
            Browse All Venues
        </a>
    </div>
</body>
</html>`;
}

function generateErrorPage(errorMessage) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - Brum Outloud</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-white min-h-screen flex items-center justify-center">
    <div class="text-center">
        <h1 class="text-6xl font-bold mb-4">Error</h1>
        <p class="text-xl mb-4">Something went wrong loading this venue</p>
        <p class="text-sm text-gray-400 mb-4">${errorMessage}</p>
        <a href="/all-venues.html" class="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700">
            Browse All Venues
        </a>
    </div>
</body>
</html>`;
}

function getVenueTemplate() {
  return `<!DOCTYPE html>
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

        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .gallery-item {
            aspect-ratio: 1;
            overflow: hidden;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: transform 0.3s ease;
        }
        
        .gallery-item:hover {
            transform: scale(1.05);
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="flex items-center text-2xl tracking-widest text-white"
               style="font-family: 'Omnes Pro', sans-serif;">
                <span>Brum Outloud</span>
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded" loading="lazy"
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

    <!-- Main Content -->
    <main class="mx-auto px-4 py-8 max-w-6xl">

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
                    <button onclick="shareVenue()" class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                        <i class="fas fa-share mr-1"></i>Share
                    </button>
                </div>
            </div>
            
            <div class="p-8">
                <!-- Venue Header -->
                <div class="mb-8">
                    <h1 class="text-4xl font-bold text-white mb-4">{{venue.name}}</h1>
                    {{#if venue.address}}
                    <p class="text-xl text-gray-300 mb-4">
                        <i class="fas fa-map-marker-alt mr-2 text-accent-color"></i>
                        {{venue.address}}
                    </p>
                    {{/if}}
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

                        <!-- Google Places Gallery -->
                        {{#if googlePlaces.images.length}}
                        <div class="venue-card p-6 mb-6">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-images mr-3 text-accent-color"></i>Gallery
                            </h2>
                            <div class="gallery-grid">
                                {{#each googlePlaces.images}}
                                <div class="gallery-item bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg overflow-hidden">
                                    <img src="{{url}}" alt="Venue photo" class="w-full h-full object-cover" onclick="openImageModal('{{url}}')">
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
                                        <div class="flex text-sm">
                                            {{#times rating}}
                                            <i class="fas fa-star text-yellow-400"></i>
                                            {{/times}}
                                            {{#times (subtract 5 rating)}}
                                            <i class="far fa-star text-yellow-400"></i>
                                            {{/times}}
                                        </div>
                                    </div>
                                    {{#if text}}
                                    <p class="text-gray-300 text-sm mb-2">{{text}}</p>
                                    {{/if}}
                                    {{#if relativeTime}}
                                    <p class="text-xs text-gray-500">{{relativeTime}}</p>
                                    {{/if}}
                                </div>
                                {{/each}}
                            </div>
                            <div class="mt-6 text-center">
                                <img src="https://developers.google.com/static/maps/images/google_on_white.png" alt="Powered by Google" class="h-8 mx-auto opacity-75">
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
                        {{#if venue.website}}
                        <div class="venue-card p-6">
                            <div class="space-y-3">
                                <a href="{{venue.website}}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold flex items-center justify-center">
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
                            {{#if googlePlaces.isOpen}}
                            <div class="p-3 rounded-lg border text-center bg-green-500/10 text-green-400 border-green-500/30 mb-4">
                                <p class="font-bold text-lg">Open Now</p>
                                <p class="text-sm">Currently open for business</p>
                            </div>
                            {{else}}
                            <div class="p-3 rounded-lg border text-center bg-red-500/10 text-red-400 border-red-500/30 mb-4">
                                <p class="font-bold text-lg">Closed</p>
                                <p class="text-sm">Currently closed</p>
                            </div>
                            {{/if}}
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
                            <div class="text-center">
                                <div class="flex items-center justify-center space-x-2 text-xl mb-2">
                                    <div class="flex">
                                        {{#times googlePlaces.rating}}
                                        <i class="fas fa-star text-yellow-400"></i>
                                        {{/times}}
                                        {{#times (subtract 5 googlePlaces.rating)}}
                                        <i class="far fa-star text-yellow-400"></i>
                                        {{/times}}
                                    </div>
                                </div>
                                <p class="text-white font-semibold text-lg">{{googlePlaces.rating}}/5</p>
                                <p class="text-gray-400 text-sm">({{googlePlaces.reviewCount}} reviews)</p>
                            </div>
                        </div>
                        {{/if}}

                        <!-- Contact Info -->
                        {{#if googlePlaces.phone}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-phone mr-2 text-accent-color"></i>Contact Info
                            </h3>
                            <div class="space-y-3">
                                <div class="text-center">
                                    <p class="text-gray-400 text-sm">Phone</p>
                                    <a href="tel:{{googlePlaces.phone}}" class="text-blue-400 hover:underline">
                                        {{googlePlaces.phone}}
                                    </a>
                                </div>
                                {{#if googlePlaces.website}}
                                <div class="text-center">
                                    <p class="text-gray-400 text-sm">Website</p>
                                    <a href="{{googlePlaces.website}}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">
                                        Visit Website
                                    </a>
                                </div>
                                {{/if}}
                            </div>
                        </div>
                        {{/if}}

                        <!-- Social Media -->
                        {{#if venue.socialMedia}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-share-alt mr-2 text-accent-color"></i>Follow Us
                            </h3>
                            <div class="flex justify-center space-x-4">
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
                </div>
            </div>
        </div>
    </main>

    <!-- Image Modal -->
    <div id="imageModal" class="fixed inset-0 bg-black bg-opacity-75 z-50 hidden flex items-center justify-center p-4">
        <div class="relative max-w-4xl max-h-full">
            <img id="modalImage" src="" alt="" class="max-w-full max-h-full object-contain">
            <button onclick="closeImageModal()" class="absolute top-4 right-4 text-white text-2xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center">
                <i class="fas fa-times"></i>
            </button>
        </div>
    </div>

    <!-- Footer -->
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
            document.getElementById('menu').classList.toggle('flex');
        });

        // Image modal functions
        function openImageModal(imageUrl) {
            document.getElementById('modalImage').src = imageUrl;
            document.getElementById('imageModal').classList.remove('hidden');
            document.getElementById('imageModal').classList.add('flex');
        }

        function closeImageModal() {
            document.getElementById('imageModal').classList.add('hidden');
            document.getElementById('imageModal').classList.remove('flex');
        }

        // Share function
        function shareVenue() {
            if (navigator.share) {
                navigator.share({
                    title: '{{venue.name}} - Brum Outloud',
                    text: '{{venue.description}}',
                    url: window.location.href
                });
            } else {
                // Fallback to copying URL
                navigator.clipboard.writeText(window.location.href);
                alert('Venue link copied to clipboard!');
            }
        }

        // Close modal when clicking outside
        document.getElementById('imageModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeImageModal();
            }
        });
    </script>
</body>
</html>`;
}