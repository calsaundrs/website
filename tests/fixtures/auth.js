const { test: base, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const STORAGE_STATE = path.join(__dirname, '..', '.auth/admin.json');

const test = base.extend({
  adminPage: async ({ browser }, use) => {
    if (!fs.existsSync(STORAGE_STATE)) {
      throw new Error(
        `Admin storage state not found at ${STORAGE_STATE}.\n` +
        `Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env.test (see .env.test.example) ` +
        `then re-run tests so the global setup can sign in. ` +
        `See tests/README.md.`
      );
    }
    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});

module.exports = { test, expect };
