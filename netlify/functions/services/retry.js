/**
 * Retry helper for transient failures (Firestore, Google Places API, etc.)
 * Uses exponential backoff to reduce 5xx errors from cold starts and timeouts.
 */
async function withRetry(fn, { retries = 2, delay = 500, label = 'operation' } = {}) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt <= retries) {
        console.warn(`⚠️ ${label} failed (attempt ${attempt}/${retries + 1}), retrying in ${delay}ms...`, error.message);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
}

module.exports = { withRetry };
