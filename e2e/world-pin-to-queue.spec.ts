import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth, ACCOUNTS } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch2.1 + moderation-read - a Survivor's world "rumor" pin is pending: it is
// HIDDEN from other players (RLS), VISIBLE to its author, and SURFACED in the
// Thriver moderation queue (we read it, we never approve/reject - bright line).
//
// FINDING (flagged to Xero, not asserted as correct): map_pins moderation is
// CLIENT-set only (MapView.tsx:948 `status: isThriver ? 'approved' : 'pending'`)
// - there is NO BEFORE INSERT trigger enforcing it the way campfire has
// (sql/moderation-enforce-trigger-2026-05-17.sql covers forum_threads/war_stories
// /lfg_posts but NOT map_pins). So a crafted REST insert can self-approve a world
// pin - the same bypass class the campfire trigger was added (Y3) to close. This
// test therefore mirrors the Survivor client's row shape (rumor/pending) to
// exercise the QUEUE + RLS visibility; it does not (cannot) prove a server gate.
//
// Pin drop is a map-canvas interaction, so we insert via REST (same as
// section-e-pins). Throwaway [E2E]-tagged pin; teardown deletes it (author owns
// the delete_own RLS).

const RUN = `[E2E ${Date.now().toString(36)}]`

async function pinVisibleTo(page: Page, creds: SupaCreds, pinId: string): Promise<boolean> {
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/map_pins?id=eq.${pinId}&select=id`,
    { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
  )
  if (!res.ok()) return false
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length > 0
}

test.describe('Ch2 - World rumor pin: moderation queue + RLS visibility', () => {
  test.skip(!canAuth('gm') || !canAuth('marv') || !canAuth('percy'), 'needs gm + marv + percy sessions/creds')

  test('a Survivor rumor pin is hidden from other players, visible to author, and surfaced in the Thriver queue', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const marvCtx = await browser.newContext({ storageState: AUTH.marv })
    const percyCtx = await browser.newContext({ storageState: AUTH.percy })
    const gm = await gmCtx.newPage()
    const marv = await marvCtx.newPage()
    const percy = await percyCtx.newPage()
    let pinId: string | null = null
    let marvCreds: SupaCreds | null = null
    try {
      const marvAnon = captureAnonKey(marv)
      const percyAnon = captureAnonKey(percy)
      await marv.goto('/map', { waitUntil: 'domcontentloaded' })
      await percy.goto('/map', { waitUntil: 'domcontentloaded' })
      marvCreds = await resolveCreds(marv, marvAnon)
      const percyCreds = await resolveCreds(percy, percyAnon)
      expect(marvCreds, 'could not resolve marv creds').toBeTruthy()
      expect(percyCreds, 'could not resolve percy creds').toBeTruthy()

      // Survivor (marv) drops a world pin -> the client produces rumor/pending.
      const title = `${RUN} Rumor Pin`
      const ins = await marv.request.post(`${SUPABASE_URL}/rest/v1/map_pins`, {
        headers: {
          apikey: marvCreds!.anonKey, Authorization: `Bearer ${marvCreds!.accessToken}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        data: {
          user_id: ACCOUNTS.marv.userId, lat: 39.0012, lng: -75.5012,
          title, notes: `${RUN} automated, safe to remove.`,
          pin_type: 'rumor', status: 'pending', category: 'location',
        },
      })
      expect(ins.ok(), `pin insert failed: ${ins.status()} ${await ins.text()}`).toBe(true)
      pinId = (await ins.json())[0].id

      // RLS visibility: author sees own pending pin; another player does NOT.
      expect(await pinVisibleTo(marv, marvCreds!, pinId!), 'author should see their own pending pin').toBe(true)
      expect(await pinVisibleTo(percy, percyCreds!, pinId!), 'a pending pin must be hidden from another player').toBe(false)

      // Thriver (gm) sees it in the moderation Rumor Queue. The console defaults
      // to the Users section (page.tsx:76); the rumor pins are already loaded on
      // mount (the [filter] effect), so we just switch sections. The tab is a
      // client onClick, so a click can land before hydration - retry-click until
      // the rumors section actually shows the pin (default filter is 'pending').
      await gm.goto('/moderate', { waitUntil: 'domcontentloaded' })
      const rumorTab = gm.getByRole('button', { name: /rumor queue/i })
      await rumorTab.waitFor({ state: 'visible', timeout: 15_000 })
      await expect(async () => {
        await rumorTab.click().catch(() => {})
        await expect(gm.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 3_000 })
      }, 'pending rumor pin should appear in the Thriver moderation queue').toPass({ timeout: 25_000 })
    } finally {
      if (pinId && marvCreds) {
        await marv.request.delete(
          `${SUPABASE_URL}/rest/v1/map_pins?id=eq.${pinId}`,
          { headers: { apikey: marvCreds.anonKey, Authorization: `Bearer ${marvCreds.accessToken}` } },
        ).catch(() => {})
      }
      await gmCtx.close()
      await marvCtx.close()
      await percyCtx.close()
    }
  })
})
