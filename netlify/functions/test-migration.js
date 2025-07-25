exports.handler = async (event, context) => {
  try {
    console.log('Test migration endpoint accessed');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        message: 'Migration endpoint is working',
        timestamp: new Date().toISOString(),
        environment: {
          hasAirtableToken: !!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
          hasAirtableBase: !!process.env.AIRTABLE_BASE_ID,
          hasCloudinary: !!process.env.CLOUDINARY_CLOUD_NAME
        }
      })
    };
    
  } catch (error) {
    console.error('Test migration failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};