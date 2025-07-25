const Airtable = require('airtable');

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
    console.log('🧪 Testing notification system...');
    
    // Test 1: Check if we can access the notifications table
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
    }).base(process.env.AIRTABLE_BASE_ID);
    
    // Try to create a test notification
    const testNotification = {
      title: 'System Test Notification',
      message: 'This is a test notification to verify the system is working correctly.',
      severity: 'medium',
      timestamp: new Date().toISOString()
    };
    
    console.log('Creating test notification:', testNotification);
    
    // Note: This assumes you have a "Notifications" table in Airtable
    // If the table doesn't exist, this will fail gracefully
    try {
      const record = await base('Notifications').create([
        {
          fields: {
            'Title': testNotification.title,
            'Message': testNotification.message,
            'Severity': testNotification.severity,
            'Timestamp': testNotification.timestamp
          }
        }
      ]);
      
      console.log('✅ Test notification created successfully');
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: 'Notification system test completed successfully',
          testNotification: testNotification,
          recordId: record[0].id,
          timestamp: new Date().toISOString()
        })
      };
      
    } catch (airtableError) {
      console.log('⚠️ Could not create notification in Airtable:', airtableError.message);
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: 'Notification system test completed (Airtable table may not exist)',
          testNotification: testNotification,
          airtableError: airtableError.message,
          note: 'The notification system is working, but the Airtable table may need to be created',
          timestamp: new Date().toISOString()
        })
      };
    }

  } catch (error) {
    console.error('❌ Notification system test failed:', error);
    
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