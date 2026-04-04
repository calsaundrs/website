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
    console.log('🔍 Query string parameters:', event.queryStringParameters);
    console.log('🔍 Path parameters:', event.pathParameters);
    console.log('🔍 Raw query string:', event.rawQuery);
    
    // Try multiple ways to get the slug
    let slug = event.queryStringParameters?.slug;
    
    // If not in query params, try path parameters (for :splat)
    if (!slug && event.pathParameters) {
      slug = event.pathParameters.splat || event.pathParameters.slug;
    }
    
    // If still no slug, try to extract from the path
    if (!slug && event.path) {
      const pathParts = event.path.split('/');
      slug = pathParts[pathParts.length - 1];
    }
    
    console.log('🔍 Extracted slug:', slug);
    
    if (!slug) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Venue slug is required',
          debug: {
            queryStringParameters: event.queryStringParameters,
            pathParameters: event.pathParameters,
            path: event.path,
            rawQuery: event.rawQuery
          }
        })
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
    console.log(`🔍 Venue Google Place ID: ${venue.googlePlaceId}`);
    console.log(`🔍 Venue data for Google Places:`, {
      name: venue.name,
      address: venue.address,
      googlePlaceId: venue.googlePlaceId
    });
    
    const googlePlacesData = await googlePlacesService.getVenueGooglePlacesData(venue, {
      maxImages: 6,
      maxReviews: 3
    });
    
    console.log(`🔍 Google Places data result:`, {
      hasImages: googlePlacesData.images && googlePlacesData.images.length > 0,
      imageCount: googlePlacesData.images ? googlePlacesData.images.length : 0,
      hasReviews: googlePlacesData.reviews && googlePlacesData.reviews.length > 0,
      reviewCount: googlePlacesData.reviews ? googlePlacesData.reviews.length : 0,
      hasRating: !!googlePlacesData.rating,
      rating: googlePlacesData.rating
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
    console.error('❌ Error in get-venue-details:', error);
    
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
    console.log(`🔍 Looking for venue with slug: ${slug}`);
    const venuesRef = db.collection('venues');
    
    // Get all venues and find the one with matching slug
    const allVenues = await venuesRef.get();
    let foundVenue = null;
    
    allVenues.forEach(doc => {
      const data = doc.data();
      
      // Use the same processing logic as the venue listing function
      const processedVenue = processVenueForPublic({
        id: doc.id,
        ...data
      });
      
      console.log(`🔍 Checking venue: "${processedVenue.name}" - slug: "${processedVenue.slug}" - looking for: "${slug}"`);
      
      if (processedVenue.slug === slug) {
        foundVenue = processedVenue;
        console.log(`✅ Found venue: ${processedVenue.name}`);
      }
    });
    
    if (!foundVenue) {
      console.log(`❌ No venue found with slug: ${slug}`);
      return null;
    }
    
    console.log(`✅ Found venue: ${foundVenue.name}`);
    
    // Get the raw venue data to access Google Place ID
    const rawVenueData = foundVenue;
    const googlePlaceId = rawVenueData.googlePlaceId || rawVenueData['Google Place ID'] || rawVenueData['googlePlaceId'];
    
    console.log(`🔍 Google Place ID from raw data:`, googlePlaceId);
    
    return {
      id: foundVenue.id,
      name: foundVenue.name,
      description: foundVenue.description,
      address: foundVenue.address,
      website: foundVenue.website || '',
      contactEmail: foundVenue.contactEmail || '',
      contactPhone: foundVenue.contactPhone || '',
      slug: foundVenue.slug,
      category: foundVenue.category,
      image: foundVenue.image,
      accessibility: foundVenue.accessibility || '',
      accessibilityRating: foundVenue.accessibilityRating || '',
      accessibilityFeatures: foundVenue.accessibilityFeatures || [],
      parkingException: foundVenue.parkingException || '',
      vibeTags: foundVenue.vibeTags || [],
      venueFeatures: foundVenue.venueFeatures || [],
      features: foundVenue.features || [],
      socialMedia: {
        instagram: foundVenue.instagram || '',
        facebook: foundVenue.facebook || '',
        tiktok: foundVenue.tiktok || '',
        twitter: foundVenue.twitter || ''
      },
      googlePlaceId: foundVenue.googlePlaceId || googlePlaceId,
      openingHours: foundVenue.openingHours,
      status: foundVenue.status,
      photoUrl: foundVenue.photoUrl || '',
      cloudinaryPublicId: foundVenue.cloudinaryPublicId || ''
    };
  } catch (error) {
    console.error('Error finding venue by slug:', error);
    return null;
  }
}

