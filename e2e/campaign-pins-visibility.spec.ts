import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Campaign Pin visibility contract: the GM controls pin visibility via the
// campaign_pins.revealed boolean. The app filters player-visible pins at the
// application layer: CampaignPins.tsx applies `.eq('revealed', true)` for
// non-GM users (NOT RLS - RLS allows all campaign members to select).
//
// This spec seeds a pin with revealed=false via REST, verifies a player-scoped
// query with the revealed=eq.true filter returns nothing, then patches revealed=true
// and verifies the same query now returns the pin.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Campaign Pins - visibility toggle contract', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('GM reveals pin -> player-scoped query transitions from empty to returning the pin', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let campaignId: string | null = null
    let gmCreds: SupaCreds | null = null
    let plCreds: SupaCreds | null = null
    let pinId: string | null = null
    try {
      const gmAnonP = captureAnonKey(gm)
      const plAnonP = captureAnonKey(pl)
      gmCreds = await resolveCreds(gm, gmAnonP)
      plCreds = await resolveCreds(pl, plAnonP)
      expect(gmCreds && plCreds, 'could not resolve gm + marv creds').toBeTruthy()

      // GM creates throwaway campaign.
      const tag = `[E2E ${Date.now().toString(36)}] Pins`
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]

      // Marv joins (so marv has SELECT access to campaign_pins via campaign membership RLS).
      const campRow = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=invite_code`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ invite_code: string }>
      const inviteCode = campRow?.[0]?.invite_code
      expect(inviteCode, 'no invite_code').toBeTruthy()

      await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
      await pl.getByPlaceholder('XXXXXX').fill(inviteCode!)
      await pl.getByRole('button', { name: /join/i }).first().click()
      await pl.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 20_000 })

      // REST INSERT a pin with revealed=false (hidden from players).
      // category='location' is required (NOT NULL, matches app default).
      const pinName = `E2E-${Date.now().toString(36)}`
      // lat + lng are NOT NULL in the schema (schema.sql:147-148).
      await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_pins`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          data: { campaign_id: campaignId, name: pinName, category: 'location', lat: 0, lng: 0, revealed: false } },
      )
      // SELECT to get the id (don't rely on return=representation PostgREST quirks).
      const pinSel = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/campaign_pins?campaign_id=eq.${campaignId}&name=eq.${encodeURIComponent(pinName)}&select=id`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ id: string }>
      pinId = pinSel?.[0]?.id
      expect(pinId, 'pin INSERT did not create a row (SELECT returned no id)').toBeTruthy()

      // Player-scoped query: filter revealed=eq.true (mirrors what CampaignPins.tsx does).
      // Should return empty while the pin is hidden.
      const playerQuery = async () => {
        const rows = await (await pl.request.get(
          `${SUPABASE_URL}/rest/v1/campaign_pins?campaign_id=eq.${campaignId}&id=eq.${pinId}&revealed=eq.true&select=id,name,revealed`,
          { headers: H(plCreds!) },
        )).json() as Array<{ id: string; name: string; revealed: boolean }>
        return Array.isArray(rows) ? rows.length : -1
      }

      // Verify pin is NOT visible to player while revealed=false.
      const hiddenCount = await playerQuery()
      expect(hiddenCount, 'player should not see unrevealed pin (revealed=false)').toBe(0)

      // GM reveals the pin.
      await gm.request.patch(
        `${SUPABASE_URL}/rest/v1/campaign_pins?id=eq.${pinId}`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' }, data: { revealed: true } },
      )

      // Player-scoped query should now return the pin.
      await expect.poll(playerQuery, { timeout: 8_000, message: 'pin did not become visible to player after revealed=true' }).toBe(1)
    } finally {
      if (campaignId && gmCreds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
