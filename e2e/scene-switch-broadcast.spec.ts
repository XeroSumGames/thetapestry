import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// Scene switch UI + DB contract: clicking a scene in the "Tactical Map ▾"
// header dropdown calls openScene() -> activateCampaignScene() (two-step UPDATE:
// all is_active=false, then target=true). This spec verifies the DB state
// actually flips - if it does, the Supabase realtime postgres_changes UPDATE
// subscription on tactical_scenes (in the publication per publication.sql)
// will also fire for all connected clients.
//
// Approach: create a throwaway campaign + two scenes via REST, navigate GM to
// the campaign's table page, click Scene B in the dropdown, poll the DB.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Scene switch broadcast - DB contract', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('clicking a scene in the Tactical Map dropdown activates it in the DB', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await ctx.newPage()
    let campaignId: string | null = null
    let gmCreds: SupaCreds | null = null

    try {
      const gmAnonP = captureAnonKey(gm)
      await gm.goto('/campfire', { waitUntil: 'domcontentloaded' })
      gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()

      const gmUserId = userIdFromToken(gmCreds!.accessToken)
      expect(gmUserId, 'could not derive GM user id from JWT').toBeTruthy()

      const tag = `E2E-SW-${Date.now().toString(36)}`

      // Throwaway campaign so we control exactly what scenes exist (no interference
      // with The Arena's scene state). invite_code has no DEFAULT.
      const campInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaigns?select=id`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { gm_user_id: gmUserId, name: `${tag}-campaign`, invite_code: tag } },
      )).json() as Array<{ id: string }>
      campaignId = campInsert?.[0]?.id ?? null
      expect(campaignId, 'campaigns INSERT did not return an id').toBeTruthy()

      const sceneAName = `${tag}-Alpha`
      const sceneBName = `${tag}-Beta`

      // Scene A (won't be clicked - confirms Alpha stays inactive)
      await gm.request.post(
        `${SUPABASE_URL}/rest/v1/tactical_scenes`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          data: { campaign_id: campaignId, name: sceneAName, grid_cols: 20, grid_rows: 15, cell_feet: 3, cell_px: 35 } },
      )

      // Scene B (target - should become is_active=true after clicking)
      await gm.request.post(
        `${SUPABASE_URL}/rest/v1/tactical_scenes`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          data: { campaign_id: campaignId, name: sceneBName, grid_cols: 20, grid_rows: 15, cell_feet: 3, cell_px: 35 } },
      )

      // Navigate GM to the table page for this campaign.
      // The GM owns the campaign (gm_user_id = auth.uid()) so gmLike=true -> Tactical
      // Map dropdown renders in the header (condition: gmLike && !combatActive).
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })

      // Wait for the "Tactical Map ▾" trigger button to appear in the header.
      const tacticalBtn = gm.getByRole('button', { name: /Tactical Map/ })
      await expect(tacticalBtn, '"Tactical Map" header button not found on the table page').toBeVisible({ timeout: 20_000 })

      // Click the trigger to pin-open the dropdown (click behaviour pins the menu open).
      await tacticalBtn.click()

      // Wait for Scene B to appear in the dropdown. sceneList loads async via useEffect
      // on mount - the button appears once listCampaignScenes() resolves.
      const sceneBBtn = gm.getByRole('button', { name: sceneBName, exact: true })
      await expect(sceneBBtn, `"${sceneBName}" did not appear in the Tactical Map dropdown`).toBeVisible({ timeout: 10_000 })

      // Click Scene B -> openScene(id) -> activateCampaignScene() ->
      //   1. UPDATE tactical_scenes SET is_active=false WHERE campaign_id=...
      //   2. UPDATE tactical_scenes SET is_active=true  WHERE id=sceneBId
      await sceneBBtn.click()

      // Poll the DB until Scene B flips to is_active=true.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/tactical_scenes?campaign_id=eq.${campaignId}&select=name,is_active`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ name: string; is_active: boolean }>
        return rows.find(r => r.name === sceneBName)?.is_active
      }, {
        timeout: 15_000,
        message: `Scene "${sceneBName}" did not become is_active=true after clicking it in the Tactical Map dropdown`,
      }).toBe(true)
    } finally {
      if (campaignId && gmCreds) {
        // CASCADE DELETE cleans up all tactical_scenes for this campaign.
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })
})
