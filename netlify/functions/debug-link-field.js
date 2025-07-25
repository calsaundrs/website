const Airtable = require('airtable');

// Version: 2025-07-25-v1 - Debug Link field issue

exports.handler = async (event, context) => {
  try {
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Get all events with Link field
    const records = await base('Events').select({
      maxRecords: 10,
      fields: ['Event Name', 'Link', 'Slug']
    }).firstPage();

    const results = records.map(record => ({
      name: record.fields['Event Name'],
      link: record.fields['Link'],
      slug: record.fields['Slug'],
      linkType: typeof record.fields['Link'],
      hasLink: !!record.fields['Link']
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        totalRecords: records.length,
        results: results,
        fieldsWithLinks: results.filter(r => r.hasLink).length
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