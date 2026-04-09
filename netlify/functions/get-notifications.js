const admin = require('firebase-admin');
const { verifyAuth } = require('./utils/auth');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    console.log('📢 Getting system notifications from Firestore...');
    
    // Verify authentication
    try {
        await verifyAuth(event);
    } catch (authError) {
        return {
            statusCode: authError.statusCode || 401,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ success: false, error: authError.message })
        };
    }

    // Get recent notifications (last 24 hours by default)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const snapshot = await db.collection('system_notifications')
      .where('timestamp', '>=', oneDayAgo)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    const notifications = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        type: data.type,
        title: data.title,
        message: data.message,
        severity: data.severity,
        details: data.details,
        timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString(),
        status: data.status || 'New'
      });
    });
    
    console.log(`📊 Found ${notifications.length} recent notifications`);
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: notifications,
        count: notifications.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Error getting notifications:', error);
    
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