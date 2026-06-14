import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// Scene CRUD REST contract: GMs can create, read, rename, and delete tactical
// scenes for campaigns they own. RLS: "GM can manage scenes" (ALL where
// gm_user_id = auth.uid()). This spec drives those four operations directly
// via REST, asserts DB state at each step, and CASCADE-deletes via the parent
// campaign in teardown.
//
// No UI, no realtime - pure table-layer contract.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Scene CRUD - REST contract', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM can create, read, rename, and delete tactical scenes for their campaign', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await ctx.newPage()
    let campaignId: string | null = null
    let sceneAlphaId: string | null = null
    let gmCreds: SupaCreds | null = null

    try {
      const gmAnonP = captureAnonKey(gm)
      await gm.goto('/campfire', { waitUntil: 'domcontentloaded' })
      gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()

      const gmUserId = userIdFromToken(gmCreds!.accessToken)
      expect(gmUserId, 'could not derive GM user id from JWT').toBeTruthy()

      const tag = `E2E-SC-${Date.now().toString(36)}`

      // Throwaway campaign. invite_code has no DEFAULT in the schema - must supply.
      const campInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaigns`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { gm_user_id: gmUserId, name: `${tag}-campaign`, invite_code: tag } },
      )).json() as Array<{ id: string }>
      campaignId = campInsert?.[0]?.id ?? null
      expect(campaignId, 'campaigns INSERT did not return an id').toBeTruthy()

      // Step 1a: INSERT Scene Alpha
      const alphaInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/tactical_scenes`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: 'Scene Alpha', grid_cols: 20, grid_rows: 15, cell_feet: 3, cell_px: 35 } },
      )).json() as Array<{ id: string }>
      sceneAlphaId = alphaInsert?.[0]?.id ?? null
      expect(sceneAlphaId, 'tactical_scenes INSERT (Alpha) did not return an id').toBeTruthy()

      // Step 1b: INSERT Scene Beta
      const betaInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/tactical_scenes`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: 'Scene Beta', grid_cols: 20, grid_rows: 15, cell_feet: 3, cell_px: 35 } },
      )).json() as Array<{ id: string }>
      const sceneBetaId = betaInsert?.[0]?.id ?? null
      expect(sceneBetaId, 'tactical_scenes INSERT (Beta) did not return an id').toBeTruthy()

      // Step 2: READ - both scenes exist
      const allScenes = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/tactical_scenes?campaign_id=eq.${campaignId}&select=id,name`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ id: string; name: string }>
      expect(allScenes.length, 'expected 2 scenes after both INSERTs').toBe(2)
      expect(allScenes.map(s => s.name).sort()).toEqual(['Scene Alpha', 'Scene Beta'])

      // Step 3: UPDATE - rename Alpha to 'Scene Renamed'
      await gm.request.patch(
        `${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${sceneAlphaId}`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' },
          data: { name: 'Scene Renamed' } },
      )

      // Verify rename persisted
      const renamed = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${sceneAlphaId}&select=name`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ name: string }>
      expect(renamed?.[0]?.name, 'scene name did not update after PATCH').toBe('Scene Renamed')

      // Step 4: DELETE Alpha
      await gm.request.delete(
        `${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${sceneAlphaId}`,
        { headers: H(gmCreds!) },
      )
      sceneAlphaId = null // already gone - prevent double-delete in teardown

      // Verify only Beta remains
      const remaining = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/tactical_scenes?campaign_id=eq.${campaignId}&select=id,name`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ id: string; name: string }>
      expect(remaining.length, 'expected only 1 scene after Alpha deleted').toBe(1)
      expect(remaining[0]?.name, 'wrong scene remained after Alpha deleted').toBe('Scene Beta')
    } finally {
      if (campaignId && gmCreds) {
        // CASCADE DELETE: campaign -> tactical_scenes (and any other child rows)
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })
})
