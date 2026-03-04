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
    const { action, subscription, userAgent, adminId } = JSON.parse(event.body);

    if (!action || !subscription) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: action, subscription'
        })
      };
    }

    const subscriptionsRef = db.collection('admin_push_subscriptions');

    if (action === 'subscribe') {
      // Check if subscription already exists
      const existingQuery = await subscriptionsRef
        .where('endpoint', '==', subscription.endpoint)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        // Update existing subscription
        const existingDoc = existingQuery.docs[0];
        await existingDoc.ref.update({
          subscription: subscription,
          userAgent: userAgent || 'Unknown',
          adminId: adminId || 'unknown',
          updatedAt: new Date(),
          isActive: true
        });

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: 'Subscription updated',
            subscriptionId: existingDoc.id
          })
        };
      } else {
        // Create new subscription
        const newSubscription = await subscriptionsRef.add({
          subscription: subscription,
          userAgent: userAgent || 'Unknown',
          adminId: adminId || 'unknown',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        });

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: 'Subscription created',
            subscriptionId: newSubscription.id
          })
        };
      }
    } else if (action === 'unsubscribe') {
      // Find and remove subscription
      const existingQuery = await subscriptionsRef
        .where('endpoint', '==', subscription.endpoint)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        await existingQuery.docs[0].ref.delete();

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: 'Subscription removed'
          })
        };
      } else {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: 'Subscription not found'
          })
        };
      }
    } else {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid action. Use "subscribe" or "unsubscribe"'
        })
      };
    }

  } catch (error) {
    console.error('Error managing push subscription:', error);
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
