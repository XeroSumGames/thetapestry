import { test, expect } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { captureAnonKey, resolveCreds, restDelete, SUPABASE_URL, type SupaCreds } from './_teardown'
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

      // D-1: GM deposits a NEW item (INSERT) -> player sees it live, no reload.
      const newName = `[E2E] Live Deposit ${Date.now()}`
      const itemId = await seedStockpileItem(gm, creds!, communityId, newName)
      await expect(pl.getByText(newName).first()).toBeVisible({ timeout: 8_000 })

      // D-2: bump that item's qty (UPDATE) -> the player's row shows "x5" live
      // (the panel renders qty as "×N" only when qty > 1; CampaignCommunity.tsx:2376).
      const patch = await gm.request.patch(
        `${SUPABASE_URL}/rest/v1/community_stockpile_items?id=eq.${itemId}`,
        { headers: { apikey: creds!.anonKey, Authorization: `Bearer ${creds!.accessToken}`, 'Content-Type': 'application/json' }, data: { qty: 5 } },
      )
      expect(patch.ok(), 'qty PATCH failed').toBe(true)
      await expect(pl.getByText('×5').first()).toBeVisible({ timeout: 8_000 })
    } finally {
      if (communityId && creds) await restDelete(gm, 'communities', communityId, creds).catch(() => {}) // cascades stockpile
      await gmCtx.close()
      await plCtx.close()
    }
  })

  test('D-3 resubscribe: deposit into a community created while the panel is open still propagates', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    let aId: string | null = null
    let bId: string | null = null
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(gm)
      await gm.goto('/dashboard')
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      // Anchor community A so the panel + the stockpile channel are live.
      aId = await seedCommunity(gm, creds!, CAMPAIGN_ID, '[E2E] Resub Anchor')
      await gm.goto(`/communities/${aId}`, { waitUntil: 'domcontentloaded' })
      await gm.waitForTimeout(1500)

      // Create community B IN-APP. Growing the local communities list renames
      // the stockpile channel (stockpile-${campaignId}-${ids}) so the sub
      // resubscribes with the widened IN-filter. (The communities table isn't
      // in the realtime publication, so only the in-app create updates the list.)
      const bName = `[E2E] Resub New ${Date.now()}`
      await gm.getByRole('button', { name: /new community/i }).first().click()
      await gm.waitForTimeout(500)
      await gm.getByRole('textbox').first().fill(bName)
      await gm.getByRole('button', { name: /^create$/i }).first().click()
      await gm.waitForTimeout(1500)

      // Resolve B's id + open its panel so its stockpile loads (arms refetch).
      const res = await gm.request.get(
        `${SUPABASE_URL}/rest/v1/communities?campaign_id=eq.${CAMPAIGN_ID}&name=eq.${encodeURIComponent(bName)}&select=id`,
        { headers: { apikey: creds!.anonKey, Authorization: `Bearer ${creds!.accessToken}` } },
      )
      const rows = await res.json().catch(() => [])
      expect(Array.isArray(rows) && rows.length === 1, 'community B was not created via the UI').toBe(true)
      bId = rows[0].id
      // Creating B auto-opens its panel but doesn't load the stockpile, so
      // toggle it (close + re-open) to arm loadStockpile - same gotcha as D-1/D-2.
      const bHeader = gm.getByText(bName, { exact: false }).first()
      await bHeader.click().catch(() => {})
      await gm.waitForTimeout(400)
      await bHeader.click().catch(() => {})
      await gm.waitForTimeout(1000)

      // Deposit into B via REST. If the channel resubscribed to include B, this
      // INSERT is delivered live and renders with no reload (the regression case).
      const depName = `[E2E] Resub Item ${Date.now()}`
      await seedStockpileItem(gm, creds!, bId!, depName)
      await expect(gm.getByText(depName).first()).toBeVisible({ timeout: 8_000 })
    } finally {
      if (creds) {
        if (bId) await restDelete(gm, 'communities', bId, creds).catch(() => {})
        if (aId) await restDelete(gm, 'communities', aId, creds).catch(() => {})
      }
      await gmCtx.close()
    }
  })
})
