import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests-e2e',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000' },
  webServer: {
    command: `npm run dev -- --port ${process.env.PLAYWRIGHT_PORT ?? '3000'}`,
    url: `http://localhost:${process.env.PLAYWRIGHT_PORT ?? '3000'}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
