const { test, expect } = require('../fixtures/auth');

const PENDING_URL = '**/.netlify/functions/get-pending-items-firestore';
const VENUES_URL = '**/.netlify/functions/get-admin-venues';
const STATUS_URL = '**/.netlify/functions/update-item-status';

function makePendingEvent(overrides = {}) {
  return {
    id: 'pending-event-1',
    type: 'event',
    name: 'Pending Drag Brunch',
    date: new Date(Date.now() + 7 * 86400e3).toISOString(),
    venueName: 'The Test Venue',
    venueId: 'test-venue-id',
    submittedBy: 'test-promoter@example.com',
    description: 'A pending event awaiting approval.',
    category: ['Drag'],
    status: 'pending',
    ...overrides,
  };
}

async function stubBaseRoutes(page, items) {
  await page.route(PENDING_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
    });
  });
  await page.route(VENUES_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ venues: [] }),
    });
  });
}

test.describe('Admin approval flow', () => {
  test('approves a pending event', async ({ adminPage }) => {
    const event = makePendingEvent();
    await stubBaseRoutes(adminPage, [event]);

    let approveBody = null;
    await adminPage.route(STATUS_URL, async (route) => {
      approveBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await adminPage.goto('/admin-approvals.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    const approveBtn = adminPage.locator(`.approve-btn[data-id="${event.id}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();

    await expect(adminPage.locator('.notification-toast.notification-success')).toContainText(
      /approved successfully/i,
      { timeout: 10000 }
    );

    expect(approveBody).toEqual({
      itemId: event.id,
      newStatus: 'approved',
      itemType: 'event',
    });

    await expect(approveBtn).toBeHidden({ timeout: 5000 });
  });

  test('rejects a pending event with a reason', async ({ adminPage }) => {
    const event = makePendingEvent({ id: 'pending-event-2', name: 'To Be Rejected' });
    await stubBaseRoutes(adminPage, [event]);

    let rejectBody = null;
    await adminPage.route(STATUS_URL, async (route) => {
      rejectBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await adminPage.goto('/admin-approvals.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    const rejectBtn = adminPage.locator(`.reject-btn[data-id="${event.id}"]`);
    await expect(rejectBtn).toBeVisible({ timeout: 10000 });
    await rejectBtn.click();

    const modal = adminPage.locator('#rejection-modal');
    await expect(modal).toBeVisible();

    await adminPage.fill('#rejection-reason', 'Duplicate of an existing approved event');
    await adminPage.locator('#confirm-rejection-btn').click();

    await expect(adminPage.locator('.notification-toast.notification-success')).toContainText(
      /rejected successfully/i,
      { timeout: 10000 }
    );

    expect(rejectBody).toEqual({
      itemId: event.id,
      newStatus: 'rejected',
      itemType: 'event',
      reason: 'Duplicate of an existing approved event',
    });

    await expect(rejectBtn).toBeHidden({ timeout: 5000 });
  });

  test('blocks rejection submission when reason is empty', async ({ adminPage }) => {
    const event = makePendingEvent({ id: 'pending-event-3' });
    await stubBaseRoutes(adminPage, [event]);

    let statusCalled = false;
    await adminPage.route(STATUS_URL, async (route) => {
      statusCalled = true;
      await route.fulfill({ status: 200, body: '{}' });
    });

    await adminPage.goto('/admin-approvals.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    await adminPage.locator(`.reject-btn[data-id="${event.id}"]`).click();
    await expect(adminPage.locator('#rejection-modal')).toBeVisible();

    await adminPage.locator('#confirm-rejection-btn').click();

    await expect(adminPage.locator('.notification-toast.notification-error')).toContainText(
      /provide a reason/i,
      { timeout: 5000 }
    );
    expect(statusCalled).toBe(false);
  });
});
