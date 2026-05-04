// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    ignoreHTTPSErrors: true,
    screenshot: 'on',
    video: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
  ],
});
