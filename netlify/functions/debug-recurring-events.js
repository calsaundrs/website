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
    console.log('🔍 Debugging get-recurring-events function...');
    
    // Test 1: Call EventService directly (same as get-recurring-events)
    console.log('Testing EventService.getEvents with admin mode...');
    const allEvents = await eventService.getEvents({}, { admin: true });
    
    console.log(`Found ${allEvents.length} total events`);

    // Test 2: Filter for recurring events (same logic as get-recurring-events)
    const recurringEvents = allEvents.filter(event => 
        event.recurringInfo || event.series
    );
    
    console.log(`Found ${recurringEvents.length} recurring events`);

    // Test 3: Check the structure of recurring events
    let recurringEventStructure = null;
    if (recurringEvents.length > 0) {
      const sampleEvent = recurringEvents[0];
      recurringEventStructure = {
        id: sampleEvent.id,
        name: sampleEvent.name,
        hasImage: !!sampleEvent.image,
        imageUrl: sampleEvent.image?.url,
        hasRecurringInfo: !!sampleEvent.recurringInfo,
        hasSeries: !!sampleEvent.series,
        venue: sampleEvent.venue?.name,
        status: sampleEvent.status
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'get-recurring-events debug completed',
        totalEvents: allEvents.length,
        recurringEvents: recurringEvents.length,
        sampleRecurringEvent: recurringEventStructure,
        eventServiceVersion: '2025-07-25-v2'
      })
    };

  } catch (error) {
    console.error('❌ get-recurring-events debug failed:', error);
    
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