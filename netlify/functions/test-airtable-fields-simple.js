const Airtable = require('airtable');

exports.handler = async (event, context) => {
  try {
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Get one event record to see all available fields
    const records = await base('Events').select({
      maxRecords: 1,
      filterByFormula: `{Event Name} = "The Haus of Aja"`
    }).firstPage();

    if (records.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: "Event 'The Haus of Aja' not found"
        })
      };
    }

    const record = records[0];
    const fields = record.fields;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        eventName: fields['Event Name'],
        allFields: Object.keys(fields),
        fieldValues: Object.fromEntries(
          Object.keys(fields).map(key => [key, fields[key]])
        )
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};