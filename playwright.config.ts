import { defineConfig, devices } from '@playwright/test'

// The "final test" - Playwright E2E acceptance suite. Runs SEPARATELY from
// the 548 vitest unit tests (npm test). Invoke with `npm run test:e2e`.
//
// Target is PROD (thetapestry.distemperverse.com) - there is no staging.
// Every write therefore goes against the disposable test campaign (THE ARENA)
// with the disposable test accounts. See e2e/_fixtures.ts for ids.
//
// Auth: sessions are captured ONCE by a human (Xero logs in; the password is
// never automated) via `node e2e/capture-auth.mjs gm|player`. The saved JSON
// in e2e/.auth/ is gitignored (it is live credentials). Specs that need auth
// skip with a clear message when the file is absent, so a fresh checkout / CI
// can still install, typecheck, and run the no-auth slice.
export default defineConfig({
  testDir: './e2e',
  // Be a polite guest on prod: cap concurrency so the sweep does not hammer
  // the live site. Realtime specs run their two contexts inside one test.
  fullyParallel: false,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  // Prod is a live target with realtime + a Sentry /monitoring tunnel, so the
  // sweep occasionally trips a transient 500 and tight-timing realtime asserts
  // (e.g. Section D resubscribe) can miss under full-run load. Retries let a
  // genuine transient pass on a second attempt while a REAL regression still
  // fails every attempt (it's deterministic - that's how section-c was caught).
  retries: 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://thetapestry.distemperverse.com',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // Auto-login: mints/refreshes the 4 storageStates before the tests run.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
})
