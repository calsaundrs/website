const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/smoke',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8888',
    headless: true,
  },
  webServer: {
    command: 'npx serve . -l 8888',
    port: 8888,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
