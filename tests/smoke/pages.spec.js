const { test, expect } = require('@playwright/test');

test.describe('Page Load Smoke Tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Brum\s*Out\s*loud/i);
    // Wait for FOUC prevention to finish (adds 'loaded' class to body)
    await page.waitForFunction(() => document.body.classList.contains('loaded'), { timeout: 5000 }).catch(() => {});
    await expect(page.locator('nav')).toBeVisible({ timeout: 5000 });
  });

  test('events page loads', async ({ page }) => {
    const response = await page.goto('/events.html', { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBeLessThan(400);
    await expect(page.locator('body')).toContainText(/event/i);
  });

  test('venues page loads', async ({ page }) => {
    const response = await page.goto('/all-venues.html', { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBeLessThan(400);
  });

  test('event submission form page loads', async ({ page }) => {
    await page.goto('/promoter-submit-new.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#event-submission-form')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#event-name')).toBeVisible();
    await expect(page.locator('#description')).toBeVisible();
    await expect(page.locator('#date')).toBeVisible();
    await expect(page.locator('#start-time')).toBeVisible();
    await expect(page.locator('#contact-name')).toBeVisible();
    await expect(page.locator('#contact-email')).toBeVisible();
  });

  test('admin login page loads', async ({ page }) => {
    const response = await page.goto('/admin-login.html', { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBeLessThan(400);
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
  });
});
