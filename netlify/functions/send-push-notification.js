const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
    }),
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const { type, title, body, data = {} } = JSON.parse(event.body);

    if (!type || !title || !body) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: type, title, body'
        })
      };
    }

    // Get admin push subscriptions from Firestore
    const subscriptionsRef = db.collection('admin_push_subscriptions');
    const subscriptionsSnapshot = await subscriptionsRef.get();

    if (subscriptionsSnapshot.empty) {
      console.log('No admin push subscriptions found');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: 'No admin subscriptions found',
          sent: 0
        })
      };
    }

    // Prepare notification payload
    const notificationPayload = {
      title: title,
      body: body,
      type: type,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      requireInteraction: type === 'new-submission',
      tag: type
    };

    // Send notifications to all admin subscriptions
    const results = [];
    for (const doc of subscriptionsSnapshot.docs) {
      const subscription = doc.data();

      try {
        // In a real implementation, you would use a push service like FCM
        // For now, we'll log the notification and store it for the poller to pick up
        console.log(`Sending push notification to admin: ${subscription.userAgent}`);

        // Store notification in Firestore for the poller to pick up
        await db.collection('admin_notifications').add({
          type: type,
          title: title,
          body: body,
          data: data,
          timestamp: new Date(),
          subscriptionId: doc.id,
          status: 'sent'
        });

        results.push({
          subscriptionId: doc.id,
          status: 'sent'
        });
      } catch (error) {
        console.error(`Failed to send notification to subscription ${doc.id}:`, error);
        results.push({
          subscriptionId: doc.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Push notifications sent',
        sent: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length,
        results: results
      })
    };

  } catch (error) {
    console.error('Error sending push notifications:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
