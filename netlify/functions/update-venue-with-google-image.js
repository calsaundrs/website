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
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { venueId } = JSON.parse(event.body);
    
    if (!venueId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Venue ID is required' })
      };
    }

    console.log(`🖼️ Updating venue ${venueId} with Google Places image`);

    // Get venue data
    const venueRef = db.collection('venues').doc(venueId);
    const venueDoc = await venueRef.get();

    if (!venueDoc.exists) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Venue not found' })
      };
    }

    const venueData = venueDoc.data();
    console.log(`📋 Found venue: ${venueData.name}`);

    // Check if venue already has a real image
    const currentImage = venueData.image || venueData.Image || venueData.Photo;
    if (currentImage && typeof currentImage === 'object' && currentImage.url && !currentImage.url.includes('placehold.co')) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Venue already has a real image',
          venueName: venueData.name
        })
      };
    }

    // Check if venue has Google Place ID
    const googlePlaceId = venueData.googlePlaceId || venueData['Google Place ID'] || venueData.google_place_id;
    if (!googlePlaceId) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'No Google Place ID found',
          venueName: venueData.name
        })
      };
    }

    // Get Google Places data
    const googlePlacesData = await googlePlacesService.getVenueGooglePlacesData(venueData, {
      maxImages: 1,
      forceRefresh: true
    });

    if (!googlePlacesData.images || googlePlacesData.images.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'No Google Places images found',
          venueName: venueData.name,
          placeId: googlePlaceId
        })
      };
    }

    // Update venue with Google Places image
    const googleImage = googlePlacesData.images[0];
    await venueRef.update({
      image: {
        url: googleImage.url,
        width: googleImage.width,
        height: googleImage.height,
        source: 'google_places'
      },
      lastUpdated: new Date().toISOString()
    });

    console.log(`✅ Updated venue ${venueData.name} with Google Places image`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Updated with Google Places image',
        venueName: venueData.name,
        imageUrl: googleImage.url,
        placeId: googlePlaceId
      })
    };

  } catch (error) {
    console.error('❌ Error updating venue with Google image:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to update venue with Google image',
        message: error.message
      })
    };
  }
};
