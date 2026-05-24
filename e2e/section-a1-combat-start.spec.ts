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
      // Session" and this no-ops).
      await gm.getByRole('button', { name: /end combat/i }).first().click().catch(() => {})
      await gm.waitForTimeout(500)
      await gm.getByRole('button', { name: /start session/i }).first().click().catch(() => {})
      await gm.waitForTimeout(1200)

      // GM opens the Start Combat picker, then confirms with the NPC set.
      await gm.getByRole('button', { name: /start combat/i }).first().click()
      await gm.waitForTimeout(800)
      // The picker's confirm button reads "Start Combat (N NPCs)". If nothing is
      // pre-selected, select the first NPC checkbox first.
      const confirm = gm.getByRole('button', { name: /start combat \(/i }).first()
      if (!(await confirm.isEnabled().catch(() => false))) {
        await gm.getByRole('checkbox').first().check().catch(() => {})
        await gm.waitForTimeout(300)
      }
      await confirm.click()
      started = true

      // Player reflects IN COMBAT live, no reload.
      await expect(pl.getByText(/in combat/i).first()).toBeVisible({ timeout: 10_000 })
    } finally {
      if (started) {
        await gm.getByRole('button', { name: /end combat/i }).first().click().catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
