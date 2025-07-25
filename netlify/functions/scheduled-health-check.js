const SystemMonitor = require('./services/system-monitor');

const systemMonitor = new SystemMonitor();

exports.handler = async function(event, context) {
  try {
    console.log('⏰ Scheduled health check starting...');
    
    // Run all tests
    const results = await systemMonitor.runAllTests();
    
    console.log(`✅ Scheduled health check completed: ${results.passed}/${results.totalTests} tests passed`);
    
    // Return success for Netlify scheduled functions
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Scheduled health check completed',
        data: results
      })
    };

  } catch (error) {
    console.error('❌ Scheduled health check failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};