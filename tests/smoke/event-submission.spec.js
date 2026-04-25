const { test, expect } = require('@playwright/test');

const FUNCTION_URL = '**/.netlify/functions/event-submission';

function futureDate(daysAhead = 30) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

test.describe('Event submission end-to-end', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/promoter-submit-new.html', { waitUntil: 'domcontentloaded' });
  });

  test('submits a valid event and shows the success toast', async ({ page }) => {
    let capturedPayload = null;

    await page.route(FUNCTION_URL, async (route) => {
      const request = route.request();
      capturedPayload = {
        method: request.method(),
        contentType: request.headers()['content-type'] || '',
        bodySize: (request.postData() || '').length,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Event submitted', id: 'test-event-id' }),
      });
    });

    await page.fill('#event-name', 'Playwright Smoke Drag Brunch');
    await page.fill('#description', 'A scheduled smoke-test event submitted from a Playwright run.');
    await page.fill('#date', futureDate(30));
    await page.fill('#start-time', '19:30');
    await page.fill('#contact-name', 'Test Promoter');
    await page.fill('#contact-email', 'test-promoter@example.com');

    await page.locator('input[name="categories"]').first().check();

    await page.locator('#add-new-venue').click();
    await expect(page.locator('#new-venue-form')).toBeVisible();
    await page.fill('#new-venue-name', 'Playwright Test Venue');
    await page.fill('#new-venue-address', '1 Test Street, Birmingham');
    await page.fill('#new-venue-postcode', 'B1 1AA');

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/Event submitted successfully/i)).toBeVisible({ timeout: 10000 });

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.method).toBe('POST');
    expect(capturedPayload.contentType).toContain('multipart/form-data');
    expect(capturedPayload.bodySize).toBeGreaterThan(0);
  });

  test('shows an error toast when no category is selected', async ({ page }) => {
    let functionCalled = false;
    await page.route(FUNCTION_URL, async (route) => {
      functionCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.fill('#event-name', 'Should Not Submit');
    await page.fill('#description', 'Validation should block this submission.');
    await page.fill('#date', futureDate(30));
    await page.fill('#start-time', '20:00');
    await page.fill('#contact-name', 'Test');
    await page.fill('#contact-email', 'test@example.com');

    await page.locator('#add-new-venue').click();
    await page.fill('#new-venue-name', 'Test Venue');

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/select at least one category/i)).toBeVisible({ timeout: 5000 });
    expect(functionCalled).toBe(false);
  });

  test('shows an error toast when no venue is selected', async ({ page }) => {
    let functionCalled = false;
    await page.route(FUNCTION_URL, async (route) => {
      functionCalled = true;
      await route.fulfill({ status: 200, body: '{}' });
    });

    await page.fill('#event-name', 'Should Not Submit');
    await page.fill('#description', 'Validation should block this submission.');
    await page.fill('#date', futureDate(30));
    await page.fill('#start-time', '20:00');
    await page.fill('#contact-name', 'Test');
    await page.fill('#contact-email', 'test@example.com');
    await page.locator('input[name="categories"]').first().check();

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/please select a venue/i)).toBeVisible({ timeout: 5000 });
    expect(functionCalled).toBe(false);
  });

  test('shows an error toast when the server returns 500', async ({ page }) => {
    await page.route(FUNCTION_URL, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal error' }),
      });
    });

    await page.fill('#event-name', 'Server Error Path');
    await page.fill('#description', 'Server returns 500.');
    await page.fill('#date', futureDate(30));
    await page.fill('#start-time', '21:00');
    await page.fill('#contact-name', 'Test');
    await page.fill('#contact-email', 'test@example.com');
    await page.locator('input[name="categories"]').first().check();
    await page.locator('#add-new-venue').click();
    await page.fill('#new-venue-name', 'Test Venue');

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/Submission failed/i)).toBeVisible({ timeout: 10000 });
  });
});
