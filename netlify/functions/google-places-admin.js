const GooglePlacesService = require('./services/google-places-service');

const googlePlacesService = new GooglePlacesService();

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const action = event.queryStringParameters?.action || 'status';
    
    switch (action) {
      case 'status':
        return await getGooglePlacesStatus(headers);
      
      case 'test':
        return await testGooglePlacesConnection(headers);
      
      case 'clear-cache':
        return await clearGooglePlacesCache(headers, event.queryStringParameters?.placeId);
      
      case 'refresh-venue':
        return await refreshVenueData(headers, event.queryStringParameters);
      
      default:
        return {
          statusCode: 400,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: 'Invalid action. Supported actions: status, test, clear-cache, refresh-venue'
          })
        };
    }

  } catch (error) {
    console.error('❌ Error in google-places-admin:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

async function getGooglePlacesStatus(headers) {
  console.log('📊 Getting Google Places service status...');
  
  const cacheStats = googlePlacesService.getCacheStats();
  
  return {
    statusCode: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      success: true,
      data: {
        apiEnabled: googlePlacesService.enabled,
        cacheStats: cacheStats,
        service: 'Google Places API',
        timestamp: new Date().toISOString()
      }
    })
  };
}

async function testGooglePlacesConnection(headers) {
  console.log('🔍 Testing Google Places API connection...');
  
  const connectionTest = await googlePlacesService.testConnection();
  
  if (connectionTest.success) {
    console.log('✅ Google Places API connection successful');
  } else {
    console.log('❌ Google Places API connection failed:', connectionTest.error);
  }
  
  return {
    statusCode: connectionTest.success ? 200 : 500,
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      success: connectionTest.success,
      data: connectionTest,
      timestamp: new Date().toISOString()
    })
  };
}

async function clearGooglePlacesCache(headers, placeId) {
  console.log('🗑️ Clearing Google Places cache...');
  
  if (placeId) {
    console.log(`Clearing cache for specific place ID: ${placeId}`);
    await googlePlacesService.clearCache(placeId);
  } else {
    console.log('Clearing all Google Places cache');
    await googlePlacesService.clearAllCache();
  }
  
  const cacheStats = googlePlacesService.getCacheStats();
  
  return {
    statusCode: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      success: true,
      message: placeId ? `Cache cleared for place ID: ${placeId}` : 'All cache cleared',
      data: {
        action: 'cache-cleared',
        placeId: placeId || 'all',
        newCacheStats: cacheStats
      },
      timestamp: new Date().toISOString()
    })
  };
}

async function refreshVenueData(headers, queryParams) {
  const venueSlug = queryParams?.venueSlug;
  const placeId = queryParams?.placeId;
  
  if (!venueSlug && !placeId) {
    return {
      statusCode: 400,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Either venueSlug or placeId is required for refresh'
      })
    };
  }
  
  console.log(`🔄 Refreshing Google Places data for venue: ${venueSlug || placeId}`);
  
  // Create a mock venue object for testing
  const mockVenue = {
    name: venueSlug || 'Test Venue',
    googlePlaceId: placeId || 'ChIJj61dQgK6j4AR4GeTYWZsKWw' // Default test place ID
  };
  
  const refreshedData = await googlePlacesService.getVenueGooglePlacesData(mockVenue, {
    forceRefresh: true,
    maxImages: 8,
    maxReviews: 5
  });
  
  return {
    statusCode: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      success: true,
      message: `Google Places data refreshed for ${venueSlug || placeId}`,
      data: {
        venue: mockVenue,
        placesData: refreshedData,
        refreshedAt: new Date().toISOString()
      }
    })
  };
} 