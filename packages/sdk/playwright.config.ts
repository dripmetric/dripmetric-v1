import { defineConfig } from '@playwright/test';

/**
 * The browser SDK's exit checks need a real browser (brief M3): consent storing
 * nothing, SPA route changes, beacons on tab hide, and the page staying responsive
 * with the network blocked. None of those can be proven in a mocked DOM.
 */
export default defineConfig({
  testDir: './e2e',
  // One worker: the tests assert on a shared request log per page, and a flaky
  // analytics test is worse than none.
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? 'line' : 'list',
  use: {
    // The container's own Chromium. `playwright install` would fetch a second copy
    // that this Playwright cannot find.
    launchOptions: { args: ['--no-sandbox'] },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
