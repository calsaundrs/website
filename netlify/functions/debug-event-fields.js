const Airtable = require('airtable');

// Version: 2025-07-25-v1 - Debug event fields

exports.handler = async (event, context) => {
  try {
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Get a sample event to see all fields
    const records = await base('Events').select({
      maxRecords: 1
    }).all();

    if (records.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No events found' })
      };
    }

    const sampleRecord = records[0];
    const fields = sampleRecord.fields;

    // Check for link-related fields
    const linkFields = {};
    Object.keys(fields).forEach(key => {
      if (key.toLowerCase().includes('link') || key.toLowerCase().includes('url') || key.toLowerCase().includes('ticket')) {
        linkFields[key] = fields[key];
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Event fields debug completed',
        eventName: fields['Event Name'],
        allFields: Object.keys(fields),
        linkFields: linkFields,
        linkFieldValue: fields['Link'] || 'NOT_FOUND',
        venueLinkValue: fields['Venue Link'] || 'NOT_FOUND'
      })
    };

  } catch (error) {
    console.error('Error in debug-event-fields:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Failed to debug event fields',
        details: error.message 
      })
    };
  }
};