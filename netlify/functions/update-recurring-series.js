const RecurringEventsManager = require('./services/recurring-events-manager');

// Bulk-update every future instance of a recurring series with the
// shared fields (name, description, venue, category). Previously
// imported './services/series-manager' and './services/event-service'
// (neither exists) and called methods that don't match any current
// service — every call returned 500. This rewires to
// RecurringEventsManager.updateRecurringSeries.
//
// Limitation: changing the recurrence pattern itself (cadence, end
// date, max instances) is NOT handled here. RecurringEventsManager
// updates existing instances in-place; regenerating a different
// schedule is a separate flow that doesn't have a service yet.
// The endpoint accepts but ignores `instancesAhead`, `endDate`, and
// `recurringInfo` and reports that in the response message so the
// admin UI can surface it. Filing a follow-up issue to land the
// regeneration path properly.

const manager = new RecurringEventsManager();

const UPDATABLE_FIELDS = ['name', 'description', 'category', 'venue', 'venueId', 'venueName'];

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

  const recurringGroupId = payload.seriesId || payload.recurringGroupId;
  if (!recurringGroupId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Series ID is required' }),
    };
  }

  // Build the updates object from the allow-listed fields. Skip blanks
  // so a missing field doesn't clobber existing data.
  const updates = {};
  for (const key of UPDATABLE_FIELDS) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
      updates[key] = payload[key];
    }
  }

  // If categories arrived as the legacy plural key, fold it in.
  if (payload.categories && Array.isArray(payload.categories) && !updates.category) {
    updates.category = payload.categories;
  }

  if (Object.keys(updates).length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No updatable fields provided' }),
    };
  }

  // Surface what we ignored so the admin UI can flag it. Recurrence-
  // pattern changes still require deleting and recreating the series
  // until the regeneration flow lands.
  const ignored = ['instancesAhead', 'endDate', 'recurringInfo'].filter(
    (k) => payload[k] !== undefined
  );

  try {
    const result = await manager.updateRecurringSeries(recurringGroupId, updates);
    let message = result.message || `Updated ${result.updatedInstances} future instances`;
    if (ignored.length) {
      message += ` (ignored: ${ignored.join(', ')} — recurrence pattern changes require ending the series and creating a new one)`;
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        updatedInstances: result.updatedInstances,
        ignoredFields: ignored,
        message,
      }),
    };
  } catch (error) {
    console.error('update-recurring-series error:', error);
    const isNotFound = /no future instances/i.test(error.message);
    return {
      statusCode: isNotFound ? 404 : 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to update recurring series',
        details: error.message,
      }),
    };
  }
};
