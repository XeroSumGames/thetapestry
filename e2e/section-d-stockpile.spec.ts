import { test, expect } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { captureAnonKey, resolveCreds, restDelete, type SupaCreds } from './_teardown'
import { seedCommunity, seedStockpileItem } from './_seed'

// SECTION D - stockpile deposit propagates GM -> player live (the highest-value
// realtime seam). CampaignCommunity subscribes to community_stockpile_items via
// a dynamic channel `stockpile-${campaignId}-${communityIds}` with an IN-filter
// (CampaignCommunity.tsx:418); the handler only refetches a community whose
// stockpile is already LOADED, so both contexts must have the panel open first.
// We mount via /communities/<id> (initialOpenId auto-expands). Reversible:
// seed a fresh community + items, then delete it (cascades the stockpile).

test.describe('Section D - stockpile deposit GM -> player', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('a stockpile INSERT shows live in the other open community panel', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let communityId: string | null = null
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(gm)
      await gm.goto('/dashboard')
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      // Seed a fresh community + one item so both panels start non-empty.
      communityId = await seedCommunity(gm, creds!, CAMPAIGN_ID, '[E2E] Section D Community')
      await seedStockpileItem(gm, creds!, communityId, '[E2E] Seed Item')

      await Promise.all([
        gm.goto(`/communities/${communityId}`, { waitUntil: 'domcontentloaded' }),
        pl.goto(`/communities/${communityId}`, { waitUntil: 'domcontentloaded' }),
      ])

      // initialOpenId expands the panel but does NOT fire the stockpile
      // lazy-load (loadStockpile only runs on the manual panel toggle,
      // CampaignCommunity.tsx:1684). Toggle each panel (collapse + re-open) so
      // the stockpile loads AND stockpileLoadedFor is armed - the realtime
      // handler only refetches a community whose stockpile is already loaded.
      const NAME = '[E2E] Section D Community'
      for (const p of [gm, pl]) {
        const header = p.getByText(NAME, { exact: false }).first()
        await header.click().catch(() => {})
        await p.waitForTimeout(400)
        await header.click().catch(() => {})
        await p.waitForTimeout(800)
      }

      // Player now sees the seeded item (panel mounted + stockpile loaded).
      // Gates the realtime assertion below as meaningful.
      await expect(pl.getByText('[E2E] Seed Item').first()).toBeVisible({ timeout: 10_000 })

      // GM deposits a NEW item (an INSERT on community_stockpile_items).
      const newName = `[E2E] Live Deposit ${Date.now()}`
      await seedStockpileItem(gm, creds!, communityId, newName)

      // Player's panel shows it live, no reload (~2s; 8s headroom).
      await expect(pl.getByText(newName).first()).toBeVisible({ timeout: 8_000 })
    } finally {
      if (communityId && creds) await restDelete(gm, 'communities', communityId, creds).catch(() => {}) // cascades stockpile
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