function processVenueForPublic(venueData) {
    // Extract image URL from various possible formats
    let imageUrl = null;
    
    // 1. First try photoUrl (new venue format) - same as venue listing function
    const photoUrl = venueData.photoUrl || venueData['Photo URL'];
    if (photoUrl) {
        imageUrl = photoUrl;
    } else {
        // 2. Try Cloudinary public ID (legacy format)
        const cloudinaryId = venueData['Cloudinary Public ID'] || venueData['cloudinaryPublicId'];
        if (cloudinaryId && process.env.CLOUDINARY_CLOUD_NAME) {
            imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${cloudinaryId}`;
        } else {
            // 3. Try to find any image field that might contain a Cloudinary URL
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
            
            // 4. If still no image, generate a consistent placeholder based on venue name
            if (!imageUrl) {
                const venueName = venueData.name || venueData['Venue Name'] || venueData['Name'] || 'Venue';
                const encodedName = encodeURIComponent(venueName);
                imageUrl = `https://placehold.co/1200x675/1e1e1e/EAEAEA?text=${encodedName}`;
            }
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
        status: venueData.status || 'listed',
        openingHours: venueData.openingHours || venueData['Opening Hours'],
        popular: venueData.popular || venueData['Popular'] || false,
        googlePlaceId: venueData.googlePlaceId || venueData['Google Place ID'] || venueData['googlePlaceId'] || '',
        
        // Contact information
        website: venueData.website || '',
        contactEmail: venueData.contactEmail || venueData['contact-email'] || '',
        contactPhone: venueData.contactPhone || venueData['contact-phone'] || '',
        
        // Social media
        instagram: venueData.instagram || '',
        facebook: venueData.facebook || '',
        tiktok: venueData.tiktok || '',
        
        // Accessibility and features
        accessibility: venueData.accessibility || '',
        accessibilityRating: venueData.accessibilityRating || venueData['accessibility-rating'] || '',
        accessibilityFeatures: venueData.accessibilityFeatures || venueData['accessibility-features'] || [],
        parkingException: venueData.parkingException || venueData['parking-exception'] || '',
        
        // Tags and features
        vibeTags: venueData.vibeTags || venueData['vibe-tags'] || [],
        venueFeatures: venueData.venueFeatures || venueData['venue-features'] || [],
        
        // Image data
        photoUrl: venueData.photoUrl || '',
        cloudinaryPublicId: venueData.cloudinaryPublicId || ''
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
    `<span class="category-tag">${category}</span>`
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
    <title>{{venue.name}} — LGBTQ+ Venue in Birmingham | Brum Outloud</title>
    <meta name="description" content="{{venue.description}}">
    <link rel="canonical" href="https://www.brumoutloud.co.uk/venue/{{venue.slug}}">

    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="{{venue.name}} — LGBTQ+ Venue in Birmingham | Brum Outloud">
    <meta property="og:description" content="{{venue.description}}">
    <meta property="og:type" content="business.business">
    <meta property="og:url" content="https://www.brumoutloud.co.uk/venue/{{venue.slug}}">
    {{#if venue.image}}
    <meta property="og:image" content="{{venue.image.url}}">
    {{/if}}
    <meta property="og:site_name" content="Brum Outloud">
    <meta property="og:locale" content="en_GB">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{venue.name}} — LGBTQ+ Venue in Birmingham | Brum Outloud">
    <meta name="twitter:description" content="{{venue.description}}">
    {{#if venue.image}}
    <meta name="twitter:image" content="{{venue.image.url}}">
    {{/if}}

    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">

    <!-- Styles -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">

    <style>
        :root {
            --color-bg: #0D0115;
            --color-light: #f3e8ff;
            --color-toxic: #CCFF00;
            --color-purple: #9B5DE5;
            --color-pink: #E83A99;
        }
        body {
            background: var(--color-bg);
            color: var(--color-light);
            font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
            min-height: 100vh;
            margin: 0;
            padding: 0;
        }
        .font-display { font-family: 'Syne', sans-serif; }
        .misprint { letter-spacing: -0.03em; line-height: 0.95; }

        .progress-pride-bg {
            background: linear-gradient(90deg, #000000 0%, #784F17 8%, #55CDFC 16%, #F7A8B8 24%, #FFFFFF 32%, #FFF430 40%, #FF8C00 48%, #E40303 56%, #FF8C00 64%, #FFF430 72%, #008026 80%, #004DFF 88%, #750787 100%);
        }

        .neo-card {
            background-color: #000000;
            border: 4px solid var(--color-light);
            box-shadow: 6px 6px 0 var(--color-purple);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .neo-card:hover {
            transform: translate(-2px, -2px);
            box-shadow: 10px 10px 0 var(--color-pink);
        }

        .btn-neo {
            background: var(--color-toxic);
            color: #000;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border: 3px solid var(--color-light);
            box-shadow: 4px 4px 0 var(--color-purple);
            transition: all 0.2s ease;
            padding: 0.75rem 1.5rem;
            cursor: pointer;
        }
        .btn-neo:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0 var(--color-pink);
        }

        .btn-outline {
            background: transparent;
            color: var(--color-light);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border: 3px solid var(--color-light);
            padding: 0.75rem 1.5rem;
            transition: all 0.2s ease;
            cursor: pointer;
        }
        .btn-outline:hover {
            background: var(--color-purple);
            border-color: var(--color-purple);
        }

        .sticker {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border: 2px solid currentColor;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            transform: rotate(-2deg);
        }

        .category-tag {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border: 2px solid var(--color-toxic);
            color: var(--color-toxic);
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .gallery-item {
            aspect-ratio: 1;
            overflow: hidden;
            cursor: pointer;
            border: 3px solid var(--color-light);
            transition: all 0.2s ease;
        }
        .gallery-item:hover {
            border-color: var(--color-toxic);
            transform: translate(-2px, -2px);
            box-shadow: 4px 4px 0 var(--color-pink);
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="sticky top-0 z-[100] transition-all duration-300">
        <nav class="bg-black pt-4 px-4 pb-5 flex justify-between items-center relative z-10 shadow-[4px_4px_0_var(--color-toxic)]">
            <div class="absolute bottom-0 left-0 w-full h-[6px] progress-pride-bg"></div>
            <div class="font-display font-black text-2xl md:text-3xl misprint leading-none flex items-center">
                <a href="/" class="hover:opacity-80 transition-opacity">BRUM<br><span class="text-[var(--color-purple)]">OUT</span>LOUD</a>
            </div>
            <div class="hidden lg:flex items-center space-x-8 font-bold text-sm uppercase tracking-widest">
                <a href="/events" class="hover:text-[var(--color-toxic)] transition-colors">WHAT'S ON</a>
                <a href="/all-venues" class="hover:text-[var(--color-toxic)] transition-colors">VENUES</a>
                <a href="/clubs" class="hover:text-[var(--color-toxic)] transition-colors">CLUBS</a>
                <a href="/birmingham-pride" class="hover:text-[var(--color-toxic)] transition-colors">PRIDE</a>
                <a href="/community" class="hover:text-[var(--color-toxic)] transition-colors">COMMUNITY</a>
                <a href="/contact" class="hover:text-[var(--color-toxic)] transition-colors">CONTACT</a>
                <a href="/get-listed" class="sticker bg-[var(--color-toxic)] !text-black text-sm hover:bg-white transition-colors">GET LISTED</a>
            </div>
            <div class="lg:hidden relative z-[60]">
                <button id="menu-btn" class="text-white text-2xl">
                    <i class="fas fa-bars"></i>
                </button>
            </div>
        </nav>
        <div id="menu" class="hidden lg:hidden fixed inset-0 bg-black z-50 flex flex-col items-center justify-center space-y-6">
            <a href="/events" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">WHAT'S ON</a>
            <a href="/all-venues" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">VENUES</a>
            <a href="/clubs" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">CLUBS</a>
            <a href="/birmingham-pride" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">PRIDE</a>
            <a href="/community" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">COMMUNITY</a>
            <a href="/contact" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">CONTACT</a>
            <a href="/get-listed" class="block mt-4 sticker bg-[var(--color-toxic)] !text-black text-2xl">GET LISTED</a>
        </div>
    </header>

    <!-- Hero Section - Full Bleed -->
    <section class="relative w-full" style="min-height: 50vh;">
        <div class="absolute inset-0">
            {{#if venue.image}}
            <img src="{{venue.image.url}}" alt="{{venue.name}} — LGBTQ+ venue in Birmingham" class="w-full h-full object-cover" style="filter: contrast(1.1) brightness(0.9);">
            {{else}}
            <div class="w-full h-full bg-gradient-to-br from-[var(--color-purple)]/30 to-[var(--color-pink)]/30"></div>
            {{/if}}
            <div class="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/70 to-[var(--color-bg)]/20"></div>
        </div>

        <div class="relative z-10 flex flex-col justify-end h-full px-6 md:px-12 pb-12 pt-32" style="min-height: 50vh;">
            <div class="max-w-7xl mx-auto w-full">
                <!-- Breadcrumb -->
                <nav class="mb-6 text-sm font-bold uppercase tracking-widest">
                    <a href="/all-venues" class="text-gray-400 hover:text-[var(--color-toxic)] transition-colors">Venues</a>
                    <span class="text-gray-600 mx-2">/</span>
                    <span class="text-white">{{venue.name}}</span>
                </nav>

                <h1 class="text-4xl md:text-5xl lg:text-6xl font-black text-white uppercase font-display misprint mb-4">{{venue.name}}</h1>

                {{#if venue.address}}
                <p class="text-xl text-[var(--color-toxic)] font-bold mb-4">
                    <i class="fas fa-map-marker-alt mr-2"></i>{{venue.address}}
                </p>
                {{/if}}

                <!-- Category Tags -->
                <div class="flex flex-wrap gap-2">
                    {{{categoryTags}}}
                </div>

                {{#if googlePlaces.rating}}
                <div class="flex items-center gap-2 mt-4">
                    <div class="flex text-yellow-400">
                        {{#times googlePlaces.rating}}
                        <i class="fas fa-star"></i>
                        {{/times}}
                        {{#times (subtract 5 googlePlaces.rating)}}
                        <i class="far fa-star"></i>
                        {{/times}}
                    </div>
                    <span class="text-white font-bold">{{googlePlaces.rating}}/5</span>
                    <span class="text-gray-400 text-sm">({{googlePlaces.reviewCount}} Google reviews)</span>
                </div>
                {{/if}}
            </div>
        </div>
    </section>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14">

            <!-- Primary Content -->
            <div class="lg:col-span-2 space-y-10">
                {{#if venue.description}}
                <section>
                    <h2 class="text-2xl font-bold text-white mb-5 uppercase font-display">
                        <span class="text-[var(--color-toxic)] mr-2">///</span> About This Venue
                    </h2>
                    <div class="text-gray-300 leading-relaxed text-lg" style="line-height: 1.8;">
                        <p>{{venue.description}}</p>
                    </div>
                </section>
                {{/if}}

                {{#if venue.accessibility}}
                <section>
                    <h2 class="text-2xl font-bold text-white mb-5 uppercase font-display">
                        <span class="text-[var(--color-toxic)] mr-2">///</span> Accessibility
                    </h2>
                    <p class="text-gray-300 leading-relaxed text-lg mb-4">{{venue.accessibility}}</p>
                    {{#if venue.accessibilityFeatures.length}}
                    <div class="flex flex-wrap gap-2">
                        {{#each venue.accessibilityFeatures}}
                        <span class="category-tag">{{this}}</span>
                        {{/each}}
                    </div>
                    {{/if}}
                    {{#if venue.parkingException}}
                    <p class="text-gray-400 text-sm mt-4"><i class="fas fa-parking mr-2 text-[var(--color-toxic)]"></i>{{venue.parkingException}}</p>
                    {{/if}}
                </section>
                {{/if}}

                <!-- Google Places Gallery -->
                {{#if googlePlaces.images.length}}
                <section>
                    <h2 class="text-2xl font-bold text-white mb-5 uppercase font-display">
                        <span class="text-[var(--color-toxic)] mr-2">///</span> Gallery
                    </h2>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {{#each googlePlaces.images}}
                        <div class="gallery-item" onclick="openImageModal('{{url}}')">
                            <img src="{{url}}" alt="Photo of {{../venue.name}} in Birmingham" class="w-full h-full object-cover">
                        </div>
                        {{/each}}
                    </div>
                    <p class="text-xs text-gray-500 mt-4">Images sourced from Google Places</p>
                </section>
                {{/if}}

                <!-- Google Reviews -->
                {{#if googlePlaces.reviews.length}}
                <section>
                    <h2 class="text-2xl font-bold text-white mb-5 uppercase font-display">
                        <span class="text-[var(--color-toxic)] mr-2">///</span> Reviews
                    </h2>
                    <div class="space-y-4">
                        {{#each googlePlaces.reviews}}
                        <div class="border-2 border-[#f3e8ff]/20 p-5">
                            <div class="flex items-center justify-between mb-3">
                                <p class="font-bold text-white uppercase text-sm">{{author}}</p>
                                <div class="flex text-sm text-yellow-400">
                                    {{#times rating}}
                                    <i class="fas fa-star"></i>
                                    {{/times}}
                                    {{#times (subtract 5 rating)}}
                                    <i class="far fa-star"></i>
                                    {{/times}}
                                </div>
                            </div>
                            {{#if text}}
                            <p class="text-gray-300 text-sm leading-relaxed">{{text}}</p>
                            {{/if}}
                            {{#if relativeTime}}
                            <p class="text-xs text-gray-500 mt-2">{{relativeTime}}</p>
                            {{/if}}
                        </div>
                        {{/each}}
                    </div>
                </section>
                {{/if}}

                <!-- Upcoming Events -->
                {{#if hasUpcomingEvents}}
                <section>
                    <h2 class="text-2xl font-bold text-white mb-5 uppercase font-display">
                        <span class="text-[var(--color-toxic)] mr-2">///</span> Upcoming Events
                    </h2>
                    <div class="space-y-3">
                        {{#each upcomingEvents}}
                        <a href="/event/{{slug}}" class="block border-2 border-[#f3e8ff]/20 p-4 flex items-center space-x-4 hover:border-[var(--color-toxic)] hover:bg-white/5 transition-all duration-200">
                            <div class="text-center w-16 flex-shrink-0">
                                <p class="text-2xl font-bold text-[var(--color-toxic)]">{{formatDay date}}</p>
                                <p class="text-sm text-gray-400 uppercase font-bold">{{formatMonth date}}</p>
                            </div>
                            <div class="flex-grow">
                                <h4 class="font-bold text-white text-lg">{{name}}</h4>
                                <p class="text-sm text-gray-400">{{formatTime date}}</p>
                            </div>
                            <div class="text-[var(--color-toxic)]">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        </a>
                        {{/each}}
                    </div>
                </section>
                {{/if}}

                <!-- Dynamic Events Section -->
                <section id="events-container"></section>
            </div>

            <!-- Sidebar -->
            <aside class="space-y-6">
                <!-- Visit Website CTA -->
                {{#if venue.website}}
                <div class="neo-card p-6">
                    <a href="{{venue.website}}" target="_blank" rel="noopener noreferrer" class="btn-neo w-full flex items-center justify-center text-lg">
                        <i class="fas fa-external-link-alt mr-2"></i>VISIT WEBSITE
                    </a>
                </div>
                {{/if}}

                <!-- Opening Hours -->
                {{#if venue.openingHours}}
                <div class="neo-card p-6">
                    <h3 class="text-lg font-bold text-white mb-4 uppercase font-display">
                        <i class="fas fa-clock mr-2 text-[var(--color-toxic)]"></i>Hours
                    </h3>
                    {{#if googlePlaces.isOpen}}
                    <div class="border-2 border-green-400 text-green-400 text-center font-bold uppercase text-sm p-2 mb-4">
                        <i class="fas fa-circle text-xs mr-1"></i> Open Now
                    </div>
                    {{/if}}
                    <div class="space-y-1 text-gray-300 text-sm">
                        <pre class="whitespace-pre-wrap font-sans">{{venue.openingHours}}</pre>
                    </div>
                </div>
                {{else if googlePlaces.openingHours.length}}
                <div class="neo-card p-6">
                    <h3 class="text-lg font-bold text-white mb-4 uppercase font-display">
                        <i class="fas fa-clock mr-2 text-[var(--color-toxic)]"></i>Hours
                    </h3>
                    {{#if googlePlaces.isOpen}}
                    <div class="border-2 border-green-400 text-green-400 text-center font-bold uppercase text-sm p-2 mb-4">
                        <i class="fas fa-circle text-xs mr-1"></i> Open Now
                    </div>
                    {{/if}}
                    <div class="space-y-1 text-gray-300 text-sm">
                        {{#each googlePlaces.openingHours}}
                        <p>{{this}}</p>
                        {{/each}}
                    </div>
                </div>
                {{/if}}

                <!-- Contact -->
                <div class="neo-card p-6">
                    <h3 class="text-lg font-bold text-white mb-4 uppercase font-display">
                        <i class="fas fa-address-card mr-2 text-[var(--color-toxic)]"></i>Contact
                    </h3>
                    <dl class="space-y-3 text-sm">
                        {{#if venue.address}}
                        <div class="flex items-start gap-3">
                            <dt class="text-[var(--color-toxic)]"><i class="fas fa-map-marker-alt"></i></dt>
                            <dd class="text-gray-300">{{venue.address}}</dd>
                        </div>
                        {{/if}}
                        {{#if googlePlaces.phone}}
                        <div class="flex items-start gap-3">
                            <dt class="text-[var(--color-toxic)]"><i class="fas fa-phone"></i></dt>
                            <dd><a href="tel:{{googlePlaces.phone}}" class="text-white hover:text-[var(--color-toxic)] transition-colors">{{googlePlaces.phone}}</a></dd>
                        </div>
                        {{else if venue.contactPhone}}
                        <div class="flex items-start gap-3">
                            <dt class="text-[var(--color-toxic)]"><i class="fas fa-phone"></i></dt>
                            <dd><a href="tel:{{venue.contactPhone}}" class="text-white hover:text-[var(--color-toxic)] transition-colors">{{venue.contactPhone}}</a></dd>
                        </div>
                        {{/if}}
                        {{#if venue.contactEmail}}
                        <div class="flex items-start gap-3">
                            <dt class="text-[var(--color-toxic)]"><i class="fas fa-envelope"></i></dt>
                            <dd><a href="mailto:{{venue.contactEmail}}" class="text-white hover:text-[var(--color-toxic)] transition-colors">{{venue.contactEmail}}</a></dd>
                        </div>
                        {{/if}}
                    </dl>
                </div>

                <!-- Venue Features -->
                {{#if venue.venueFeatures.length}}
                <div class="neo-card p-6">
                    <h3 class="text-lg font-bold text-white mb-4 uppercase font-display">
                        <i class="fas fa-list mr-2 text-[var(--color-toxic)]"></i>Features
                    </h3>
                    <div class="flex flex-wrap gap-2">
                        {{#each venue.venueFeatures}}
                        <span class="category-tag">{{this}}</span>
                        {{/each}}
                    </div>
                </div>
                {{/if}}

                <!-- Social Media -->
                {{#if venue.instagram}}
                <div class="neo-card p-6">
                    <h3 class="text-lg font-bold text-white mb-4 uppercase font-display">
                        <i class="fas fa-share-alt mr-2 text-[var(--color-toxic)]"></i>Follow
                    </h3>
                    <div class="flex justify-center space-x-6 text-2xl">
                        {{#if venue.instagram}}
                        <a href="{{venue.instagram}}" target="_blank" rel="noopener noreferrer" class="text-white hover:text-[var(--color-toxic)] transition-colors">
                            <i class="fab fa-instagram"></i>
                        </a>
                        {{/if}}
                        {{#if venue.facebook}}
                        <a href="{{venue.facebook}}" target="_blank" rel="noopener noreferrer" class="text-white hover:text-[var(--color-toxic)] transition-colors">
                            <i class="fab fa-facebook"></i>
                        </a>
                        {{/if}}
                        {{#if venue.tiktok}}
                        <a href="{{venue.tiktok}}" target="_blank" rel="noopener noreferrer" class="text-white hover:text-[var(--color-toxic)] transition-colors">
                            <i class="fab fa-tiktok"></i>
                        </a>
                        {{/if}}
                    </div>
                </div>
                {{/if}}

                <!-- Share -->
                <div class="neo-card p-6">
                    <button id="share-button" class="btn-outline w-full flex items-center justify-center">
                        <i class="fas fa-share-alt mr-2"></i>SHARE VENUE
                    </button>
                </div>
            </aside>
        </div>
    </main>

    <!-- Image Modal -->
    <div id="imageModal" class="fixed inset-0 bg-black/95 z-50 hidden flex items-center justify-center p-4">
        <div class="relative max-w-5xl max-h-full">
            <img id="modalImage" src="" alt="" class="max-w-full max-h-full object-contain">
            <button onclick="closeImageModal()" class="absolute top-4 right-4 text-white text-2xl bg-black border-2 border-[#f3e8ff] w-12 h-12 flex items-center justify-center hover:bg-[var(--color-purple)] hover:border-[var(--color-purple)] transition-all">
                <i class="fas fa-times"></i>
            </button>
            <button onclick="previousImage()" class="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-2xl bg-black border-2 border-[#f3e8ff] w-12 h-12 flex items-center justify-center hover:bg-[var(--color-purple)] hover:border-[var(--color-purple)] transition-all">
                <i class="fas fa-chevron-left"></i>
            </button>
            <button onclick="nextImage()" class="absolute right-16 top-1/2 transform -translate-y-1/2 text-white text-2xl bg-black border-2 border-[#f3e8ff] w-12 h-12 flex items-center justify-center hover:bg-[var(--color-purple)] hover:border-[var(--color-purple)] transition-all">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    </div>

    <!-- Footer -->
    <footer class="bg-black border-t-4 border-[var(--color-light)] mt-16">
        <div class="h-[6px] progress-pride-bg"></div>
        <div class="container mx-auto px-6 py-12">
            <div class="grid md:grid-cols-3 gap-12">
                <div>
                    <div class="font-display font-black text-4xl misprint leading-none mb-6">
                        BRUM<br><span class="text-[var(--color-purple)]">OUT</span>LOUD
                    </div>
                    <p class="text-gray-400 text-sm leading-relaxed mb-6">Birmingham's home for LGBTQ+ events, venues, and community.</p>
                </div>
                <div>
                    <h4 class="font-bold text-sm mb-4 text-[var(--color-toxic)] uppercase tracking-widest">Explore</h4>
                    <div class="flex flex-col gap-3 font-bold text-sm uppercase tracking-widest">
                        <a href="/events" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Events</a>
                        <a href="/all-venues" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Venues</a>
                        <a href="/community" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Community</a>
                        <a href="/contact" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Contact</a>
                        <a href="/promoter-tool" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Promoter Tools</a>
                    </div>
                </div>
                <div class="md:text-right">
                    <div class="flex md:justify-end gap-4 mb-4">
                        <a href="https://www.instagram.com/brumoutloud/" target="_blank" rel="noopener noreferrer" class="text-3xl hover:text-[var(--color-toxic)] transition-colors">
                            <i class="fab fa-instagram"></i>
                        </a>
                    </div>
                    <p class="font-bold text-sm text-[var(--color-purple)] uppercase tracking-widest">© 2026 BRUM OUTLOUD</p>
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

        // Enhanced lightbox functionality
        let currentImageIndex = 0;
        let galleryImages = [];

        // Image modal functions
        function openImageModal(imageUrl) {
            // Get all gallery images
            const galleryItems = document.querySelectorAll('.gallery-item img');
            galleryImages = Array.from(galleryItems).map(img => img.src);
            currentImageIndex = galleryImages.indexOf(imageUrl);
            
            document.getElementById('modalImage').src = imageUrl;
            document.getElementById('imageModal').classList.remove('hidden');
            document.getElementById('imageModal').classList.add('flex');
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }

        function closeImageModal() {
            document.getElementById('imageModal').classList.add('hidden');
            document.getElementById('imageModal').classList.remove('flex');
            // Restore body scroll
            document.body.style.overflow = 'auto';
        }

        function nextImage() {
            if (galleryImages.length > 0) {
                currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
                document.getElementById('modalImage').src = galleryImages[currentImageIndex];
            }
        }

        function previousImage() {
            if (galleryImages.length > 0) {
                currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
                document.getElementById('modalImage').src = galleryImages[currentImageIndex];
            }
        }

        // Share button
        document.getElementById('share-button').addEventListener('click', function() {
            const btn = this;
            if (navigator.share) {
                navigator.share({
                    title: '{{venue.name}} - Brum Outloud',
                    text: '{{venue.description}}',
                    url: window.location.href
                });
            } else {
                navigator.clipboard.writeText(window.location.href);
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check mr-2"></i>LINK COPIED!';
                btn.classList.add('!border-green-400', '!text-green-400');
                setTimeout(function() {
                    btn.innerHTML = original;
                    btn.classList.remove('!border-green-400', '!text-green-400');
                }, 2000);
            }
        });

        // Close modal when clicking outside
        document.getElementById('imageModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeImageModal();
            }
        });

        // Keyboard navigation for lightbox
        document.addEventListener('keydown', function(e) {
            if (!document.getElementById('imageModal').classList.contains('hidden')) {
                if (e.key === 'Escape') {
                    closeImageModal();
                } else if (e.key === 'ArrowRight') {
                    nextImage();
                } else if (e.key === 'ArrowLeft') {
                    previousImage();
                }
            }
        });

        // Load events for this venue
        // Try to load events immediately, and also on DOMContentLoaded as backup
        setTimeout(function() {
            loadVenueEvents();
        }, 100);
        
        document.addEventListener('DOMContentLoaded', function() {
            loadVenueEvents();
        });

        // Simple events loading function
        async function loadVenueEvents() {
            try {
                console.log('🚀 Loading events for venue: {{venue.slug}}');
                
                // First, let's test if the container exists
                const eventsContainer = document.getElementById('events-container');
                console.log('📦 Events container found:', eventsContainer);
                
                if (!eventsContainer) {
                    console.error('❌ Events container not found!');
                    eventsContainer.innerHTML = '<div class="text-red-500 p-4">ERROR: Events container not found!</div>';
                    return;
                }
                
                // Add a loading message
                eventsContainer.innerHTML = '<div class="text-center py-8"><div class="animate-spin h-8 w-8 border-b-2 border-[var(--color-toxic)] mx-auto"></div><p class="text-gray-400 mt-2">Loading events...</p></div>';
                
                console.log('🌐 Fetching from API...');
                const response = await fetch('/.netlify/functions/get-events-by-venue?venueSlug={{venue.slug}}');
                console.log('📡 Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error('Failed to fetch events: ' + response.status);
                }
                
                const data = await response.json();
                console.log('📊 Events data received:', data);
                
                if (data.success && data.events && data.events.length > 0) {
                    console.log('✅ Total events found:', data.events.length);
                    
                    let html = '<div class="space-y-3">';
                    data.events.forEach((event, index) => {
                        const d = new Date(event.date);
                        const day = d.getDate();
                        const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
                        const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

                        html += '<a href="/event/' + event.slug + '" class="block border-2 border-[#f3e8ff]/20 p-4 flex items-center space-x-4 hover:border-[var(--color-toxic)] hover:bg-white/5 transition-all duration-200">';
                        html += '<div class="text-center w-16 flex-shrink-0">';
                        html += '<p class="text-2xl font-bold text-[var(--color-toxic)]">' + day + '</p>';
                        html += '<p class="text-sm text-gray-400 uppercase font-bold">' + month + '</p>';
                        html += '</div>';
                        html += '<div class="flex-grow">';
                        html += '<h4 class="font-bold text-white text-lg">' + event.name + '</h4>';
                        html += '<p class="text-sm text-gray-400">' + time + '</p>';
                        html += '</div>';
                        html += '<div class="text-[var(--color-toxic)]"><i class="fas fa-arrow-right"></i></div>';
                        html += '</a>';
                    });
                    html += '</div>';
                    
                    console.log('🎨 Setting HTML content...');
                    eventsContainer.innerHTML = html;
                    console.log('✅ Events displayed successfully!');
                    
                } else {
                    console.log('📭 No events found');
                    eventsContainer.innerHTML = '<div class="text-center py-12 border-2 border-[#f3e8ff]/10"><i class="fas fa-calendar-times text-4xl text-gray-600 mb-4 block"></i><h3 class="text-xl font-bold text-white mb-2 uppercase font-display">No Upcoming Events</h3><p class="text-gray-400 mb-6">Check back soon for new events.</p><a href="/promoter-tool" class="btn-neo inline-flex items-center"><i class="fas fa-plus mr-2"></i>Submit an Event</a></div>';
                }
            } catch (error) {
                console.error('❌ Error loading events:', error);
                const eventsContainer = document.getElementById('events-container');
                if (eventsContainer) {
                    eventsContainer.innerHTML = '<div class="text-center py-12 border-2 border-[#f3e8ff]/10"><i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4 block"></i><h3 class="text-xl font-bold text-white mb-2 uppercase font-display">Error Loading Events</h3><p class="text-gray-400">Please try again later.</p></div>';
                }
            }
        }



        // Helper function to extract recurring pattern (fallback)
        function extractRecurringPattern(recurringInfo) {
            if (!recurringInfo) return null;
            
            const text = recurringInfo.toLowerCase();
            if (text.includes('weekly') || text.includes('every week')) {
                return 'weekly';
            } else if (text.includes('monthly') || text.includes('every month')) {
                return 'monthly';
            } else if (text.includes('daily') || text.includes('every day')) {
                return 'daily';
            } else if (text.includes('bi-weekly') || text.includes('every two weeks')) {
                return 'bi-weekly';
            } else if (text.includes('yearly') || text.includes('annual')) {
                return 'yearly';
            } else {
                return 'recurring';
            }
        }
    </script>
</body>
</html>`;
}