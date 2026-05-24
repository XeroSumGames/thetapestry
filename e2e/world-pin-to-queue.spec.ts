import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth, ACCOUNTS } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch2.1 + moderation-read - a Survivor's world "rumor" pin is pending: it is
// HIDDEN from other players (RLS), VISIBLE to its author, and SURFACED in the
// Thriver moderation queue (we read it, we never approve/reject - bright line).
//
// FINDING -> RESOLVED 2026-05-24: map_pins moderation was CLIENT-set only
// (MapView.tsx:948 `status: isThriver ? 'approved' : 'pending'`) with NO BEFORE
// INSERT trigger - a crafted REST insert could self-approve a world pin, the same
// bypass class the campfire trigger closed (Y3). Puffer Fish then applied the
// SECURITY DEFINER trigger `trg_enforce_map_pin_moderation` on prod (mirrors
// sql/moderation-enforce-trigger-2026-05-17.sql). The FIRST test below exercises
// the QUEUE + RLS visibility for a well-formed Survivor rumor pin; the SECOND
// test is the regression net for the fix - it attempts the bypass (Survivor
// inserts {pin_type:'gm', status:'approved'}) and asserts the trigger FORCED it
// back to rumor/pending server-side. Routed to E2E by Puffer once the fix was live.
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

  // Regression net for the moderation-bypass fix (trg_enforce_map_pin_moderation,
  // live on prod 2026-05-24). Mirrors campfire-social's "Survivor cannot
  // self-approve" assertion at the layer that ENFORCES it: a Survivor's own REST
  // insert claiming {pin_type:'gm', status:'approved'} must come back rewritten by
  // the SECURITY DEFINER trigger to rumor/pending - and stay hidden from another
  // player (pending => not in their SELECT). This is the server gate the first
  // test could not prove before the trigger existed.
  test('the DB trigger forces a Survivor self-approved GM world pin to rumor/pending (bypass blocked)', async ({ browser }) => {
    const marvCtx = await browser.newContext({ storageState: AUTH.marv })
    const percyCtx = await browser.newContext({ storageState: AUTH.percy })
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

      // Deliberate bypass attempt: a Survivor crafts a self-approved GM world pin.
      // return=representation reads back the STORED row, i.e. post-trigger values.
      const title = `${RUN} Bypass Attempt`
      const ins = await marv.request.post(`${SUPABASE_URL}/rest/v1/map_pins`, {
        headers: {
          apikey: marvCreds!.anonKey, Authorization: `Bearer ${marvCreds!.accessToken}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        data: {
          user_id: ACCOUNTS.marv.userId, lat: 39.0099, lng: -75.5099,
          title, notes: `${RUN} automated bypass attempt, safe to remove.`,
          pin_type: 'gm', status: 'approved', category: 'location',
        },
      })
      expect(ins.ok(), `pin insert failed: ${ins.status()} ${await ins.text()}`).toBe(true)
      const row = (await ins.json())[0]
      pinId = row.id

      // The trigger overwrote the client-supplied moderation/type fields.
      expect(row.status, 'a non-Thriver self-approved pin must be forced to pending').toBe('pending')
      expect(row.pin_type, 'a non-Thriver gm pin must be forced to rumor').toBe('rumor')

      // Forced-pending => still hidden from another player (RLS SELECT keys on status).
      expect(await pinVisibleTo(percy, percyCreds!, pinId!), 'the forced-pending pin must stay hidden from another player').toBe(false)
    } finally {
      if (pinId && marvCreds) {
        await marv.request.delete(
          `${SUPABASE_URL}/rest/v1/map_pins?id=eq.${pinId}`,
          { headers: { apikey: marvCreds.anonKey, Authorization: `Bearer ${marvCreds.accessToken}` } },
        ).catch(() => {})
      }
      await marvCtx.close()
      await percyCtx.close()
    }
  })
})
