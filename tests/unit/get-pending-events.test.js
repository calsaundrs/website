/**
 * @jest-environment node
 */

jest.mock('firebase-admin', () => {
  const get = jest.fn();
  const limit = jest.fn(() => ({ get }));
  const where = jest.fn(() => ({ limit }));
  const collection = jest.fn(() => ({ where }));
  return {
    apps: [{ name: 'default' }],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn(() => ({})) },
    firestore: jest.fn(() => ({ collection })),
    __mocks: { collection, where, limit, get },
  };
});

const { __mocks } = require('firebase-admin');
const { handler } = require('../../netlify/functions/get-pending-events');

function fakeDoc(id, data) {
  return { id, data: () => data };
}

describe('get-pending-events handler', () => {
  beforeEach(() => {
    __mocks.get.mockReset();
  });

  test('returns success:true with an empty array when there are no pending events', async () => {
    __mocks.get.mockResolvedValueOnce({ docs: [] });
    const result = await handler({});
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.events).toEqual([]);
  });

  test('queries events where status is in the pending set, limited to 50', async () => {
    __mocks.get.mockResolvedValueOnce({ docs: [] });
    await handler({});
    expect(__mocks.collection).toHaveBeenCalledWith('events');
    const whereArgs = __mocks.where.mock.calls[0];
    expect(whereArgs[0]).toBe('status');
    expect(whereArgs[1]).toBe('in');
    expect(whereArgs[2]).toEqual(expect.arrayContaining(['Pending Review', 'pending', 'submitted']));
    expect(__mocks.limit).toHaveBeenCalledWith(50);
  });

  test('shapes events for the notification poller', async () => {
    __mocks.get.mockResolvedValueOnce({
      docs: [
        fakeDoc('e1', {
          name: 'Drag Brunch',
          date: '2026-06-01',
          venue: { name: 'Eden Bar' },
          category: ['Drag'],
          submittedBy: 'promoter@example.com',
          submitterEmail: 'promoter@example.com',
          submittedAt: '2026-04-26T08:00:00Z',
          createdAt: '2026-04-26T08:00:00Z',
          status: 'Pending Review',
        }),
      ],
    });
    const result = await handler({});
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.events[0]).toEqual({
      id: 'e1',
      name: 'Drag Brunch',
      date: '2026-06-01',
      venueName: 'Eden Bar',
      category: ['Drag'],
      submittedBy: 'promoter@example.com',
      submitterEmail: 'promoter@example.com',
      submittedAt: '2026-04-26T08:00:00Z',
      createdAt: '2026-04-26T08:00:00Z',
      status: 'Pending Review',
    });
  });

  test('falls back gracefully when venue is not nested', async () => {
    __mocks.get.mockResolvedValueOnce({
      docs: [
        fakeDoc('e2', { name: 'Karaoke', venueName: 'The Fox' }),
      ],
    });
    const body = JSON.parse((await handler({})).body);
    expect(body.events[0].venueName).toBe('The Fox');
  });

  test('uses TBC when no venue at all', async () => {
    __mocks.get.mockResolvedValueOnce({
      docs: [fakeDoc('e3', { name: 'Mystery Event' })],
    });
    const body = JSON.parse((await handler({})).body);
    expect(body.events[0].venueName).toBe('TBC');
  });

  test('sorts newest submittedAt first', async () => {
    __mocks.get.mockResolvedValueOnce({
      docs: [
        fakeDoc('old', { submittedAt: '2026-04-20T10:00:00Z' }),
        fakeDoc('new', { submittedAt: '2026-04-26T10:00:00Z' }),
        fakeDoc('mid', { submittedAt: '2026-04-23T10:00:00Z' }),
      ],
    });
    const body = JSON.parse((await handler({})).body);
    expect(body.events.map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });

  test('returns 500 with error message when Firestore throws', async () => {
    __mocks.get.mockRejectedValueOnce(new Error('Firestore unavailable'));
    const result = await handler({});
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.details).toMatch(/Firestore unavailable/);
  });
});
