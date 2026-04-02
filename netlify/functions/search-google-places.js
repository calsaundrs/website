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
    const { query } = JSON.parse(event.body);
    
    if (!query) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Query is required' })
      };
    }

    console.log(`🔍 Searching Google Places for: ${query}`);

    const googlePlacesService = new GooglePlacesService();
    
    // Check if API is enabled
    if (!googlePlacesService.enabled) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Google Places API not enabled',
          message: 'GOOGLE_PLACES_API_KEY environment variable is not set'
        })
      };
    }

    // Search for the venue
    const searchResults = await googlePlacesService.searchVenues(query);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        query: query,
        results: searchResults
      })
    };

  } catch (error) {
    console.error('❌ Google Places search error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to search Google Places',
        message: error.message
      })
    };
  }
};
