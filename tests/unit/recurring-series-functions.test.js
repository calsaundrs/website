/**
 * @jest-environment node
 */

const mockEndRecurring = jest.fn();
const mockUpdateRecurring = jest.fn();

jest.mock('../../netlify/functions/services/recurring-events-manager', () =>
  jest.fn().mockImplementation(() => ({
    endRecurringSeries: mockEndRecurring,
    updateRecurringSeries: mockUpdateRecurring,
  }))
);

const { handler: endHandler } = require('../../netlify/functions/end-recurring-series');
const { handler: updateHandler } = require('../../netlify/functions/update-recurring-series');

function call(handler, body, method = 'POST') {
  return handler({
    httpMethod: method,
    body: body == null ? null : JSON.stringify(body),
  });
}

describe('end-recurring-series handler', () => {
  beforeEach(() => mockEndRecurring.mockReset());

  test('200 OK on OPTIONS preflight', async () => {
    const r = await call(endHandler, null, 'OPTIONS');
    expect(r.statusCode).toBe(200);
  });

  test('405 on non-POST', async () => {
    const r = await call(endHandler, null, 'GET');
    expect(r.statusCode).toBe(405);
  });

  test('400 when seriesId is missing', async () => {
    const r = await call(endHandler, {});
    expect(r.statusCode).toBe(400);
  });

  test('200 + manager called with the recurringGroupId', async () => {
    mockEndRecurring.mockResolvedValueOnce({ endedInstances: 5, message: 'ended 5' });
    const r = await call(endHandler, { seriesId: 'series-abc' });
    expect(mockEndRecurring).toHaveBeenCalledWith('series-abc');
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.success).toBe(true);
    expect(body.endedInstances).toBe(5);
  });

  test('also accepts the canonical recurringGroupId field name', async () => {
    mockEndRecurring.mockResolvedValueOnce({ endedInstances: 1, message: '' });
    await call(endHandler, { recurringGroupId: 'group-xyz' });
    expect(mockEndRecurring).toHaveBeenCalledWith('group-xyz');
  });

  test('404 when there are no future instances', async () => {
    mockEndRecurring.mockRejectedValueOnce(new Error('No future instances found for this series'));
    const r = await call(endHandler, { seriesId: 'gone' });
    expect(r.statusCode).toBe(404);
  });

  test('500 on unexpected manager error', async () => {
    mockEndRecurring.mockRejectedValueOnce(new Error('Firestore unavailable'));
    const r = await call(endHandler, { seriesId: 'broken' });
    expect(r.statusCode).toBe(500);
    expect(JSON.parse(r.body).details).toMatch(/Firestore unavailable/);
  });
});

describe('update-recurring-series handler', () => {
  beforeEach(() => mockUpdateRecurring.mockReset());

  test('400 when seriesId is missing', async () => {
    const r = await call(updateHandler, { name: 'New Name' });
    expect(r.statusCode).toBe(400);
  });

  test('400 when no updatable fields are provided', async () => {
    const r = await call(updateHandler, { seriesId: 'abc' });
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).error).toMatch(/No updatable fields/);
  });

  test('updates the allow-listed fields and ignores the rest', async () => {
    mockUpdateRecurring.mockResolvedValueOnce({ updatedInstances: 4, message: '' });
    await call(updateHandler, {
      seriesId: 'series-1',
      name: 'New Name',
      description: 'New desc',
      category: ['Drag'],
      venueId: 'v-1',
      randomGarbage: 'should be dropped',
    });
    expect(mockUpdateRecurring).toHaveBeenCalledWith('series-1', {
      name: 'New Name',
      description: 'New desc',
      category: ['Drag'],
      venueId: 'v-1',
    });
  });

  test('folds the legacy "categories" key into "category"', async () => {
    mockUpdateRecurring.mockResolvedValueOnce({ updatedInstances: 2, message: '' });
    await call(updateHandler, {
      seriesId: 's',
      categories: ['Quiz', 'Social'],
    });
    expect(mockUpdateRecurring.mock.calls[0][1]).toEqual({ category: ['Quiz', 'Social'] });
  });

  test('skips blank values rather than clobbering existing data', async () => {
    mockUpdateRecurring.mockResolvedValueOnce({ updatedInstances: 3, message: '' });
    await call(updateHandler, {
      seriesId: 's',
      name: 'Real Update',
      description: '',
      venueId: null,
    });
    expect(mockUpdateRecurring.mock.calls[0][1]).toEqual({ name: 'Real Update' });
  });

  test('reports ignoredFields when recurrence-pattern fields are sent', async () => {
    mockUpdateRecurring.mockResolvedValueOnce({ updatedInstances: 6, message: '' });
    const r = await call(updateHandler, {
      seriesId: 's',
      name: 'X',
      instancesAhead: 12,
      endDate: '2026-12-31',
      recurringInfo: { pattern: 'weekly' },
    });
    const body = JSON.parse(r.body);
    expect(body.ignoredFields).toEqual(expect.arrayContaining(['instancesAhead', 'endDate', 'recurringInfo']));
    expect(body.message).toMatch(/ignored:.*instancesAhead/);
  });
});
