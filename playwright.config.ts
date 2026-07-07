import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Specs share one Postgres instance and mutate the same tables (queue
  // resets, pending counts, resolutions) — running them in parallel workers
  // races those mutations against each other, so force sequential execution.
  // Mirrors the same rationale as fileParallelism: false in vitest.config.ts.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // Batch-upload E2E fixtures are served from this same localhost dev
    // server; the real SSRF guard (lib/uploads/fetch-external-image.ts)
    // would otherwise reject them as a private/loopback address. Only ever
    // set for this Playwright-launched process.
    env: { ALLOW_LOOPBACK_FETCH_IN_TESTS: 'true' },
  },
});
