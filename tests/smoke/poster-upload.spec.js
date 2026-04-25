const { test, expect } = require('@playwright/test');

const ANALYZE_URL = '**/.netlify/functions/analyze-poster';

// 1×1 transparent PNG, smallest valid PNG payload.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',
  'base64'
);

const FAKE_AI_RESPONSE = {
  eventName: 'Parsed Drag Brunch',
  date: '2026-08-15',
  time: '13:30',
  venue: 'Eden Bar',
  description: 'A poster-parsed drag brunch.',
  price: '£15',
  ageRestriction: '18+',
  categories: ['Drag'],
  confidence: 'high',
};

test.describe('Poster upload + AI parse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/promoter-submit-new.html', { waitUntil: 'domcontentloaded' });
  });

  test('uploading a poster sends base64 to analyze-poster and shows the extracted-data preview', async ({ page }) => {
    let requestPayload = null;
    await page.route(ANALYZE_URL, async (route) => {
      const data = JSON.parse(route.request().postData() || '{}');
      requestPayload = data;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, extractedData: FAKE_AI_RESPONSE }),
      });
    });

    await page.locator('#poster-upload').setInputFiles({
      name: 'poster.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    await expect(page.locator('#extracted-data')).toBeVisible({ timeout: 10000 });

    expect(requestPayload).not.toBeNull();
    expect(typeof requestPayload.image).toBe('string');
    expect(requestPayload.image.startsWith('data:image/png;base64,')).toBe(true);

    await expect(page.locator('#extracted-fields')).toContainText('Parsed Drag Brunch');
    await expect(page.locator('#extracted-fields')).toContainText('Eden Bar');
  });

  test('clicking "Use this data" populates the form fields', async ({ page }) => {
    await page.route(ANALYZE_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, extractedData: FAKE_AI_RESPONSE }),
      });
    });

    await page.locator('#poster-upload').setInputFiles({
      name: 'poster.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    await expect(page.locator('#extracted-data')).toBeVisible({ timeout: 10000 });
    await page.locator('#use-extracted').click();

    await expect(page.locator('#event-name')).toHaveValue('Parsed Drag Brunch');
    await expect(page.locator('#description')).toHaveValue('A poster-parsed drag brunch.');
    await expect(page.locator('#date')).toHaveValue('2026-08-15');
    await expect(page.locator('#start-time')).toHaveValue('13:30');

    await expect(page.locator('#extracted-data')).toBeHidden();
  });

  test('clicking "Ignore" hides the preview and discards the extracted data', async ({ page }) => {
    await page.route(ANALYZE_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, extractedData: FAKE_AI_RESPONSE }),
      });
    });

    await page.locator('#poster-upload').setInputFiles({
      name: 'poster.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    await expect(page.locator('#extracted-data')).toBeVisible({ timeout: 10000 });
    await page.locator('#ignore-extracted').click();

    await expect(page.locator('#extracted-data')).toBeHidden();
    await expect(page.locator('#event-name')).toHaveValue('');
  });

  test('AI returning success:false does not show the preview', async ({ page }) => {
    await page.route(ANALYZE_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'no data extracted' }),
      });
    });

    await page.locator('#poster-upload').setInputFiles({
      name: 'poster.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    await expect(page.locator('#ai-processing')).toBeHidden({ timeout: 10000 });
    await expect(page.locator('#extracted-data')).toBeHidden();
  });
});
