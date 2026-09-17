import { defineConfig, devices } from '@playwright/test';

const remoteBaseURL = process.env.E2E_BASE_URL?.replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: remoteBaseURL || 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'iphone-16-simulation',
      use: {
        ...devices['iPhone 15'],
        viewport: { width: 393, height: 852 },
        screen: { width: 393, height: 852 },
        video: 'on',
        screenshot: 'on',
      },
    },
  ],
  webServer: remoteBaseURL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
