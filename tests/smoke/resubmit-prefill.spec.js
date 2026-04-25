const { test, expect } = require('@playwright/test');

const RESUBMIT_URL = '**/.netlify/functions/get-submission-for-resubmit**';

const SAMPLE_SUBMISSION = {
  id: 'submission-1',
  name: 'Originally Submitted Drag Brunch',
  description: 'The original description.',
  eventDate: '2026-09-01',
  eventTime: '14:00',
  endTime: '17:00',
  price: '£12',
  ageRestriction: '18+',
  link: 'https://example.com/brunch',
  submitterEmail: 'promoter@example.com',
  venueId: 'venue-1',
  venueName: 'Eden Bar',
  category: ['Drag', 'Social'],
  status: 'rejected',
  rejectionReason: 'The description was too short — please flesh it out.',
};

test.describe('Resubmit prefill (?resubmit=token)', () => {
  test('prefills the form, sets the hidden token, and shows the rejection banner', async ({ page }) => {
    let captured = null;
    await page.route(RESUBMIT_URL, async (route) => {
      captured = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, submission: SAMPLE_SUBMISSION }),
      });
    });

    await page.goto('/promoter-submit-new?resubmit=test-token-123', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('#resubmit-banner')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resubmit-banner-event')).toContainText(/Originally Submitted Drag Brunch/);
    await expect(page.locator('#resubmit-banner-reason')).toContainText(/description was too short/i);

    await expect(page.locator('#event-name')).toHaveValue('Originally Submitted Drag Brunch');
    await expect(page.locator('#description')).toHaveValue('The original description.');
    await expect(page.locator('#date')).toHaveValue('2026-09-01');
    await expect(page.locator('#start-time')).toHaveValue('14:00');
    await expect(page.locator('#end-time')).toHaveValue('17:00');
    await expect(page.locator('#price')).toHaveValue('£12');
    await expect(page.locator('#contact-email')).toHaveValue('promoter@example.com');

    await expect(page.locator('#venue-id')).toHaveValue('venue-1');
    await expect(page.locator('#venue-search')).toHaveValue('Eden Bar');

    await expect(page.locator('input[name="categories"][value="Drag"]')).toBeChecked();
    await expect(page.locator('input[name="categories"][value="Social"]')).toBeChecked();

    await expect(page.locator('#resubmit-token')).toHaveValue('test-token-123');

    expect(captured).toContain('token=test-token-123');
  });

  test('shows the error box when the token is invalid', async ({ page }) => {
    await page.route(RESUBMIT_URL, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Invalid or expired token.' }),
      });
    });

    await page.goto('/promoter-submit-new?resubmit=invalid-token', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('#resubmit-error')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resubmit-error-msg')).toContainText(/invalid or expired/i);
    await expect(page.locator('#resubmit-banner')).toBeHidden();

    await expect(page.locator('#event-name')).toHaveValue('');
  });

  test('shows the error box when the submission is already approved', async ({ page }) => {
    await page.route(RESUBMIT_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          submission: { ...SAMPLE_SUBMISSION, status: 'approved' },
        }),
      });
    });

    await page.goto('/promoter-submit-new?resubmit=token', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('#resubmit-error')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resubmit-error-msg')).toContainText(/already live/i);
    await expect(page.locator('#event-name')).toHaveValue('');
  });

  test('does nothing without a resubmit query param', async ({ page }) => {
    let called = false;
    await page.route(RESUBMIT_URL, async (route) => {
      called = true;
      await route.fulfill({ status: 200, body: '{}' });
    });

    await page.goto('/promoter-submit-new.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    expect(called).toBe(false);
    await expect(page.locator('#resubmit-banner')).toBeHidden();
    await expect(page.locator('#resubmit-error')).toBeHidden();
  });
});
