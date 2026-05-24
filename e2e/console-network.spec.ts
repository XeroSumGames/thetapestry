import { test, expect } from '@playwright/test'
import { AUTH, canAuth, STATIC_ROUTES, CAMPAIGN_ROUTES } from './_fixtures'
import { watchPage, describeProblems } from './_console'

// LAYER 1 (cheapest, highest value, lowest fragility): walk every route as the
// GM and assert ZERO console errors + ZERO in-scope failed requests. This locks
// in the Phase 6 win (prod console is now silent) as a permanent regression
// gate. Realtime/behavioral coverage lives in the other specs.

// storageState is attached whenever we CAN authenticate (a session file exists,
// or credentials exist so the setup project will mint one before this runs). A
// fresh checkout with neither still installs + typechecks; the tests skip.
test.use({ storageState: canAuth('gm') ? AUTH.gm : undefined })

const CAPTURE_HINT = 'No GM session. Add creds to e2e/.auth/credentials.json (or run: node e2e/capture-auth.mjs gm)'

async function sweep(route: string, page: import('@playwright/test').Page, baseURL?: string) {
  const problems = watchPage(page, baseURL)
  const resp = await page.goto(route, { waitUntil: 'domcontentloaded' })

  // A bounced-to-login means the captured session expired - fail loudly with
  // the fix, rather than reporting a misleading "page not clean".
  await page.waitForLoadState('load').catch(() => {})
  expect(page.url(), `${route} redirected to /login - GM session expired, re-run: node e2e/capture-auth.mjs gm`).not.toContain('/login')
  expect(resp, `${route} returned no response`).toBeTruthy()

  // Let client-side errors surface (hydration, effects, realtime subscribe).
  await page.waitForTimeout(2500)

  const msg = describeProblems(route, problems)
  expect(msg, msg || `${route} clean`).toBe('')
}

test.describe('console + network sweep: static routes', () => {
  test.skip(!canAuth('gm'), CAPTURE_HINT)
  for (const route of STATIC_ROUTES) {
    test(`clean: ${route}`, async ({ page, baseURL }) => {
      await sweep(route, page, baseURL)
    })
  }
})

test.describe('console + network sweep: disposable-campaign routes', () => {
  test.skip(!canAuth('gm'), CAPTURE_HINT)
  for (const route of CAMPAIGN_ROUTES) {
    test(`clean: ${route}`, async ({ page, baseURL }) => {
      await sweep(route, page, baseURL)
    })
  }
})
