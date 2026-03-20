const { test, expect } = require('@playwright/test');

test.describe('Event Submission Form Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/promoter-submit-new.html');
  });

  test('all required form fields are present', async ({ page }) => {
    await expect(page.locator('#event-name')).toBeVisible();
    await expect(page.locator('#description')).toBeVisible();
    await expect(page.locator('#date')).toBeVisible();
    await expect(page.locator('#start-time')).toBeVisible();
    await expect(page.locator('#contact-name')).toBeVisible();
    await expect(page.locator('#contact-email')).toBeVisible();
    await expect(page.locator('#venue-search')).toBeVisible();
  });

  test('optional fields are present', async ({ page }) => {
    await expect(page.locator('#end-time')).toBeVisible();
    await expect(page.locator('#price')).toBeVisible();
    await expect(page.locator('#age-restriction')).toBeVisible();
    await expect(page.locator('#link')).toBeVisible();
  });

  test('category checkboxes are present and selectable', async ({ page }) => {
    const categoryCheckboxes = page.locator('input[name="categories"]');
    const count = await categoryCheckboxes.count();
    expect(count).toBeGreaterThan(5);

    // Select a category and verify it's checked
    const firstCheckbox = categoryCheckboxes.first();
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();
  });

  test('recurring event toggle shows config', async ({ page }) => {
    const recurringCheckbox = page.locator('#is-recurring');
    const recurringConfig = page.locator('#recurring-config');

    await expect(recurringConfig).toBeHidden();
    await recurringCheckbox.check();
    await expect(recurringConfig).toBeVisible();
  });

  test('add new venue button shows inline form', async ({ page }) => {
    const addNewVenueBtn = page.locator('#add-new-venue');
    const newVenueForm = page.locator('#new-venue-form');

    await expect(newVenueForm).toBeHidden();
    await addNewVenueBtn.click();
    await expect(newVenueForm).toBeVisible();
    await expect(page.locator('#new-venue-name')).toBeVisible();
    await expect(page.locator('#new-venue-address')).toBeVisible();
    await expect(page.locator('#new-venue-postcode')).toBeVisible();
  });

  test('cancel new venue hides form', async ({ page }) => {
    await page.locator('#add-new-venue').click();
    await expect(page.locator('#new-venue-form')).toBeVisible();

    await page.locator('#cancel-new-venue').click();
    await expect(page.locator('#new-venue-form')).toBeHidden();
  });

  test('poster upload area is present', async ({ page }) => {
    await expect(page.locator('#upload-area')).toBeVisible();
    await expect(page.locator('#poster-upload')).toBeAttached();
  });

  test('submit button is present', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText(/submit/i);
  });
});
