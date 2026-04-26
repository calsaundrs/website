const admin = require('firebase-admin');

// Lightweight pending-events endpoint used by js/admin-notification-poller.js
// to drive new-submission push notifications. Replaces an older version
// that required a non-existent ./services/event-service module and so
// returned 500 on every invocation — the cause of a chunk of the 5xx
// errors in GSC and the silent failure of admin push notifications.
//
// The richer admin-approvals UI uses get-pending-items-firestore (which
// returns events + venues + pagination); this endpoint stays narrow:
// just the events the poller cares about, in the shape it expects
// ({ success: true, events: [...] }).

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
    }),
  });
}

const db = admin.firestore();

const PENDING_STATUSES = ['Pending Review', 'pending', 'pending review', 'submitted'];

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
  };

  try {
    const snapshot = await db.collection('events')
      .where('status', 'in', PENDING_STATUSES)
      .limit(50)
      .get();

    const events = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name: data.name,
        date: data.date,
        venueName: data.venue?.name || data.venueName || 'TBC',
        category: data.category || [],
        submittedBy: data.submittedBy,
        submitterEmail: data.submitterEmail,
        submittedAt: data.submittedAt || data.createdAt,
        createdAt: data.createdAt,
        status: data.status,
      };
    });

    events.sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, events }),
    };
  } catch (error) {
    console.error('get-pending-events error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch pending events',
        details: error.message,
      }),
    };
  }
};
