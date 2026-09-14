import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, getInviteCode, resolveCreds, type SupaCreds } from './_teardown'

// Wall-segment doors + windows: cross-client toggle propagation - regression
// net for `tasks/finding-wall-segment-doors-player-write-2026-05-31.md`.
//
// THE BUG (2026-05-31 playtest, Xero report): a non-GM player clicks a
// wall-segment door, the door opens on THEIR client only - other clients still
// see it closed. LoS desync between players at the table. Root cause:
// components/TacticalMap.tsx:537 scheduleWallsPersist gates the DB write on
// isGM, so player toggles never persist to tactical_scenes.walls; nothing for
// postgres_changes to fan out. Same path serves window-segment toggles, so the
// bug affects both kinds.
//
// FIX (Puffer, pending HP commit): SECURITY DEFINER RPC
// `toggle_wall_segment_door(p_scene_id, p_segment_id, p_open)` -
// campaign-membership authz (not GM-only), read-modify-write
// `tactical_scenes.walls` to flip the segment's door_open. Same envelope as
// gm_apply_damage.
//
// SCOPE OF THIS SPEC (the automatable slice):
//   - the player can call the RPC + the row reflects the new door_open;
//   - a SECOND client's tactical_scenes refetch fires within realtime SLA;
//   - covers BOTH door and window segments (same fix covers both per finding).
// What stays MANUAL: the canvas LoS sweep + fog clearing through the opening
// (canvas pixels, not Playwright-assertable; manual 2-client check at the
// table covers it).
//
// PARKED VIA test.fixme until HP ships the RPC (mirrors the PC-trade
// regression-net pattern). When the RPC lands on prod, un-fixme; the test
// then either passes (fix correct) or fails red (regression).

const RUN = `[E2E ${Date.now().toString(36)}]`
const MARV_CHAR = '54982e08-1dc9-49c9-b916-3ea86e02126f' // marv: "Mikey Shevik"
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

interface WallSegment {
  id: string
  x1: number; y1: number; x2: number; y2: number
  kind: 'wall' | 'door' | 'window'
  door_open?: boolean
}

// Throwaway-campaign + marv-as-member setup (mirrors combat-flow.spec).
async function setupThrowawayWithMarv(opts: {
  gm: Page; pl: Page; gmCreds: SupaCreds; plCreds: SupaCreds; name: string
}): Promise<{ campaignId: string }> {
  const { gm, pl, gmCreds, plCreds, name } = opts
  await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
  await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(name)
  await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
  await gm.getByRole('button', { name: /^create story$/i }).click()
  await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
  const campaignId = gm.url().split('/stories/')[1]
  expect(campaignId, 'no campaign id in landing URL').toBeTruthy()
  const inviteCode = await getInviteCode(gm, campaignId, gmCreds)
  expect(inviteCode, 'campaign has no invite_code').toBeTruthy()
  // marv joins by code so he's a campaign member (the RPC's authz check).
  await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
  await pl.getByPlaceholder('XXXXXX').fill(inviteCode!)
  await pl.getByRole('button', { name: /join/i }).first().click()
  await pl.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 20_000 })
  // Wire marv's PC so any future state writes have a target.
  await pl.request.patch(
    `${SUPABASE_URL}/rest/v1/campaign_members?campaign_id=eq.${campaignId}&user_id=eq.${(await pl.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers: H(plCreds) })).json().then((u: any) => u.id)}`,
    { headers: { ...H(plCreds), 'Content-Type': 'application/json' }, data: { character_id: MARV_CHAR } },
  ).catch(() => { /* best-effort, not required for the wall test */ })
  return { campaignId }
}

