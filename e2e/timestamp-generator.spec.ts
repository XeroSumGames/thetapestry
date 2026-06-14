import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'

// Timestamp generator UI contract: /campfire/timestamp renders a table of
// Discord-style <t:UNIX:code> tokens for the current time. The page is pure
// client-side (no DB); the contract is that all 7 canonical format tokens
// plus the raw unix copy button appear with a non-zero unix epoch after load.
//
// Format codes tested (matches Discord + HammerTime):
//   d/D - short/long date    t/T - short/long time
//   f/F - short/long date+time    R - relative
//
// No DB, no teardown needed.

test.describe('Timestamp generator page', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('renders all 7 Discord timestamp tokens with a valid non-zero unix epoch', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const page = await ctx.newPage()
    try {
      await page.goto('/campfire/timestamp', { waitUntil: 'domcontentloaded' })

      // The page initialises from getCurrentLocalIsoMinute() via useEffect on
      // mount. Wait for at least the short-date token to render with a real unix
      // value (unix=0 before useEffect runs would give "<t:0:d>").
      await expect(
        page.getByText(/<t:[1-9]\d+:d>/),
        'Short date token did not render with a non-zero unix value',
      ).toBeVisible({ timeout: 10_000 })

      // All 7 canonical format codes must be present in the output table.
      for (const code of ['d', 'D', 't', 'T', 'f', 'F', 'R']) {
        await expect(
          page.getByText(new RegExp(`<t:[1-9]\\d+:${code}>`)),
          `Discord timestamp token with format code '${code}' not visible`,
        ).toBeVisible({ timeout: 5_000 })
      }

      // The raw unix row shows a 10-digit epoch in the copy button.
      // Epochs from 2024-2035 are all in the range 17xx-xx-xx (10 digits
      // starting with "17"). Use a broad digit-count check to stay future-safe.
      await expect(
        page.locator('button').filter({ hasText: /^\s*📋\s+\d{9,11}\s*$/ }).first(),
        'Raw unix copy button (10-digit epoch) not found',
      ).toBeVisible({ timeout: 5_000 })
    } finally {
      await ctx.close()
    }
  })
})
