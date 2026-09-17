import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, getInviteCode, resolveCreds, type SupaCreds } from './_teardown'

/**
 * SCENE DESYNC ON RELOAD - the behaviour behind `campaigns.shared_scene_id`.
 *
 * The bug this covers broke at a real table mid-session. `sharedSceneId` used
 * to be set ONLY by the `tactical_shared` broadcast, so any tab that missed
 * that broadcast - a refresh, a fresh load, a late joiner - had nothing to
 * hydrate from and sat on whatever scene was `is_active`, which is the GM's
 * private prep scene. The column is what a load now hydrates from.
 *
 * SO THE ASSERTION THAT MATTERS IS THE RELOAD PATH, NOT THE BROADCAST PATH.
 * The broadcast already worked; testing it would prove nothing about the fix.
 * Every navigation here is therefore a COLD load with no broadcast in flight.
 *
 * Routed to this lane because it cannot be checked logged out and the table
 * page requires auth. What had been proven before this spec was that the column
 * exists, the code compiles and the route returns 200 - none of which is the
 * behaviour.
 *
 * DISCRIMINATION. The assertion is run twice against the SAME seeded campaign,
 * with `shared_scene_id` set and then NULL, and the two results must DIFFER. A
 * row that only ever checks the fixed state cannot tell "the fix works" from
 * "the banner is always on" or "the player lands there anyway". The column is
 * the only thing that changes between the two reads, so a difference is caused
 * by the column and nothing else.
 *
 * SAFETY: seeds its own throwaway [E2E] campaign and deletes it in `finally`.
 * It never touches THE ARENA or any campaign a person uses.
 *
 * WHAT IS PROVEN, AND HOW. The banner's own render condition is
 * `!isGM && scene && scenes.some(s => s.is_active && s.id !== scene.id)`, so its
 * presence IS the statement "this non-GM is on a scene that is not the active
 * one" - that half is direct. "The player lands on the SHARED scene" is then an
 * inference BY ELIMINATION: this spec seeds exactly two scenes, so "not the
 * active one" leaves only the shared one. That is deliberate, not an oversight.
 * n=2 is guaranteed rather than assumed because the fixture is ours, and closing
 * the gap directly would mean adding a data-testid to app code for something the
 * fixture already settles (hub ruling, 2026-09-16). If this spec ever grows a
 * third scene, that inference dies and the identity must be asserted directly.
 *
 * @deploy-signal - THIS ROW IS EXPECTED TO BE RED AGAINST PROD, DELIBERATELY.
 * The column is live on the shared DB but the hydration code is not deployed
 * under the local-first policy. The red does not say "a feature is missing", it
 * says A PLAYER-FACING BUG THAT BROKE A REAL TABLE IS STILL LIVE IN PRODUCTION,
 * and it turns green on deploy. Count it separately from incidental failures, or
 * it becomes wallpaper and stops being read - which is the whole argument
 * against permanently-red suites, and the only thing that makes this exception
 * safe. To see incidental prod failures alone:
 *     npx playwright test --grep-invert @deploy-signal
 * To see only the deploy signals:
 *     npx playwright test --grep @deploy-signal
 *
 * Run: E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/scene-desync-reload.spec.ts
 */

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })
const J = (c: SupaCreds) => ({ ...H(c), 'Content-Type': 'application/json', Prefer: 'return=minimal' })

const BANNER = /different scene/i

