const admin = require('firebase-admin');
const EmailService = require('./services/email-service');

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
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
    const emailService = new EmailService();

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log('🔍 Looking for events happening tomorrow:', tomorrowStr);

    // Query events happening tomorrow
    const eventsSnapshot = await db.collection('events')
      .where('eventDate', '==', tomorrowStr)
      .where('status', '==', 'approved')
      .get();

    if (eventsSnapshot.empty) {
      console.log('📅 No events found for tomorrow');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No events found for tomorrow',
          eventsProcessed: 0
        })
      };
    }

    console.log(`📧 Found ${eventsSnapshot.size} events for tomorrow`);

    const results = await Promise.all(eventsSnapshot.docs.map(async (doc) => {
      const eventData = doc.data();
      const promoterEmail = eventData.submittedBy || eventData.submitterEmail;

      if (!promoterEmail || promoterEmail === 'anonymous@brumoutloud.co.uk') {
        console.log(`⚠️ No valid email for event: ${eventData.name}`);
        return {
          eventId: doc.id,
          eventName: eventData.name,
          status: 'skipped',
          reason: 'No valid promoter email'
        };
      }

      try {
        const eventUrl = `https://brumoutloud.co.uk/event/${eventData.slug}.html`;
        const eventDate = `${eventData.eventDate} at ${eventData.eventTime || 'TBD'}`;

        const emailResult = await emailService.sendEventReminder(
          promoterEmail,
          eventData.name,
          eventDate,
          eventUrl
        );

        if (emailResult.success) {
          console.log(`✅ Reminder sent for: ${eventData.name}`);
          return {
            eventId: doc.id,
            eventName: eventData.name,
            promoterEmail: promoterEmail,
            status: 'sent',
            messageId: emailResult.messageId
          };
        } else {
          console.error(`❌ Failed to send reminder for: ${eventData.name}`, emailResult.error);
          return {
            eventId: doc.id,
            eventName: eventData.name,
            promoterEmail: promoterEmail,
            status: 'failed',
            error: emailResult.error
          };
        }

      } catch (error) {
        console.error(`❌ Error processing event ${eventData.name}:`, error);
        return {
          eventId: doc.id,
          eventName: eventData.name,
          promoterEmail: promoterEmail,
          status: 'error',
          error: error.message
        };
      }
    }));

    const successCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed' || r.status === 'error').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log(`📊 Reminder summary: ${successCount} sent, ${failedCount} failed, ${skippedCount} skipped`);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: `Processed ${eventsSnapshot.size} events`,
        summary: {
          total: eventsSnapshot.size,
          sent: successCount,
          failed: failedCount,
          skipped: skippedCount
        },
        results: results
      })
    };

  } catch (error) {
    console.error('❌ Event reminder processing failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
