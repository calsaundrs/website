const { test, expect } = require('@playwright/test');

test.describe('Page Load Smoke Tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/BrumOutLoud/i);
    await expect(page.locator('nav')).toBeVisible();
  });

  test('events page loads', async ({ page }) => {
    await page.goto('/events.html');
    await expect(page.locator('body')).toContainText(/event/i);
  });

  test('venues page loads', async ({ page }) => {
    const response = await page.goto('/all-venues.html');
    expect(response.status()).toBeLessThan(400);
  });

  test('event submission form page loads', async ({ page }) => {
    await page.goto('/promoter-submit-new.html');
    await expect(page.locator('#event-submission-form')).toBeVisible();
    await expect(page.locator('#event-name')).toBeVisible();
    await expect(page.locator('#description')).toBeVisible();
    await expect(page.locator('#date')).toBeVisible();
    await expect(page.locator('#start-time')).toBeVisible();
    await expect(page.locator('#contact-name')).toBeVisible();
    await expect(page.locator('#contact-email')).toBeVisible();
  });

  test('admin login page loads', async ({ page }) => {
    await page.goto('/admin-login.html');
    await expect(page.locator('form')).toBeVisible();
  });
});
