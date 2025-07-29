const Airtable = require('airtable');
const admin = require('firebase-admin');

exports.handler = async (event, context) => {
  try {
    console.log('Testing migration connections...');
    
    const results = {
      airtable: { success: false, error: null, count: 0 },
      firebase: { success: false, error: null, count: 0 }
    };
    
    // Test Airtable connection
    try {
      console.log('Testing Airtable connection...');
      const base = new Airtable({ 
        apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
      }).base(process.env.AIRTABLE_BASE_ID);
      
      const airtableRecords = await base('Events').select({
        filterByFormula: '{Status} = "Approved"',
        fields: ['Event Name', 'Slug'],
        maxRecords: 5
      }).firstPage();
      
      results.airtable.success = true;
      results.airtable.count = airtableRecords.length;
      console.log(`Airtable test successful: ${airtableRecords.length} records`);
      
    } catch (error) {
      console.error('Airtable test failed:', error);
      results.airtable.error = error.message;
    }
    
    // Test Firebase connection
    try {
      console.log('Testing Firebase connection...');
      
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
      }
      const db = admin.firestore();
      
      const firestoreSnapshot = await db.collection('events')
        .where('status', '==', 'approved')
        .limit(5)
        .get();
      
      results.firebase.success = true;
      results.firebase.count = firestoreSnapshot.size;
      console.log(`Firebase test successful: ${firestoreSnapshot.size} records`);
      
    } catch (error) {
      console.error('Firebase test failed:', error);
      results.firebase.error = error.message;
    }

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
        message: 'Connection test completed',
        results: results,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Connection test failed:', error);
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