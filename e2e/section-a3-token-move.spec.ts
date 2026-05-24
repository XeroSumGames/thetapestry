import { test, expect } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { captureAnonKey, resolveCreds, SUPABASE_URL, type SupaCreds } from './_teardown'

// SECTION A3 - tactical token move propagates GM -> player. TacticalMap's
// scene_tokens postgres sub refetches loadTokens on any change (TacticalMap.tsx:741),
// so we assert the player's realtime-triggered REFETCH (a GET to scene_tokens
// right after the move) - robust + isolated from the <canvas> render, so NO
// canvas bridge / god-component edit is needed. GM moves a token via REST;
// reversible (restore the token's original cell on teardown).

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Section A3 - tactical token move GM -> player', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('a token move triggers a scene_tokens refetch on the player (realtime)', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let token: { id: string; grid_x: number; grid_y: number } | null = null
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(gm)
      await Promise.all([
        gm.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' }),
        pl.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' }),
      ])
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      // Mount the tactical map on both so the scene_tokens sub is active: GM
      // switches + shares; player switches (and follows the share).
      await gm.getByRole('button', { name: /tactical map/i }).first().click().catch(() => {})
      await gm.waitForTimeout(500)
      await gm.getByRole('button', { name: /share map/i }).first().click().catch(() => {})
      await pl.getByRole('button', { name: /tactical map/i }).first().click().catch(() => {})
      await pl.waitForTimeout(3000)

      // Resolve the active scene + a token to move.
      let scenes = await (await gm.request.get(`${SUPABASE_URL}/rest/v1/tactical_scenes?campaign_id=eq.${CAMPAIGN_ID}&is_active=is.true&select=id&limit=1`, { headers: H(creds!) })).json().catch(() => [])
      if (!Array.isArray(scenes) || scenes.length === 0) {
        scenes = await (await gm.request.get(`${SUPABASE_URL}/rest/v1/tactical_scenes?campaign_id=eq.${CAMPAIGN_ID}&select=id&limit=1`, { headers: H(creds!) })).json().catch(() => [])
      }
      expect(Array.isArray(scenes) && scenes.length === 1, 'no tactical scene in Arena').toBe(true)
      const toks = await (await gm.request.get(`${SUPABASE_URL}/rest/v1/scene_tokens?scene_id=eq.${scenes[0].id}&select=id,grid_x,grid_y&limit=1`, { headers: H(creds!) })).json().catch(() => [])
      expect(Array.isArray(toks) && toks.length === 1, 'no token in the scene').toBe(true)
      token = toks[0]

      // Arm the player's refetch wait, then move the token via REST (a
      // scene_tokens UPDATE the player's sub delivers -> loadTokens GET).
      const refetch = pl.waitForResponse(
        (r) => r.url().includes('/rest/v1/scene_tokens') && r.request().method() === 'GET',
        { timeout: 12_000 },
      ).catch(() => null)
      const newX = (token!.grid_x ?? 0) + 1
      const mv = await gm.request.patch(`${SUPABASE_URL}/rest/v1/scene_tokens?id=eq.${token!.id}`, {
        headers: { ...H(creds!), 'Content-Type': 'application/json' }, data: { grid_x: newX },
      })
      expect(mv.ok(), 'token move PATCH failed').toBe(true)
      expect(await refetch, 'player did not refetch scene_tokens after the move - realtime not delivered').toBeTruthy()
    } finally {
      if (token && creds) {
        await gm.request.patch(`${SUPABASE_URL}/rest/v1/scene_tokens?id=eq.${token.id}`, {
          headers: { ...H(creds), 'Content-Type': 'application/json' }, data: { grid_x: token.grid_x, grid_y: token.grid_y },
        }).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
