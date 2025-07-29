exports.handler = async (event, context) => {
  try {
    console.log('Basic function test starting...');
    
    const testData = {
      message: 'Basic function is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      hasAirtableToken: !!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
      hasAirtableBase: !!process.env.AIRTABLE_BASE_ID,
      hasFirebaseProject: !!process.env.FIREBASE_PROJECT_ID,
      hasFirebaseEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasFirebaseKey: !!process.env.FIREBASE_PRIVATE_KEY,
      hasCloudinaryName: !!process.env.CLOUDINARY_CLOUD_NAME
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        success: true,
        data: testData
      })
    };

  } catch (error) {
    console.error('Basic function test failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        success: false,
        error: error.message 
      })
    };
  }
}; 