const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/smoke',
  timeout: 30000,
  retries: 1,
  globalSetup: require.resolve('./tests/global-setup.js'),
  use: {
    baseURL: 'http://localhost:8888',
    headless: true,
  },
  webServer: {
    // Build Astro pages first so the merged .html artefacts (e.g.
    // admin-system-status.html) exist at the project root before
    // serve picks them up. Cheap (~1.5s).
    command: 'npm run astro:deploy && npx serve . -l 8888',
    port: 8888,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
