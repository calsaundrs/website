const { test, expect } = require('@playwright/test');

const FUNCTION_URL = '**/.netlify/functions/event-submission';

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

async function fillBaseFields(page, { name, daysAhead = 30 } = {}) {
  await page.fill('#event-name', name || 'Recurring Test Event');
  await page.fill('#description', 'Smoke test for recurring submission.');
  await page.fill('#date', futureDate(daysAhead));
  await page.fill('#start-time', '20:00');
  await page.fill('#contact-name', 'Test Promoter');
  await page.fill('#contact-email', 'test-promoter@example.com');
  await page.locator('input[name="categories"]').first().check();
  await page.locator('#add-new-venue').click();
  await page.fill('#new-venue-name', 'Recurring Test Venue');
}

test.describe('Recurring event submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/promoter-submit-new.html', { waitUntil: 'domcontentloaded' });
  });

  test('toggling recurring reveals the recurring config block', async ({ page }) => {
    const config = page.locator('#recurring-config');
    await expect(config).toBeHidden();
    await page.locator('#is-recurring').check();
    await expect(config).toBeVisible();
  });

  test('weekly recurring submission sends the recurring fields', async ({ page }) => {
    let body = null;
    await page.route(FUNCTION_URL, async (route) => {
      body = route.request().postData() || '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Recurring series created' }),
      });
    });

    await fillBaseFields(page);
    await page.locator('#is-recurring').check();
    await page.locator('input[name="recurring-pattern"][value="weekly"]').check();
    await page.fill('#recurring-start-date', futureDate(30));
    await page.fill('#recurring-end-date', futureDate(60));
    await page.fill('#max-instances', '5');

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/Event submitted successfully/i)).toBeVisible({ timeout: 10000 });

    expect(body).toContain('is-recurring');
    expect(body).toContain('recurring-pattern');
    expect(body).toContain('weekly');
    expect(body).toContain('recurring-start-date');
    expect(body).toContain('recurring-end-date');
    expect(body).toContain('max-instances');
  });

  test('shows a validation error when no recurrence pattern is selected', async ({ page }) => {
    let functionCalled = false;
    await page.route(FUNCTION_URL, async (route) => {
      functionCalled = true;
      await route.fulfill({ status: 200, body: '{}' });
    });

    await fillBaseFields(page);
    await page.locator('#is-recurring').check();
    await page.fill('#recurring-start-date', futureDate(30));

    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/select a recurrence pattern/i)).toBeVisible({ timeout: 5000 });
    expect(functionCalled).toBe(false);
  });

  test('toggling is-recurring auto-fills recurring-start-date from the main event date', async ({ page }) => {
    const date = futureDate(30);
    await page.fill('#date', date);

    const beforeToggle = await page.locator('#recurring-start-date').inputValue();
    expect(beforeToggle).toBe('');

    await page.locator('#is-recurring').check();

    await expect.poll(() => page.locator('#recurring-start-date').inputValue()).toBe(date);
  });
});
