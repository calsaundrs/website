/**
 * @jest-environment node
 */

const ORIGINAL_FETCH = global.fetch;

function buildAiResponse(text) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    text: async () => text,
  };
}

describe('analyze-poster handler', () => {
  let handler;

  beforeAll(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    handler = require('../../netlify/functions/analyze-poster').handler;
  });

  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterAll(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  test('rejects non-POST methods with 405', async () => {
    const result = await handler({ httpMethod: 'GET' });
    expect(result.statusCode).toBe(405);
  });

  test('returns 200 OK on OPTIONS preflight', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' });
    expect(result.statusCode).toBe(200);
  });

  test('returns 500 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await handler({ httpMethod: 'POST', body: JSON.stringify({ image: 'data:image/jpeg;base64,abc' }) });
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/missing API key/i);
  });

  test('returns 400 when body is invalid JSON', async () => {
    const result = await handler({ httpMethod: 'POST', body: 'not json' });
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/Invalid JSON/i);
  });

  test('returns 400 when image field is missing', async () => {
    const result = await handler({ httpMethod: 'POST', body: JSON.stringify({}) });
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/Image data is required/i);
  });

  test('returns 200 with extractedData on a valid AI response', async () => {
    const aiPayload = {
      eventName: 'Test Drag Brunch',
      date: '2026-06-15',
      time: '14:00',
      venue: 'The Test Venue',
      description: 'A friendly drag brunch.',
      price: '£10',
      ageRestriction: '18+',
      categories: ['Drag', 'Social'],
      confidence: 'high',
    };
    global.fetch.mockResolvedValueOnce(buildAiResponse(JSON.stringify(aiPayload)));

    const result = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ image: 'data:image/jpeg;base64,abc' }),
    });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.extractedData).toEqual(aiPayload);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
  });

  test('returns success:false when AI response is not valid JSON', async () => {
    global.fetch.mockResolvedValueOnce(buildAiResponse('this is not json'));

    const result = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ image: 'data:image/jpeg;base64,abc' }),
    });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/no data could be extracted/i);
  });

  test('returns success:false when fetch returns a non-ok response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable',
    });

    const result = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ image: 'data:image/jpeg;base64,abc' }),
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(false);
  });
});
