const { test, expect } = require('../fixtures/auth');

const PREVIEW_URL = '**/.netlify/functions/get-email-template-preview';

const TEMPLATES = [
  'submission_confirmation',
  'approval_notification',
  'rejection_notification',
  'event_reminder',
  'admin_submission_alert',
];

test.describe('Email template preview tool', () => {
  test('renders five template cards and each requests its preview', async ({ adminPage }) => {
    const calls = [];
    await adminPage.route(PREVIEW_URL, async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      calls.push(body.templateType);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          templateType: body.templateType,
          subject: `Stub subject — ${body.templateType}`,
          htmlContent: `<html><body><h1>${body.templateType}</h1></body></html>`,
          textContent: 'stub',
          sampleData: body.data || {},
        }),
      });
    });

    await adminPage.goto('/email-template-showcase.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    const sections = adminPage.locator('#previews > section');
    await expect(sections).toHaveCount(5, { timeout: 10000 });

    await expect.poll(() => calls.length, { timeout: 10000 }).toBeGreaterThanOrEqual(5);
    for (const t of TEMPLATES) {
      expect(calls).toContain(t);
    }
  });

  test('toggling a control re-fetches the preview with updated data', async ({ adminPage }) => {
    const requests = [];
    await adminPage.route(PREVIEW_URL, async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      requests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          templateType: body.templateType,
          subject: `Stub — ${body.templateType}`,
          htmlContent: `<html><body>${body.templateType}</body></html>`,
          textContent: '',
          sampleData: body.data || {},
        }),
      });
    });

    await adminPage.goto('/email-template-showcase.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    await expect.poll(() => requests.length).toBeGreaterThanOrEqual(5);
    const before = requests.length;

    await adminPage
      .locator('input[type="checkbox"][data-key="venueName"]')
      .first()
      .check();

    await expect.poll(() => requests.length, { timeout: 5000 }).toBeGreaterThan(before);

    const approvalCalls = requests.filter((r) => r.templateType === 'approval_notification');
    const lastApproval = approvalCalls[approvalCalls.length - 1];
    expect(lastApproval.data).toBeDefined();
    expect(lastApproval.data.venueName).toBeTruthy();
  });
});