test.describe('Tactical scene desync - a reloading player follows the SHARED scene', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('@deploy-signal shared_scene_id decides what a cold-loading player sees, and the stale banner tracks it', async ({ browser }) => {
    /* Say so in the run output, so a red here is never mistaken for an
       incidental failure by someone reading the log rather than this file. */
    const target = process.env.E2E_BASE_URL ?? 'https://thetapestry.distemperverse.com'
    if (!/localhost|127\.0\.0\.1/.test(target)) {
      console.log(`[deploy-signal] ${target} - if this row FAILS, the scene-desync fix is NOT deployed there `
        + 'and the table-breaking bug is still live for players. It is not an incidental failure.')
    }

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

      // --- GM makes a throwaway campaign and marv joins it -------------------
      const tag = `[E2E ${Date.now().toString(36)}] SceneDesync`
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]

      const inviteCode = await getInviteCode(gm, campaignId!, gmCreds!)
      expect(inviteCode, 'no invite_code for the throwaway campaign').toBeTruthy()
      await pl.goto('/stories/join', { waitUntil: 'domcontentloaded' })
      await pl.getByPlaceholder('XXXXXX').fill(inviteCode!)
      await pl.getByRole('button', { name: /join/i }).first().click()
      await pl.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 20_000 })

      // --- Two scenes: the one the GM SHARED, and the one the GM moved ON to.
      // That is the whole shape of the bug - the GM preps privately on an
      // active scene while players are meant to stay on the shared one.
      const mkScene = async (name: string, isActive: boolean) => {
        await gm.request.post(`${SUPABASE_URL}/rest/v1/tactical_scenes`,
          { headers: J(gmCreds!), data: { campaign_id: campaignId, name, is_active: isActive } })
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/tactical_scenes?campaign_id=eq.${campaignId}&name=eq.${encodeURIComponent(name)}&select=id`,
          { headers: H(gmCreds!) })).json() as Array<{ id: string }>
        expect(rows?.[0]?.id, `scene "${name}" was not created`).toBeTruthy()
        return rows[0].id
      }
      const sharedId = await mkScene('E2E Shared With Players', false)
      const gmOnlyId = await mkScene('E2E GM Private Prep', true)
      /* A THIRD scene that is neither shared nor active, seeded deliberately.
         This spec used to seed two, and at n=2 "the player is not on the active
         scene" leaves only the shared one - so the banner alone was enough to
         infer identity. At n=3 that inference dies: a regression that dumped the
         player on this decoy would STILL raise the banner and STILL pass, because
         the banner only ever says "not the active scene". Rather than keep the
         fixture small enough for the weak assertion to hold, the fixture now makes
         the hard case normal and the identity is measured directly (HP, bd102e18). */
      const decoyId = await mkScene('E2E Decoy - never shared, never active', false)
      expect(new Set([sharedId, gmOnlyId, decoyId]).size, 'three distinct scenes').toBe(3)

      const setShared = async (value: string | null) => {
        const res = await gm.request.patch(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: J(gmCreds!), data: { shared_scene_id: value } })
        expect(res.ok(), `could not write shared_scene_id=${value} (HTTP ${res.status()})`).toBeTruthy()
      }

      /* The player's own tactical toggle is per-campaign localStorage, so this
         puts marv in the tactical view the way a real player would already be
         in it - WITHOUT a broadcast, which is the entire point. Injected before
         any page script runs, so the very first render is already tactical. */
      await pl.addInitScript(([cid]) => {
        try { localStorage.setItem(`tactical_map_view_${cid}`, '1') } catch { /* private mode */ }
      }, [campaignId!])

      /* A FRESH navigation every time: no broadcast, nothing carried over.
         Settling is polled on the MAP, not the banner - waiting on the banner
         itself would make "never rendered" indistinguishable from "not yet
         rendered", and the absent case is half of what this test reads. */
      const coldLoad = async (): Promise<{ sceneId: string; banner: boolean }> => {
        await pl.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
        /* Settle on the scene id being NON-EMPTY rather than on the container
           existing: data-scene-id renders as '' until the client has picked a
           scene, so waiting for the element would read the undecided frame. */
        const holder = pl.locator('[data-scene-id]').first()
        await expect.poll(async () => (await holder.getAttribute('data-scene-id').catch(() => null)) || '',
          { timeout: 30_000, message: 'the player client never settled on a scene' }).not.toBe('')
        const sceneId = (await holder.getAttribute('data-scene-id')) ?? ''
        // The banner renders off the same scene list; give it its own beat so
        // ABSENT means absent rather than not-yet.
        await pl.waitForTimeout(1_500)
        return { sceneId, banner: await pl.getByText(BANNER).first().isVisible().catch(() => false) }
      }

      /* THREE reads, set -> clear -> set, not two.
         A single ordered pair has an obvious confound: if the FIRST cold load
         always showed the banner and later ones did not - a warm cache, a
         sticky client ref, an is_active race - a two-read test would report
         exactly the pattern we are hoping to see and I would have believed it.
         Toggling BACK rules that out: the banner has to follow the column in
         both directions, so "first load" cannot be the explanation. */
      await setShared(sharedId)
      const a = await coldLoad()

      await setShared(null)
      const b = await coldLoad()

      await setShared(sharedId)
      const c = await coldLoad()

      /* FOURTH read, pointing the column at the DECOY.
         a/b/c only ever toggle between two scenes, so an implementation that
         had simply hard-coded "prefer the non-active one" would satisfy all
         three. Pointing shared_scene_id at a third scene forces the client to
         actually FOLLOW the column: there are now two non-active scenes and
         only the column says which. This is the read that makes the identity
         assertion a measurement of the mechanism rather than of a coincidence. */
      await setShared(decoyId)
      const d = await coldLoad()
      expect(d.sceneId,
        'pointing shared_scene_id at a THIRD scene must move the player to it. Landing on the shared-or-active scene instead means the client is not following the column, it is guessing.').toBe(decoyId)
      expect(d.banner,
        'the decoy is not the active scene either, so the player must still be told the GM is elsewhere.').toBe(true)

      const withShared = a.banner, withoutShared = b.banner, withSharedAgain = c.banner

      /* IDENTITY - the direct measurement the banner can only approximate. */
      expect(a.sceneId,
        'with shared_scene_id set, a cold-loading player must hydrate onto the SHARED scene. The GM-private scene here is the original table-breaking bug; the decoy means the banner alone could not have told us which.').toBe(sharedId)
      expect(b.sceneId,
        'with shared_scene_id NULL there is nothing to hydrate from, so the player correctly falls back to the ACTIVE scene.').toBe(gmOnlyId)
      expect(c.sceneId,
        'restoring shared_scene_id must put the player back on the shared scene, or the first read tracked load order rather than the column.').toBe(sharedId)
      expect([a.sceneId, b.sceneId, c.sceneId].includes(decoyId),
        'while the column points elsewhere, no read may land on the decoy - it is neither shared nor active, so displaying it means scene selection is reading neither signal.').toBe(false)

      expect([a.sceneId, b.sceneId, c.sceneId, d.sceneId].join(),
        'the displayed scene must follow shared_scene_id across all three scenes and back').toBe([sharedId, gmOnlyId, sharedId, decoyId].join())

      expect(withShared,
        'with shared_scene_id pointing at a NON-active scene, a cold-loading player must be held on the shared scene and told the GM has moved on. False here means the player silently followed the GM onto their private prep scene - the original table-breaking bug.').toBe(true)

      expect(withoutShared,
        'with shared_scene_id NULL the player falls back to is_active, so there is nothing stale to warn about. True here means the banner is not tracking scene identity at all, and the assertion above would prove nothing.').toBe(false)

      expect(withSharedAgain,
        'restoring shared_scene_id must bring the banner BACK. If this is false while the first read was true, the banner tracked load ORDER rather than the column, and neither of the assertions above means what it appears to mean.').toBe(true)

      expect([withShared, withoutShared, withSharedAgain].join(','),
        'the banner must follow shared_scene_id in both directions').toBe('true,false,true')
    } finally {
      if (campaignId && gmCreds) {
        await gm.request.delete(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) }).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
