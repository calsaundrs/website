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
    console.log('🔍 Testing Airtable query directly...');
    
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Test 1: Try the exact query that EventService uses
    console.log('Testing EventService query...');
    const eventServiceQuery = {
      filterByFormula: "RECORD_ID() != ''",
      sort: [{ field: 'Date', direction: 'asc' }],
      fields: [
        'Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date',
        'Venue', 'Venue Name', 'VenueText', 'Category', 'Description',
        'Promo Image', 'Cloudinary Public ID', 'Featured Banner Start Date',
        'Featured Banner End Date', 'Boosted Listing Start Date',
        'Boosted Listing End Date', 'Status', 'Submitter Email'
      ]
    };

    console.log('Query fields:', eventServiceQuery.fields);
    
    const records = await base('Events').select(eventServiceQuery).firstPage();
    
    console.log(`Found ${records.length} records with EventService query`);

    // Test 2: Try a minimal query to see what fields are actually available
    console.log('Testing minimal query...');
    const minimalQuery = {
      maxRecords: 1,
      fields: ['Event Name']
    };

    const minimalRecords = await base('Events').select(minimalQuery).firstPage();
    
    if (minimalRecords.length > 0) {
      const availableFields = Object.keys(minimalRecords[0].fields);
      console.log('Available fields in first record:', availableFields);
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Airtable query test completed',
        eventServiceQuery: {
          fields: eventServiceQuery.fields,
          recordCount: records.length
        },
        minimalQuery: {
          recordCount: minimalRecords.length,
          availableFields: minimalRecords.length > 0 ? Object.keys(minimalRecords[0].fields) : []
        }
      })
    };

  } catch (error) {
    console.error('❌ Airtable query test failed:', error);
    
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