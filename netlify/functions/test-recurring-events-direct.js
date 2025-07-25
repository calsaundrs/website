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
    console.log('🔍 Testing recurring events directly...');
    
    // Test 1: Call EventService directly
    console.log('Testing EventService.getEvents with admin mode...');
    const allEvents = await eventService.getEvents({}, { admin: true });
    
    console.log(`Found ${allEvents.length} total events`);

    // Test 2: Filter for recurring events
    const recurringEvents = allEvents.filter(event => 
        event.recurringInfo || event.series
    );
    
    console.log(`Found ${recurringEvents.length} recurring events`);

    // Test 3: Test the actual get-recurring-events function
    console.log('Testing get-recurring-events function...');
    const { handler } = require('./get-recurring-events');
    
    const mockEvent = {
      httpMethod: 'GET',
      queryStringParameters: {}
    };
    
    const mockContext = {};
    
    const result = await handler(mockEvent, mockContext);
    console.log('get-recurring-events result status:', result.statusCode);
    
    let recurringData = null;
    if (result.statusCode === 200) {
      recurringData = JSON.parse(result.body);
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Direct recurring events test completed',
        totalEvents: allEvents.length,
        recurringEvents: recurringEvents.length,
        getRecurringEventsStatus: result.statusCode,
        getRecurringEventsData: recurringData,
        eventServiceVersion: '2025-07-25-v3',
        environment: {
          URL: process.env.URL,
          DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
          NODE_ENV: process.env.NODE_ENV
        }
      })
    };

  } catch (error) {
    console.error('❌ Direct recurring events test failed:', error);
    
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