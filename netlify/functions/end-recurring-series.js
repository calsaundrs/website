const RecurringEventsManager = require('./services/recurring-events-manager');

// Marks every future instance of a recurring series as cancelled.
// Previously imported './services/series-manager' and './services/event-service',
// neither of which exists in netlify/functions/services/ — every call
// returned 500 and the admin "End series" button silently failed for
// months. This rewires the existing RecurringEventsManager.endRecurringSeries.

const manager = new RecurringEventsManager();

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Admin UI calls it "seriesId"; Firestore field is "recurringGroupId".
  // Accept either name in the request body.
  const recurringGroupId = payload.seriesId || payload.recurringGroupId;
  if (!recurringGroupId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Series ID is required' }),
    };
  }

  try {
    const result = await manager.endRecurringSeries(recurringGroupId);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        endedInstances: result.endedInstances,
        message: result.message || `Successfully ended ${result.endedInstances} future instances`,
      }),
    };
  } catch (error) {
    console.error('end-recurring-series error:', error);
    const isNotFound = /no future instances/i.test(error.message);
    return {
      statusCode: isNotFound ? 404 : 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to end recurring series',
        details: error.message,
      }),
    };
  }
};
