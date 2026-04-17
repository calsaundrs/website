/**
 * Token-gated fetch for the rejection-email resubmit flow.
 *
 * GET /.netlify/functions/get-submission-for-resubmit?token=<t>
 *
 * The token (minted by utils/resubmit-token.sign on rejection) carries
 * the Firestore doc id and expires in 14 days. No other auth is needed
 * — the token itself is the credential. Returns enough of the doc to
 * prefill the submission form.
 *
 * Deliberately returns a narrow projection — never the whole doc —
 * so a leaked response body doesn't expose audit fields like
 * approvedBy, internal flags, etc.
 */

const admin = require('firebase-admin');
const { verify } = require('./utils/resubmit-token');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    }),
  });
}

const db = admin.firestore();

// Fields the submit form legitimately needs to prefill. Everything
// outside this list stays server-side.
const PREFILL_PROJECTION = [
  'name', 'description', 'eventDate', 'eventTime', 'startTime', 'endTime',
  'price', 'ageRestriction', 'link',
  'venueId', 'venueName', 'venueAddress', 'venueSlug',
  'category',
  'promoImage', 'cloudinaryPublicId',
  'submitterEmail',
  'rejectionReason', 'rejectionHighlights',
  // status is surfaced so the UI can refuse to open a resubmit flow
  // against an already-approved event (the promoter should submit
  // a fresh one instead).
  'status',
];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    // CORS — only the site itself should be calling this from a
    // browser, but the preview domain varies so allow any.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = (event.queryStringParameters || {}).token;
  let result;
  try {
    result = verify(token);
  } catch (err) {
    // Misconfig (missing secret) — 500, not 401.
    console.error('resubmit-token misconfig:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  if (!result.ok) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid or expired link', reason: result.reason }),
    };
  }

  try {
    const doc = await db.collection('events').doc(result.docId).get();
    if (!doc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Submission not found' }) };
    }
    const data = doc.data() || {};
    // Defence in depth: refuse to prefill against an already-live event
    // server-side, not just in the UI. Stops a leaked 14-day link being
    // used to clobber an approved listing back to pending.
    const statusLower = String(data.status || '').toLowerCase();
    if (statusLower === 'approved' || statusLower === 'live') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'This event is already live. Submit a fresh one if you want to change it.',
          reason: 'already-approved',
        }),
      };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        submission: { id: doc.id, ...pick(data, PREFILL_PROJECTION) },
      }),
    };
  } catch (err) {
    console.error('get-submission-for-resubmit error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
