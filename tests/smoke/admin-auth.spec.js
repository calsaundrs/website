const { test, expect } = require('../fixtures/auth');

test.describe('Admin auth fixture', () => {
  test('admin-settings loads without redirecting to login', async ({ adminPage }) => {
    const response = await adminPage.goto('/admin-settings.html', { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBeLessThan(400);

    // auth-guard.js hides body until auth check completes; wait for that to settle
    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    expect(adminPage.url()).not.toContain('admin-login.html');
  });

  test('admin-approvals loads without redirecting to login', async ({ adminPage }) => {
    const response = await adminPage.goto('/admin-approvals.html', { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBeLessThan(400);

    await adminPage.waitForFunction(
      () => document.body.style.display !== 'none',
      { timeout: 5000 }
    ).catch(() => {});

    expect(adminPage.url()).not.toContain('admin-login.html');
  });
});
