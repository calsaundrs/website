const { test, expect } = require('../fixtures/auth');

const VENUE_SUBMISSION_URL = '**/.netlify/functions/venue-submission';
const GET_VENUES_URL = '**/.netlify/functions/get-venues**';
const UPDATE_VENUE_URL = '**/.netlify/functions/update-venue';
const STATUS_URL = '**/.netlify/functions/update-item-status';

function makeVenue(overrides = {}) {
  return {
    id: 'venue-1',
    name: 'Smoke Test Venue',
    description: 'A smoke-test venue for admin management.',
    address: '1 Test Street, Birmingham',
    postcode: 'B1 1AA',
    image: { url: 'https://example.com/test-venue.jpg' },
    vibeTags: ['Lively'],
    venueFeatures: ['Karaoke'],
    accessibilityRating: 'Fully Accessible',
    contactEmail: 'venue@example.com',
    ...overrides,
  };
}

test.describe('Admin venue management', () => {
  test('add venue: submits form and shows success status', async ({ adminPage }) => {
    let body = null;
    await adminPage.route(VENUE_SUBMISSION_URL, async (route) => {
      body = route.request().postData() || '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, venueId: 'new-venue-id' }),
      });
    });

    await adminPage.goto('/admin-add-venue.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    await adminPage.fill('#venue-name', 'Brand New Test Venue');
    await adminPage.fill('#venue-address', '99 New Street, Birmingham');
    await adminPage.fill('#venue-postcode', 'B2 4QA');
    await adminPage.fill('#venue-description', 'Created by Playwright.');
    await adminPage.fill('#venue-contact-email', 'newvenue@example.com');

    await adminPage.locator('#submit-button').click();

    await expect(adminPage.locator('#form-status')).toContainText(/Success/i, { timeout: 10000 });

    expect(body).toContain('Brand New Test Venue');
    expect(body).toContain('99 New Street');
    expect(body).toContain('B2 4QA');
  });

  test('manage venues: edit updates the venue via update-venue', async ({ adminPage }) => {
    const existing = makeVenue();
    await adminPage.route(GET_VENUES_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ venues: [existing] }),
      });
    });

    let updateBody = null;
    await adminPage.route(UPDATE_VENUE_URL, async (route) => {
      updateBody = route.request().postData() || '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const dialogs = [];
    adminPage.on('dialog', (d) => {
      dialogs.push(d.message());
      d.accept().catch(() => {});
    });

    await adminPage.goto('/admin-manage-venues.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    const editBtn = adminPage.locator('.button-edit').first();
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();

    const modal = adminPage.locator('#edit-modal, [id*="edit"]').first();
    await expect(adminPage.locator('#edit-form-fields input[name="name"]')).toBeVisible();

    await adminPage.locator('#edit-form-fields input[name="name"]').fill('Renamed Test Venue');

    await adminPage.locator('#edit-form button[type="submit"]').click();

    await expect.poll(() => dialogs.find((m) => /updated successfully/i.test(m)) || null, {
      timeout: 10000,
    }).toBeTruthy();

    expect(updateBody).toContain('Renamed Test Venue');
    expect(updateBody).toContain(existing.id);
  });

  test('manage venues: delete sends update-item-status with status=deleted', async ({ adminPage }) => {
    const existing = makeVenue({ id: 'venue-to-delete', name: 'Doomed Venue' });
    await adminPage.route(GET_VENUES_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ venues: [existing] }),
      });
    });

    let deleteBody = null;
    await adminPage.route(STATUS_URL, async (route) => {
      deleteBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const dialogMessages = [];
    adminPage.on('dialog', (d) => {
      dialogMessages.push(d.message());
      d.accept().catch(() => {});
    });

    await adminPage.goto('/admin-manage-venues.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    const deleteBtn = adminPage.locator('.button-delete').first();
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
    await deleteBtn.click();

    await expect.poll(() => deleteBody, { timeout: 10000 }).not.toBeNull();

    expect(deleteBody).toEqual({
      itemId: existing.id,
      newStatus: 'deleted',
      itemType: 'venue',
    });

    expect(dialogMessages.some((m) => /sure you want to delete/i.test(m))).toBe(true);
  });
});
