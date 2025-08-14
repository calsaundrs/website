const GooglePlacesService = require('./services/google-places-service');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { placeId } = JSON.parse(event.body);
    
    if (!placeId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Place ID is required' })
      };
    }

    console.log(`🧪 Testing Google Places API for Place ID: ${placeId}`);

    const googlePlacesService = new GooglePlacesService();
    
    // Test with a mock venue object
    const mockVenue = {
      name: 'Test Venue',
      googlePlaceId: placeId
    };

    const result = await googlePlacesService.getVenueGooglePlacesData(mockVenue, {
      maxImages: 3,
      maxReviews: 2,
      forceRefresh: true
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        placeId: placeId,
        apiEnabled: googlePlacesService.enabled,
        result: {
          hasImages: result.images && result.images.length > 0,
          imageCount: result.images ? result.images.length : 0,
          hasReviews: result.reviews && result.reviews.length > 0,
          reviewCount: result.reviews ? result.reviews.length : 0,
          hasRating: !!result.rating,
          rating: result.rating,
          hasOpeningHours: result.openingHours && result.openingHours.length > 0,
          hasPhone: !!result.phone,
          hasWebsite: !!result.website,
          lastUpdated: result.lastUpdated
        },
        fullResult: result
      })
    };

  } catch (error) {
    console.error('❌ Google Places API test error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to test Google Places API',
        message: error.message,
        stack: error.stack
      })
    };
  }
};
