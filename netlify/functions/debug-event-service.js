const EventService = require('./services/event-service');

const eventService = new EventService();

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
    console.log('🔍 Debugging EventService...');
    
    // Test 1: Get events in admin mode
    console.log('Testing EventService.getEvents with admin mode...');
    const events = await eventService.getEvents({}, { admin: true });
    
    console.log(`Found ${events.length} events`);
    
    // Test 2: Check the structure of the first event
    let eventStructure = null;
    if (events.length > 0) {
      eventStructure = {
        id: events[0].id,
        name: events[0].name,
        hasImage: !!events[0].image,
        imageUrl: events[0].image?.url,
        venue: events[0].venue,
        status: events[0].status
      };
    }
    
    // Test 3: Check if there are any recurring events
    const recurringEvents = events.filter(event => event.recurringInfo || event.series);
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'EventService debug completed',
        totalEvents: events.length,
        recurringEvents: recurringEvents.length,
        sampleEvent: eventStructure,
        sampleRecurringEvent: recurringEvents.length > 0 ? {
          id: recurringEvents[0].id,
          name: recurringEvents[0].name,
          hasImage: !!recurringEvents[0].image,
          imageUrl: recurringEvents[0].image?.url,
          recurringInfo: !!recurringEvents[0].recurringInfo,
          series: !!recurringEvents[0].series
        } : null
      })
    };

  } catch (error) {
    console.error('❌ EventService debug failed:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString(),
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
};