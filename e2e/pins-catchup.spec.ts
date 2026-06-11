import { test, expect } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { captureAnonKey, resolveCreds, SUPABASE_URL, type SupaCreds } from './_teardown'

// REALTIME CATCH-UP REGRESSION - broadcast-only sub reloads on tab-return (Sys K).
//
// Guards HP's 344bbfc fix. Five surfaces converged on shared state only by
// catching a one-shot, fire-and-forget broadcast, so a client whose tab was
// backgrounded / socket dropped / joined late never received the packet and
// showed STALE data until a manual refresh (playtest: "shared a pin, didn't
// show without a refresh"). The fix: each sub now ALSO reloads on its channel's
// SUBSCRIBED status AND on document `visibilitychange` -> visible.
//
// WHY PINS IS THE CLEAN ISOLATION TARGET: components/CampaignPins.tsx is
// BROADCAST-ONLY - it listens to the `pins_changed` broadcast and has NO
// postgres_changes sub. A pin INSERTed via REST fires NO app broadcast, so it
// reaches CampaignPins through ZERO realtime path; only a loadPins() re-run can
// put it into that component's OWN list state. (The sibling CampaignMap has a
// pg_changes sub, but it renders the pin name only as a marker `title=` attr +
// a closed popup - neither is matchable by getByText - and its list is separate
// state, so it cannot populate the CampaignPins sidebar row we assert on.)
//
// So: load the player's pin list, INSERT a revealed pin (missed - no broadcast),
// confirm it's absent, fire a visibilitychange (tab-return), and assert it now
// appears in the CampaignPins sidebar. Reverting the catch-up wiring makes the
// pin never converge -> this goes red. Reversible (the pin is deleted in teardown).

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Realtime catch-up - pins reload on tab-return (broadcast-only sub)', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('a pin the player MISSED (no broadcast) converges after a visibilitychange catch-up', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()

    const runId = Date.now().toString(36)
    const pinName = `[E2E ${runId}] catchup pin`
    let creds: SupaCreds | null = null
    let pinId: string | null = null
    try {
      // GM creds for the REST insert + teardown.
      const anonP = captureAnonKey(gm)
      await gm.goto(`/stories/${CAMPAIGN_ID}`, { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      // Player opens the table; CampaignPins mounts (gmTab defaults to 'pins')
      // and loads. Wait for its initial pins fetch so the upcoming insert is
      // guaranteed MISSED by the initial load (and by the SUBSCRIBED catch-up).
      //
      // Race guard: if The Arena has active combat, loadInitiative fires and
      // setCombatActive(true) triggers the [combatActive,showTacticalMap] effect
      // which auto-switches gmTab to 'npcs', unmounting CampaignPins and removing
      // its visibilitychange handler. We click 'Pins' AFTER the 1500ms settle so
      // the combat state has already loaded, the auto-switch has already fired,
      // and the second click re-mounts CampaignPins with a fresh handler THAT STAYS
      // registered (the effect deps haven't changed, so it won't re-fire).
      const initialLoad = pl.waitForResponse(
        r => r.url().includes('/rest/v1/campaign_pins') && r.request().method() === 'GET',
        { timeout: 30_000 },
      ).catch(() => null)
      await pl.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' })
      await pl.getByRole('button', { name: 'Pins' }).first().click().catch(() => {})
      await initialLoad
      await pl.waitForTimeout(1500)
      // Second click: ensures CampaignPins is mounted AFTER combat state settles.
      await pl.getByRole('button', { name: 'Pins' }).first().click().catch(() => {})
      await pl.waitForTimeout(400)

      await expect(pl.getByText(pinName), 'pin somehow present before it was created').toHaveCount(0)

      // GM creates a REVEALED pin via REST - a raw DB write fires NO
      // `pins_changed` broadcast, so the player's broadcast-only sub never hears it.
      const ins = await gm.request.post(`${SUPABASE_URL}/rest/v1/campaign_pins`, {
        headers: { ...H(creds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
        data: { campaign_id: CAMPAIGN_ID, name: pinName, lat: 39.5, lng: -98.35, revealed: true, folder: null },
      })
      expect(ins.ok(), 'pin insert failed').toBe(true)
      const rows = await ins.json().catch(() => [])
      pinId = (Array.isArray(rows) && rows[0]?.id) ? rows[0].id : null
      expect(pinId, 'no pin id returned from insert').toBeTruthy()

      // Negative control: give realtime a beat and confirm the pin has NOT
      // surfaced in the player's list. No broadcast + no postgres_changes on this
      // sub = no delivery path; absent the catch-up the player stays stale.
      await pl.waitForTimeout(2500)
      await expect(pl.getByText(pinName), 'pin arrived WITHOUT a tab-return - the broadcast-only isolation is wrong').toHaveCount(0)

      // Tab-return: fire visibilitychange while the page is visible -> catch-up loadPins.
      await pl.bringToFront()
      await pl.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

      // The CampaignPins list (its OWN state - CampaignMap can't populate it) must
      // now hold the pin. Its folders are collapsed by default, so expand the
      // Uncategorized bucket (where a folder-less pin lands) to reveal the row.
      const folder = pl.getByText('Uncategorized', { exact: false }).first()
      await expect(folder, 'Uncategorized folder never appeared - the catch-up loadPins did not run on tab-return').toBeVisible({ timeout: 15_000 })
      await folder.click()
      await expect(
        pl.getByText(pinName),
        'the missed pin did not converge after the visibilitychange catch-up (regression in the broadcast-only catch-up reload)',
      ).toBeVisible({ timeout: 10_000 })
    } finally {
      if (creds && pinId) {
        await gm.request.delete(`${SUPABASE_URL}/rest/v1/campaign_pins?id=eq.${pinId}`, { headers: H(creds) }).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
