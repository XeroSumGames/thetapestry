import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth, CAMPAIGN_ID } from './_fixtures'
import { captureAnonKey, resolveCreds, SUPABASE_URL, type SupaCreds } from './_teardown'

// TACTICAL-MAP RENDER FIX - 2-client acceptance (the automatable slice).
//
// Backs the P0 render-model fix that made the Minnie S7 playtest unplayable.
//   Spec: tasks/tactical-map-render-fix-spec-2026-05-26.md (Puffer).
//   HP impl LANDED: 6ef34ce (shared + authoritative img_scale, kills per-client
//   divergence), fca10a6 (locked-map "Center" escape hatch for players),
//   dc6eea6 (active-scene query .single -> .maybeSingle).
//
// HONEST SCOPE: the map is a <canvas>, so the PIXEL invariants from the spec's
// section-7 plan ("a far-edge token sits ON the art, not in black", "everyone
// sees the same composite") are NOT pixel-assertable from Playwright. Those stay
// a MANUAL 2-client check: tasks/imgscale-divergence-testplan-2026-05-26.md (HP).
// What IS deterministic and worth guarding in CI - and what this spec covers:
//
//   1. LOCKED-MAP ESCAPE HATCH (spec 4.5 / fca10a6). A locked map must never
//      strand a player. With the active scene locked, a player gets a working
//      "Center" button; the GM (who can already pan) does not.
//
//   2. SHARED + AUTHORITATIVE RENDER STATE (spec 4.A + section-9). Where the
//      background sits relative to the grid is a property of the SCENE, the same
//      for every viewer - never re-derived per client. So a GM session and a
//      player session must read the render-determining fields IDENTICALLY. This
//      also proves the scale-sentinel migration columns (natural_w/h) are live.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

// Everything that determines bg-to-grid placement. img_scale is nullable (the
// sentinel from the migration); the rest are integers.
const RENDER_FIELDS = 'id,img_scale,grid_cols,grid_rows,cell_px,natural_w,natural_h'

const CENTER_TITLE = 'Center the map on your token' // fca10a6 button title (stable selector, no testid)

// The scene the player actually renders when they open the map is the ACTIVE
// one (TacticalMap loadScenes -> setMapLocked(active.is_locked)). No fallback to
// "any scene" - locking a scene the player isn't viewing proves nothing.
async function activeSceneId(page: Page, creds: SupaCreds): Promise<string | null> {
  const r = await page.request.get(
    `${SUPABASE_URL}/rest/v1/tactical_scenes?campaign_id=eq.${CAMPAIGN_ID}&is_active=is.true&select=id&limit=1`,
    { headers: H(creds) },
  )
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) && rows.length === 1 ? rows[0].id : null
}

