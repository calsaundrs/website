const SystemMonitor = require('./services/system-monitor');

// Use a singleton pattern to maintain state across function calls
let systemMonitor = null;

function getSystemMonitor() {
  if (!systemMonitor) {
    systemMonitor = new SystemMonitor();
  }
  return systemMonitor;
}

// Version: 2025-07-25-v3 - Fixed singleton pattern for system monitor

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
    console.log('🚀 Running system health check...');
    
    // Run all tests
    const monitor = getSystemMonitor();
    const results = await monitor.runAllTests();
    
    console.log(`✅ Health check completed: ${results.passed}/${results.totalTests} tests passed`);
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'System health check completed',
        data: results
      })
    };

  } catch (error) {
    console.error('❌ System health check failed:', error);
    
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