const { test, expect } = require('@playwright/test');

const FUNCTION_URL = '**/.netlify/functions/venue-submission';

test.describe('Venue submission via /get-listed.html', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/get-listed.html', { waitUntil: 'domcontentloaded' });
  });

  test('form has all expected fields', async ({ page }) => {
    await expect(page.locator('#venue-form')).toBeVisible();
    await expect(page.locator('#venue-name')).toBeVisible();
    await expect(page.locator('#address')).toBeVisible();
    await expect(page.locator('#description')).toBeVisible();
    await expect(page.locator('#contact-email')).toBeVisible();
    await expect(page.locator('#photo')).toBeAttached();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('submits the venue with the expected multipart payload', async ({ page }) => {
    let captured = null;
    await page.route(FUNCTION_URL, async (route) => {
      const request = route.request();
      captured = {
        method: request.method(),
        contentType: request.headers()['content-type'] || '',
        body: request.postData() || '',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Venue submitted successfully',
          venueId: 'test-venue-id',
        }),
      });
    });

    await page.fill('#venue-name', 'Playwright Test Venue');
    await page.fill('#address', '1 Test Street, Birmingham, B1 1AA');
    await page.fill('#description', 'A friendly smoke-test venue.');
    await page.fill('#contact-email', 'venue-test@example.com');

    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/venue-submission/, { timeout: 10000 });

    expect(captured).not.toBeNull();
    expect(captured.method).toBe('POST');
    expect(captured.contentType).toContain('multipart/form-data');
    expect(captured.body).toContain('venue-name');
    expect(captured.body).toContain('Playwright Test Venue');
    expect(captured.body).toContain('address');
    expect(captured.body).toContain('contact-email');
    expect(captured.body).toContain('venue-test@example.com');

    await expect(page.locator('body')).toContainText('"success":true');
  });

  test('HTML5 validation blocks submit when venue-name is empty', async ({ page }) => {
    let functionCalled = false;
    await page.route(FUNCTION_URL, async (route) => {
      functionCalled = true;
      await route.fulfill({ status: 200, body: '{}' });
    });

    await page.fill('#address', '1 Test Street');
    await page.fill('#contact-email', 'venue-test@example.com');

    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(500);

    expect(functionCalled).toBe(false);
    expect(page.url()).toContain('/get-listed.html');

    const validity = await page.locator('#venue-name').evaluate((el) => el.validity.valueMissing);
    expect(validity).toBe(true);
  });
});
