const admin = require('firebase-admin');
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
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🔍 Query string parameters:', event.queryStringParameters);
    
    // Get the slug from query parameters
    const slug = event.queryStringParameters?.slug;
    
    console.log('🔍 Extracted slug:', slug);
    
    if (!slug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Venue slug is required',
          debug: {
            queryStringParameters: event.queryStringParameters
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
        headers,
        body: JSON.stringify({ 
          error: 'Venue not found',
          slug: slug
        })
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

    // Return JSON data
    const responseData = {
      venue: venue,
      googlePlaces: googlePlacesData,
      upcomingEvents: upcomingEvents,
      hasUpcomingEvents: upcomingEvents.length > 0
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('❌ Error in get-venue-details-json:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
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
      googlePlaceId: googlePlaceId
    };
    
  } catch (error) {
    console.error('❌ Error in getVenueBySlug:', error);
    return null;
  }
}

function processVenueForPublic(venueData) {
  // Extract image URL using same logic as events
  let imageUrl = null;
  
  // 1. Try explicit image fields
  if (venueData.image) {
    imageUrl = typeof venueData.image === 'string' ? venueData.image : venueData.image.url;
  } else if (venueData['Image']) {
    imageUrl = typeof venueData['Image'] === 'string' ? venueData['Image'] : venueData['Image'].url;
  } else if (venueData.venueImage) {
    imageUrl = typeof venueData.venueImage === 'string' ? venueData.venueImage : venueData.venueImage.url;
  } else if (venueData['Venue Image']) {
    imageUrl = typeof venueData['Venue Image'] === 'string' ? venueData['Venue Image'] : venueData['Venue Image'].url;
  }
  
  // Generate slug from name
  const slug = venueData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return {
    ...venueData,
    image: imageUrl ? { url: imageUrl } : null,
    slug: slug
  };
}

async function getUpcomingEventsForVenue(venueId) {
  try {
    console.log(`📅 Getting upcoming events for venue: ${venueId}`);
    
    const eventsRef = db.collection('events');
    const now = new Date();
    
    // Get events for this venue that are in the future
    const snapshot = await eventsRef
      .where('venueId', '==', venueId)
      .where('date', '>=', now)
      .orderBy('date', 'asc')
      .limit(10)
      .get();
    
    const events = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      events.push({
        id: doc.id,
        name: data.name,
        date: data.date,
        time: data.time,
        description: data.description,
        image: data.image,
        venue: data.venue,
        categories: data.categories || [],
        recurringPattern: data.recurringPattern
      });
    });
    
    console.log(`📅 Found ${events.length} upcoming events for venue ${venueId}`);
    return events;
    
  } catch (error) {
    console.error('❌ Error getting upcoming events:', error);
    return [];
  }
}

