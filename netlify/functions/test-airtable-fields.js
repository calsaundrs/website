const Airtable = require('airtable');

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
    console.log('🔍 Testing Airtable fields...');
    
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Get a single record to see what fields are available
    const records = await base('Events').select({
      maxRecords: 1,
      fields: ['Event Name'] // Just get one field to see the structure
    }).firstPage();

    if (records.length === 0) {
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: 'No events found',
          availableFields: []
        })
      };
    }

    const record = records[0];
    const availableFields = Object.keys(record.fields);
    
    console.log('Available fields:', availableFields);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Fields retrieved successfully',
        availableFields: availableFields,
        sampleRecord: {
          id: record.id,
          eventName: record.fields['Event Name'],
          fields: record.fields
        }
      })
    };

  } catch (error) {
    console.error('❌ Failed to test Airtable fields:', error);
    
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
        timestamp: new Date().toISOString()
      })
    };
  }
};