test.describe('Tactical map - wall-segment door + window cross-client propagation', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  // HP shipped the toggle_wall_segment_door SECURITY DEFINER RPC in b2e7663
  // (applied live; lib/data/tactical.ts exports the typed builder). Un-fixme'd
  // 2026-05-31: the spec is now the live regression net for the cross-client
  // door/window propagation that this morning's playtest exposed.

  test('player toggles a door + window segment -> DB reflects + GM tactical_scenes refetches via realtime', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let campaignId: string | null = null
    let gmCreds: SupaCreds | null = null
    try {
      const gmAnonP = captureAnonKey(gm)
      const plAnonP = captureAnonKey(pl)
      gmCreds = await resolveCreds(gm, gmAnonP)
      const plCreds = await resolveCreds(pl, plAnonP)
      expect(gmCreds && plCreds, 'could not resolve gm + marv creds').toBeTruthy()

      const setup = await setupThrowawayWithMarv({
        gm, pl, gmCreds: gmCreds!, plCreds: plCreds!, name: `${RUN} Wall-seg`,
      })
      campaignId = setup.campaignId

      // GM seeds a scene with one DOOR + one WINDOW segment, both closed. GM
      // owns the campaign -> direct INSERT is RLS-allowed.
      const doorId = crypto.randomUUID()
      const windowId = crypto.randomUUID()
      const walls: WallSegment[] = [
        { id: doorId,   x1: 5,  y1: 5,  x2: 5,  y2: 6,  kind: 'door',   door_open: false },
        { id: windowId, x1: 10, y1: 10, x2: 10, y2: 11, kind: 'window', door_open: false },
      ]
      const sceneIns = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/tactical_scenes`,
        {
          headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: `${RUN} Door-test scene`, is_active: true, grid_cols: 20, grid_rows: 20, cell_px: 35, walls },
        },
      )
      expect(sceneIns.ok(), `tactical_scenes INSERT failed: ${sceneIns.status()} ${await sceneIns.text()}`).toBe(true)
      const sceneId = (await sceneIns.json() as Array<{ id: string }>)[0].id

      // Both clients open the table so their tactical channels are live.
      await Promise.all([
        gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
        pl.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' }),
      ])
      // Give realtime subs a beat to attach before the test mutation.
      await pl.waitForTimeout(2500)

      // Helper: assert toggle of a single segment ends with the segment's
      // door_open === expected, AND the GM (other client) refetches via
      // realtime (same shape as section-a3 / Phase C's character_states pattern).
      const assertToggle = async (segmentId: string, expectedOpen: boolean, kindLabel: string) => {
        // Arm the GM's realtime-triggered refetch BEFORE the mutation - the
        // tactical_scenes postgres_changes sub fires loadScenes on UPDATE.
        const refetch = gm.waitForResponse(
          (r) => r.url().includes('/rest/v1/tactical_scenes') && r.request().method() === 'GET',
          { timeout: 12_000 },
        ).catch(() => null)
        // The player calls the RPC. With the fix shipped, this writes
        // tactical_scenes.walls server-side, atomically + authz-checked.
        const rpc = await pl.request.post(
          `${SUPABASE_URL}/rest/v1/rpc/toggle_wall_segment_door`,
          {
            headers: { ...H(plCreds!), 'Content-Type': 'application/json' },
            data: { p_scene_id: sceneId, p_segment_id: segmentId, p_open: expectedOpen },
          },
        )
        expect(
          rpc.ok(),
          `toggle_wall_segment_door RPC (${kindLabel}, segment=${segmentId}, open=${expectedOpen}) failed: ${rpc.status()} ${await rpc.text()}`,
        ).toBe(true)
        // DB converges: the segment's door_open flips.
        await expect.poll(
          async () => {
            const r = await gm.request.get(
              `${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${sceneId}&select=walls`,
              { headers: H(gmCreds!) },
            )
            const rows = await r.json().catch(() => []) as Array<{ walls: WallSegment[] | null }>
            const seg = (rows?.[0]?.walls ?? []).find(w => w.id === segmentId)
            return seg?.door_open ?? null
          },
          { timeout: 8_000, message: `${kindLabel} segment door_open did not converge to ${expectedOpen}` },
        ).toBe(expectedOpen)
        // GM's tactical_scenes sub fired the refetch (the second-client
        // propagation half of the bug - without the fix, no UPDATE = no event
        // = no refetch on the GM).
        expect(
          await refetch,
          `GM did not refetch tactical_scenes after player ${kindLabel} toggle (realtime UPDATE not fired)`,
        ).toBeTruthy()
      }

      // Cover the DOOR segment toggle (the headline bug).
      await assertToggle(doorId, true, 'door')

      // Cover the WINDOW segment toggle (same fix per finding's "Bonus catch"
      // section - regression net for both kinds in one spec).
      await assertToggle(windowId, true, 'window')
    } finally {
      // Cascade-delete the throwaway campaign (FKs include tactical_scenes).
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
