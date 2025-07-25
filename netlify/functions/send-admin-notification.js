const Airtable = require('airtable');

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { title, message, severity = 'medium', adminSessionId } = JSON.parse(event.body);
    
    if (!title || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Title and message are required' })
      };
    }

    console.log(`📢 Sending admin notification: ${title}`);

    // Store the notification in Airtable
    const notificationRecord = await base('System Notifications').create([{
      fields: {
        'Type': 'admin_notification',
        'Title': title,
        'Message': message,
        'Severity': severity,
        'Details': JSON.stringify({
          adminSessionId: adminSessionId,
          timestamp: new Date().toISOString(),
          source: 'system-monitor'
        }),
        'Timestamp': new Date().toISOString(),
        'Status': 'New'
      }
    }]);

    // For now, we'll just store the notification
    // In a real implementation, you might want to:
    // 1. Check if admin is currently online
    // 2. Send via WebSocket if available
    // 3. Queue for next admin login
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Notification stored successfully',
        notificationId: notificationRecord[0].id
      })
    };

  } catch (error) {
    console.error('❌ Failed to send admin notification:', error);
    
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