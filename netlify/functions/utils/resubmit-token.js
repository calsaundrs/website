/**
 * Signed resubmit tokens for the rejection-email resubmit flow.
 *
 * Token format: base64url(payload).base64url(hmac)
 *   payload = JSON { sub: <docId>, exp: <unix-seconds>, kind: "resubmit" }
 *   hmac    = HMAC-SHA256(payload, RESUBMIT_TOKEN_SECRET)
 *
 * The token is the only credential the recipient has. It binds them to
 * one specific submission doc for a bounded window (14 days by default)
 * — long enough for a promoter to come back and fix something, short
 * enough that a leaked email doesn't grant indefinite edit access.
 *
 * Stateless: nothing is stored server-side. Verification is pure HMAC
 * check + expiry check.
 */

const crypto = require('crypto');

const DEFAULT_TTL_DAYS = 14;
const KIND = 'resubmit';

function getSecret() {
  const secret = process.env.RESUBMIT_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('RESUBMIT_TOKEN_SECRET is missing or too short (need ≥32 chars)');
  }
  return secret;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/**
 * Mint a signed resubmit token for a given Firestore doc id.
 * @param {string} docId   — the events/{docId} being resubmitted
 * @param {object} [opts]  — { ttlDays }
 */
function sign(docId, opts = {}) {
  if (!docId || typeof docId !== 'string') {
    throw new Error('sign: docId required');
  }
  const ttlDays = opts.ttlDays || DEFAULT_TTL_DAYS;
  const payload = {
    sub: docId,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60,
    kind: KIND,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const hmac = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${b64url(hmac)}`;
}

/**
 * Verify a token. Returns { ok, docId } on success, { ok: false, reason }
 * on any failure. Never throws for tamper — reserves throws for misconfig
 * (missing secret) so callers can surface a distinct 500 vs 401.
 */
function verify(token) {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing token' };
  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return { ok: false, reason: 'malformed token' };

  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  let expected;
  try {
    expected = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest();
  } catch (err) {
    // Propagate config error up — not a client problem.
    throw err;
  }

  const got = b64urlDecode(sigB64);
  // Length mismatch short-circuits before timingSafeEqual (which throws
  // on length mismatch).
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
    return { ok: false, reason: 'bad signature' };
  }

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed payload' };
  }

  if (payload.kind !== KIND) return { ok: false, reason: 'wrong token kind' };
  if (!payload.sub || typeof payload.sub !== 'string') return { ok: false, reason: 'missing sub' };
  if (typeof payload.exp !== 'number') return { ok: false, reason: 'missing exp' };
  if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'token expired' };

  return { ok: true, docId: payload.sub, exp: payload.exp };
}

module.exports = { sign, verify };
