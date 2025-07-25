const Airtable = require('airtable');

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

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
    console.log('📢 Getting system notifications...');
    
    // Get recent notifications from Airtable
    const records = await base('System Notifications').select({
      sort: [{ field: 'Timestamp', direction: 'desc' }],
      maxRecords: 50,
      fields: ['Type', 'Title', 'Message', 'Severity', 'Details', 'Timestamp', 'Status']
    }).all();

    const notifications = records.map(record => ({
      id: record.id,
      type: record.fields['Type'],
      title: record.fields['Title'],
      message: record.fields['Message'],
      severity: record.fields['Severity'],
      details: record.fields['Details'] ? JSON.parse(record.fields['Details']) : null,
      timestamp: record.fields['Timestamp'],
      status: record.fields['Status']
    }));

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: notifications
      })
    };

  } catch (error) {
    console.error('❌ Failed to get notifications:', error);
    
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