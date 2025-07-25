const SystemMonitor = require('./services/system-monitor');

const systemMonitor = new SystemMonitor();

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
    console.log('🔍 Debugging system status...');
    
    // Test 1: Check if tests have been run
    console.log('Test results size:', systemMonitor.testResults.size);
    console.log('Last run:', systemMonitor.lastRun);
    
    // Test 2: Try to get system status
    console.log('Calling getSystemStatus...');
    const status = await systemMonitor.getSystemStatus();
    console.log('System status result:', status);
    
    // Test 3: Check if tests were run
    console.log('Test results size after getSystemStatus:', systemMonitor.testResults.size);
    console.log('Last run after getSystemStatus:', systemMonitor.lastRun);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'System status debug completed',
        initialTestResultsSize: systemMonitor.testResults.size,
        initialLastRun: systemMonitor.lastRun,
        finalStatus: status,
        finalTestResultsSize: systemMonitor.testResults.size,
        finalLastRun: systemMonitor.lastRun,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ System status debug failed:', error);
    
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