test.describe('Tactical-map render fix - 2-client acceptance', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('locked map -> player gets a working Center escape hatch; GM does not', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let creds: SupaCreds | null = null
    let sceneId: string | null = null
    let originalLocked: boolean | null = null
    try {
      const anonP = captureAnonKey(gm)
      await gm.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      sceneId = await activeSceneId(gm, creds!)
      test.skip(!sceneId, 'Arena has no ACTIVE tactical scene to lock')

      // Record the current lock state, then lock (GM owns the campaign -> RLS
      // permits the UPDATE). Restored in finally - this is the only mutation.
      const before = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${sceneId}&select=is_locked`,
        { headers: H(creds!) },
      )).json().catch(() => [])
      originalLocked = before?.[0]?.is_locked ?? false
      const lock = await gm.request.patch(`${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${sceneId}`, {
        headers: { ...H(creds!), 'Content-Type': 'application/json' }, data: { is_locked: true },
      })
      expect(lock.ok(), 'GM could not lock the scene (RLS?)').toBe(true)

      // Player opens the table AFTER the lock, then mounts the map -> loadScenes
      // reads is_locked=true -> mapLocked -> the player-only Center button shows.
      await pl.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' })
      await pl.getByRole('button', { name: /tactical map/i }).first().click().catch(() => {})

      const centerBtn = pl.getByTitle(CENTER_TITLE)
      await expect(
        centerBtn,
        'player on a LOCKED map has no Center escape hatch - they would be stranded',
      ).toBeVisible({ timeout: 20_000 })

      // The hatch must actually work: a programmatic recenter bypasses the
      // pan-lock. Clicking must not tear down the map.
      await centerBtn.click()
      await expect(centerBtn, 'clicking Center crashed/unmounted the map').toBeVisible()

      // It is a PLAYER-only affordance (the GM can already pan freely). Mount the
      // GM's map on the same locked scene and confirm the button never leaks.
      await gm.getByRole('button', { name: /tactical map/i }).first().click().catch(() => {})
      await gm.waitForTimeout(1500)
      await expect(
        gm.getByTitle(CENTER_TITLE),
        'the player-only Center button leaked to the GM',
      ).toHaveCount(0)
    } finally {
      if (creds && sceneId && originalLocked !== null) {
        await gm.request.patch(`${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${sceneId}`, {
          headers: { ...H(creds), 'Content-Type': 'application/json' }, data: { is_locked: originalLocked },
        }).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })

  test('render-determining scene fields are one shared value, read identically by GM and player', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    try {
      const gmAnon = captureAnonKey(gm)
      const plAnon = captureAnonKey(pl)
      await Promise.all([
        gm.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' }),
        pl.goto(`/stories/${CAMPAIGN_ID}/table`, { waitUntil: 'domcontentloaded' }),
      ])
      const gmCreds = await resolveCreds(gm, gmAnon)
      const plCreds = await resolveCreds(pl, plAnon)
      expect(gmCreds && plCreds, 'could not resolve GM + player creds').toBeTruthy()

      const sceneId = await activeSceneId(gm, gmCreds!)
      test.skip(!sceneId, 'Arena has no ACTIVE tactical scene')

      const read = async (page: Page, creds: SupaCreds) => {
        const r = await page.request.get(
          `${SUPABASE_URL}/rest/v1/tactical_scenes?id=eq.${sceneId}&select=${RENDER_FIELDS}`,
          { headers: H(creds) },
        )
        // A 400 here = a render-determining column is missing (migration rolled
        // back?) - that is itself the regression, so surface it as a failure.
        expect(r.ok(), 'render-fields select failed - a column is missing (migration?)').toBe(true)
        const rows = await r.json().catch(() => [])
        expect(Array.isArray(rows) && rows.length === 1, 'active scene not visible to this session').toBe(true)
        return rows[0] as Record<string, unknown>
      }
      const gmRow = await read(gm, gmCreds!)
      const plRow = await read(pl, plCreds!)

      // The crux of the fix: bg-to-grid placement is a SCENE property, identical
      // for every viewer - never per-client. A GM session and a player session
      // must read byte-identical render state. (Canvas pixels stay manual; this
      // guards the DATA both clients render from.)
      expect(
        plRow,
        'GM and player read DIFFERENT render state - the bg would sit differently per viewer (the exact divergence the fix removes)',
      ).toEqual(gmRow)

      // Scale-sentinel migration is live (columns present) and the shared values
      // are well-formed. img_scale is nullable (typeof null === 'object').
      expect(gmRow, 'natural_w column missing - scale-sentinel migration not live').toHaveProperty('natural_w')
      expect(gmRow, 'natural_h column missing - scale-sentinel migration not live').toHaveProperty('natural_h')
      expect(['number', 'object'], 'img_scale is neither a number nor null').toContain(typeof gmRow.img_scale)
      expect(typeof gmRow.grid_cols, 'grid_cols not numeric').toBe('number')
      expect(typeof gmRow.grid_rows, 'grid_rows not numeric').toBe('number')
      expect(typeof gmRow.cell_px, 'cell_px not numeric').toBe('number')
    } finally {
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
