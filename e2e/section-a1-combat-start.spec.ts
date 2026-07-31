import { test, expect } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'

// SECTION A1 - combat start propagates GM -> player. Foundation for A2/F: it
// validates driving the combat UI (Start Combat modal) and the IN-COMBAT
// propagation before layering attack -> conditions on top. GM starts combat;
// the player's table reflects "IN COMBAT" live. Teardown: GM ends combat (Arena
// is the disposable campaign; End Combat resets it).

test.describe('Section A1 - combat start GM -> player', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM Start Combat -> player sees IN COMBAT live', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let started = false
    try {
      await Promise.all([
        gm.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' }),
        pl.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' }),
      ])
      await gm.waitForTimeout(2500)

      // Combat requires an active session. Clear any leftover combat, then
      // ensure a session is open (if one already is, the button reads "End
      // Session" and this no-ops). Rename (2026-06+): the end-combat button is
      // now "End the Moment"; /end combat/i silently matched nothing and left
      // the Arena stuck in-combat, hiding the "Into the Moment" start button.
      await gm.getByRole('button', { name: /end the moment/i }).first().click().catch(() => {})
      await gm.waitForTimeout(500)
      await gm.getByRole('button', { name: /start session/i }).first().click().catch(() => {})
      await gm.waitForTimeout(1200)

      // GM opens the Into the Moment picker (HP 2026-06 rename: Start Combat -> Into the Moment).
      await gm.getByRole('button', { name: /into the moment/i }).first().click()
      await gm.waitForTimeout(800)
      // Confirm button reads "Into the Moment (N NPCs)"; paren-variant distinguishes
      // it from the header button which lacks the count.
      const confirm = gm.getByRole('button', { name: /into the moment \(/i }).first()
      if (!(await confirm.isEnabled().catch(() => false))) {
        await gm.getByRole('checkbox').first().check().catch(() => {})
        await gm.waitForTimeout(300)
      }
      await confirm.click()
      started = true

      // Player reflects IN THE MOMENT live (HP 2026-06 rename: IN COMBAT -> IN THE MOMENT).
      // 25s SLA: under full-run load The Arena's combat channel carries heavy concurrent
      // start/end churn; this missed all retries in a 10.5-min full run at 10s.
      await expect(pl.getByText(/in the moment/i).first()).toBeVisible({ timeout: 25_000 })
    } finally {
      if (started) {
        await gm.getByRole('button', { name: /end the moment/i }).first().click().catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
