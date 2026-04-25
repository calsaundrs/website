/**
 * @jest-environment node
 */

const { handler } = require('../../netlify/functions/get-email-template-preview');

async function call(method, opts = {}) {
  return handler({
    httpMethod: method,
    body: opts.body ? JSON.stringify(opts.body) : null,
    queryStringParameters: opts.query || null,
  });
}

describe('get-email-template-preview', () => {
  test('returns 200 OK on OPTIONS preflight', async () => {
    const r = await call('OPTIONS');
    expect(r.statusCode).toBe(200);
  });

  test('400 when templateType is missing on GET', async () => {
    const r = await call('GET', { query: {} });
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).error).toMatch(/templateType is required/i);
  });

  test('400 when templateType is invalid', async () => {
    const r = await call('GET', { query: { templateType: 'nope' } });
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).error).toMatch(/Invalid templateType/i);
  });

  test('GET with templateType renders defaults', async () => {
    const r = await call('GET', { query: { templateType: 'submission_confirmation' } });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.success).toBe(true);
    expect(body.subject).toMatch(/Submission received/);
    expect(body.htmlContent).toContain('Pride Night at The Village Inn');
    expect(body.sampleData.eventName).toBe('Pride Night at The Village Inn');
  });

  test('POST with data overrides applies them to the rendered template', async () => {
    const r = await call('POST', {
      body: {
        templateType: 'submission_confirmation',
        data: { eventName: "Cal's Drag Brunch", eventId: 'custom-id-42' },
      },
    });
    const body = JSON.parse(r.body);
    expect(body.subject).toContain("Cal's Drag Brunch");
    expect(body.htmlContent).toContain('custom-id-42');
    expect(body.htmlContent).not.toContain('<script>');
    expect(body.htmlContent).toMatch(/Cal&#0?39;s Drag Brunch/);
  });

  test('approval_notification: optional extras toggle on/off', async () => {
    const without = JSON.parse((await call('POST', {
      body: {
        templateType: 'approval_notification',
        data: { eventName: 'Bare Approval' },
      },
    })).body);

    const withExtras = JSON.parse((await call('POST', {
      body: {
        templateType: 'approval_notification',
        data: {
          eventName: 'Approval With Extras',
          image: 'https://example.com/poster.jpg',
          eventDate: '2026-06-15',
          eventTime: '20:00',
          venueName: 'Eden Bar',
        },
      },
    })).body);

    expect(without.htmlContent).not.toContain('Eden Bar');
    expect(without.htmlContent).not.toContain('https://example.com/poster.jpg');
    expect(withExtras.htmlContent).toContain('Eden Bar');
    expect(withExtras.htmlContent).toContain('https://example.com/poster.jpg');
  });

  test('rejection_notification: resubmitUrl absent vs. present', async () => {
    const without = JSON.parse((await call('POST', {
      body: { templateType: 'rejection_notification', data: { reason: 'Plain' } },
    })).body);
    const withUrl = JSON.parse((await call('POST', {
      body: {
        templateType: 'rejection_notification',
        data: { reason: 'With link', resubmitUrl: 'https://example.com/?resubmit=tok' },
      },
    })).body);

    expect(without.htmlContent).not.toContain('?resubmit=tok');
    expect(withUrl.htmlContent).toContain('?resubmit=tok');
  });

  test('admin_submission_alert: empty promoterEmail renders the anonymous fallback', async () => {
    const anon = JSON.parse((await call('POST', {
      body: { templateType: 'admin_submission_alert', data: { promoterEmail: '' } },
    })).body);
    const named = JSON.parse((await call('POST', {
      body: { templateType: 'admin_submission_alert', data: { promoterEmail: 'foo@bar.com' } },
    })).body);

    expect(anon.htmlContent).toContain('anonymous submitter');
    expect(named.htmlContent).toContain('foo@bar.com');
  });

  test('GET still works for back-compat (legacy showcase callers)', async () => {
    const r = await call('GET', { query: { templateType: 'event_reminder' } });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).success).toBe(true);
  });
});
