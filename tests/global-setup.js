const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const STORAGE_STATE = path.join(__dirname, '.auth/admin.json');

function loadEnvTest() {
  const envPath = path.join(__dirname, '..', '.env.test');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

module.exports = async (config) => {
  loadEnvTest();

  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      '[global-setup] TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD not set — skipping admin auth setup. ' +
      'Tests that require the adminPage fixture will fail with a clear error. ' +
      'See tests/README.md.'
    );
    if (fs.existsSync(STORAGE_STATE)) fs.unlinkSync(STORAGE_STATE);
    return;
  }

  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:8888';
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  await page.goto('/admin-login.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes('admin-login'), { timeout: 15000 });

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await context.storageState({ path: STORAGE_STATE, indexedDB: true });
  await browser.close();

  console.log(`[global-setup] Admin storage state saved to ${STORAGE_STATE}`);
};
