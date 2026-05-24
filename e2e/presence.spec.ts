import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, accessTokenFromContext, userIdFromToken, type SupaCreds } from './_teardown'

// Ch1.3 + Sys A - Global presence. The Sidebar renders "Survivors present: N"
// off the cross-platform `global_presence` realtime channel (Sidebar.tsx:144,
// keyed by user.id so each distinct human is one key). A Thriver additionally
// gets a hover popup ("Online now") listing WHO is present, resolved from the
// present user_ids -> profiles.username (Sidebar.tsx:86-96); Survivors see only
// the count (presence-style anonymity).
//
// Read-only + realtime - NO writes, NO teardown. We open three real sessions
// (gm = Thriver observer, marv + percy = two players) on a sidebar route, then
// assert on the GM's sidebar: (1) the count reflects multiple live users, and
// (2) the Thriver hover-list names the two players who are online.
//
// HONEST NOTE on the count: prod may have real users online too, so the count
// is asserted as ">= our test trio", not an exact N (other users only inflate
// it). The SUBSTANTIVE correctness check is the hover-list naming marv + percy
// specifically - that proves the user_id -> username resolution + the Thriver
// gate, independent of whatever else is online.

async function usernameOf(page: Page, creds: SupaCreds, userId: string): Promise<string | null> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return null
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows[0]?.username ? (rows[0].username as string) : null
}

// A sidebar-bearing authenticated route (LayoutShell renders Sidebar for any
// non-full-width, non-NO_SIDEBAR page - /characters qualifies). The Sidebar
// subscribes each context to global_presence on mount.
const SIDEBAR_ROUTE = '/characters'

test.describe('Ch1.3 - Global presence ("Survivors present" + Thriver roster)', () => {
  test.skip(!canAuth('gm') || !canAuth('marv') || !canAuth('percy'), 'needs gm + marv + percy sessions/creds')

  test('GM + 2 players online -> sidebar count reflects them + Thriver hover-list names them', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const marvCtx = await browser.newContext({ storageState: AUTH.marv })
    const percyCtx = await browser.newContext({ storageState: AUTH.percy })
    const gm = await gmCtx.newPage()
    const marv = await marvCtx.newPage()
    const percy = await percyCtx.newPage()
    try {
      const gmAnonP = captureAnonKey(gm)

      // All three contexts land on a sidebar route -> each subscribes to
      // global_presence with its own user.id key.
      await Promise.all([
        gm.goto(SIDEBAR_ROUTE, { waitUntil: 'domcontentloaded' }),
        marv.goto(SIDEBAR_ROUTE, { waitUntil: 'domcontentloaded' }),
        percy.goto(SIDEBAR_ROUTE, { waitUntil: 'domcontentloaded' }),
      ])

      // Derive each player's user id from its session, then resolve the two
      // usernames via the GM's Thriver creds (the Thriver can read every
      // profile - the same read the hover-list itself does; a player's REST
      // self-read of profiles comes back empty under RLS).
      const gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()
      const marvToken = await accessTokenFromContext(marvCtx)
      const percyToken = await accessTokenFromContext(percyCtx)
      const marvId = marvToken ? userIdFromToken(marvToken) : null
      const percyId = percyToken ? userIdFromToken(percyToken) : null
      expect(marvId, 'could not derive marv user id').toBeTruthy()
      expect(percyId, 'could not derive percy user id').toBeTruthy()
      const marvName = await usernameOf(gm, gmCreds!, marvId!)
      const percyName = await usernameOf(gm, gmCreds!, percyId!)
      expect(marvName, 'marv has no username').toBeTruthy()
      expect(percyName, 'percy has no username').toBeTruthy()

      // (1) GM sidebar shows the count line, reflecting at least our live trio.
      const countLine = gm.getByText(/Survivors present:/i).first()
      await expect(countLine).toBeVisible({ timeout: 15_000 })
      await expect.poll(async () => {
        const txt = (await countLine.textContent()) ?? ''
        const m = txt.match(/Survivors present:\s*(\d+)/i)
        return m ? parseInt(m[1], 10) : 0
      }, { timeout: 25_000, message: 'count never reached the 3 live test users' }).toBeGreaterThanOrEqual(3)

      // (2) Thriver hover-list. Hovering the count line opens the "Online now"
      // popup; the username resolution is async on each presence sync, so
      // retry hover-until-popup. (gm is the Thriver; Survivors get no popup.)
      await expect(async () => {
        await countLine.hover()
        await expect(gm.getByText('Online now', { exact: false }).first()).toBeVisible({ timeout: 2_000 })
      }, 'Thriver hover-list popup should open over the count line').toPass({ timeout: 25_000 })

      // Mouse is still over the count line -> popup open. Both players are named.
      await expect(gm.getByText(marvName!, { exact: false }).first(), 'hover-list should name marv').toBeVisible()
      await expect(gm.getByText(percyName!, { exact: false }).first(), 'hover-list should name percy').toBeVisible()
    } finally {
      await gmCtx.close()
      await marvCtx.close()
      await percyCtx.close()
    }
  })
})
