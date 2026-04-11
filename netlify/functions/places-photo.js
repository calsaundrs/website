// Proxy for Google Places API (New) photo media.
//
// Why this exists: the raw media URL requires the GOOGLE_PLACES_API_KEY,
// and we never want that key embedded in HTML or cached Firestore docs.
// Instead, `google-places-service.processPhotos` emits URLs of the form
// `/api/places-photo?name=places/{placeId}/photos/{photoId}` (URL-encoded),
// and this function redirects the browser to a short-lived, auth-free
// `photoUri` returned by Google.
//
// Validation: the `name` param is strictly matched against
// `places/<id>/photos/<id>` to prevent this endpoint being used to proxy
// arbitrary Google URLs.

const NAME_REGEX = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

exports.handler = async function(event) {
  try {
    const rawName = event.queryStringParameters?.name;
    if (!rawName) {
      return { statusCode: 400, body: 'Missing required query param: name' };
    }

    // Query string values arrive already URL-decoded on Netlify, but be
    // defensive in case a client double-encodes.
    let name = rawName;
    if (name.includes('%2F') || name.includes('%2f')) {
      try { name = decodeURIComponent(name); } catch (_) { /* ignore */ }
    }

    if (!NAME_REGEX.test(name)) {
      return { statusCode: 400, body: 'Invalid name parameter' };
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('places-photo: GOOGLE_PLACES_API_KEY not set');
      return { statusCode: 500, body: 'Photo service not configured' };
    }

    // Optional size params (clamped to sensible bounds)
    const clamp = (v, min, max, fallback) => {
      const n = parseInt(v, 10);
      if (Number.isNaN(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const maxWidthPx = clamp(event.queryStringParameters?.w, 64, 1600, 800);
    const maxHeightPx = clamp(event.queryStringParameters?.h, 64, 1600, 600);

    // skipHttpRedirect=true → Google returns JSON with `photoUri` instead of
    // 302-ing us straight to the CDN. We then 302 the browser ourselves so
    // the client never sees our API key.
    const mediaUrl = `https://places.googleapis.com/v1/${name}/media`
      + `?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}&skipHttpRedirect=true`;

    const resp = await fetch(mediaUrl, {
      headers: { 'X-Goog-Api-Key': apiKey },
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`places-photo: upstream ${resp.status} for ${name}: ${body}`);
      return { statusCode: resp.status, body: 'Upstream photo fetch failed' };
    }

    const data = await resp.json();
    const photoUri = data.photoUri;
    if (!photoUri) {
      console.error('places-photo: upstream returned no photoUri', data);
      return { statusCode: 502, body: 'Upstream returned no photo URI' };
    }

    return {
      statusCode: 302,
      headers: {
        Location: photoUri,
        // Cache the redirect at the edge so repeat viewers don't re-hit
        // Google. The underlying photoUri has its own cache headers.
        'Cache-Control': 'public, max-age=86400',
      },
      body: '',
    };
  } catch (error) {
    console.error('places-photo: unexpected error', error);
    return { statusCode: 500, body: 'Internal error' };
  }
};
