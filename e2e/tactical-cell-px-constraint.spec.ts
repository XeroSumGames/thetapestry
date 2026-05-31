import { test, expect } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { captureAnonKey, resolveCreds, SUPABASE_URL, type SupaCreds } from './_teardown'

// DB defense-in-depth - tactical_scenes.cell_px CHECK constraint
// (HP `5845bfd`, range `BETWEEN 5 AND 300`, constraint
// `tactical_scenes_cell_px_range` per `sql/tactical-scenes-cell-px-cap-raise
// -2026-05-30.sql`). cell_px is a SHARED render field - it determines the
// per-cell pixel size every viewer renders the grid + tokens at - so a
// degenerate value (silently written by a buggy popout or a future code path)
// would poison the render for everyone on the scene.
//
// The 2026-05-30 12-check 2-client gate closed GREEN. This spec is the
// regression net for the CHECK behind cell_px's role in that gate: any REST
// write outside [5, 300] MUST be rejected with PG `23514` check_violation,
// and the row MUST be unchanged. Catches both a constraint drop and an off-
// by-one cap raise/lower.
//
// Pure REST, no DOM, no testids, no mutation (the constraint rejects the
// write so there is nothing to tear down). The Arena's active scene is a
// safe read-only target.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Tactical scenes - cell_px CHECK constraint (defense-in-depth)', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('PATCH cell_px outside [5,300] is rejected with 23514 and the row is unchanged', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await ctx.newPage()
    try {
      const anonP = captureAnonKey(gm)
      await gm.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' })
      const creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      // Any Arena tactical scene is fine - the constraint rejects the write so
      // nothing is mutated and no teardown is needed.
      const listRes = await gm.request.get(
        `${SUPABASE_URL}/rest/v1/tactical_scenes?campaign_id=eq.${CAMPAIGN_ID}&select=id,cell_px&limit=1`,
        { headers: H(creds!) },
      )
      const list = await listRes.json().catch(() => [])
      expect(Array.isArray(list) && list.length === 1, 'Arena has no tactical scene').toBe(true)
      const scene = (list as Array<{ id: string; cell_px: number }>)[0]
      const before = scene.cell_px

      const patch = (cell_px: number) => gm.request.patch(
        `${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${scene.id}`,
        { headers: { ...H(creds!), 'Content-Type': 'application/json' }, data: { cell_px } },
      )

      // Above the cap (300) - typical popout-race symptom value.
      const tooBig = await patch(400)
      expect(tooBig.ok(), 'cell_px=400 should be rejected by the CHECK constraint').toBe(false)
      const tooBigBody = await tooBig.text()
      expect(
        tooBigBody,
        `rejection must carry PG 23514 check_violation; got: ${tooBigBody.slice(0, 200)}`,
      ).toMatch(/23514|check/i)

      // Below the floor (5) - mirrors the popout stepper's own min.
      const tooSmall = await patch(4)
      expect(tooSmall.ok(), 'cell_px=4 should be rejected by the CHECK constraint').toBe(false)
      const tooSmallBody = await tooSmall.text()
      expect(tooSmallBody, 'rejection must carry PG 23514 check_violation').toMatch(/23514|check/i)

      // Both rejections were atomic - the row's cell_px is unchanged.
      const afterRes = await gm.request.get(
        `${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${scene.id}&select=cell_px`,
        { headers: H(creds!) },
      )
      const after = (await afterRes.json().catch(() => [])) as Array<{ cell_px: number }>
      expect(after[0]?.cell_px, 'cell_px must be unchanged after rejected writes').toBe(before)
    } finally {
      await ctx.close()
    }
  })
})
