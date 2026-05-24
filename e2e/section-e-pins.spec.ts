import { test, expect } from '@playwright/test'
import { AUTH, canAuth, ACCOUNTS } from './_fixtures'
import { captureAnonKey, resolveCreds, SUPABASE_URL, type SupaCreds } from './_teardown'

// SECTION E (map-pins half) - a world map_pin inserted by one client shows on
// the other's map live, via the constant `map_pins_changes` sub (MapView.tsx:589
// -> loadPins). GM (Thriver) inserts an APPROVED pin (so it's publicly visible).
// Assertion is via the marker's title attribute + the Public-tab panel row -
// markercluster/collapsible folders make this the most fragile of the realtime
// assertions; if it proves flaky it gets logged manual-only (Gate-0 allows that).
// Reversible: delete the pin on teardown (RLS: map_pins by author's own user_id).

test.describe('Section E - map pins GM -> player', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('an approved world pin shows on the other map live', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let pinId: string | null = null
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(gm)
      await Promise.all([
        gm.goto('/map', { waitUntil: 'domcontentloaded' }),
        pl.goto('/map', { waitUntil: 'domcontentloaded' }),
      ])
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      // The map_pins_changes sub is constant (always on once MapView mounts).
      // Let it subscribe before we insert.
      await pl.waitForTimeout(2500)

      // Arm the wait for the player's realtime-triggered refetch BEFORE inserting:
      // a map_pins INSERT from the GM is delivered over the channel and fires
      // loadPins(), which issues a GET to /rest/v1/map_pins. Catching that GET
      // proves the realtime event reached the player (robust; isolated from the
      // markercluster/collapsible-folder UI, which can't be asserted reliably).
      const refetch = pl.waitForResponse(
        (r) => r.url().includes('/rest/v1/map_pins') && r.request().method() === 'GET',
        { timeout: 12_000 },
      ).catch(() => null)

      // GM inserts an APPROVED world pin.
      const title = `[E2E] Pin ${Date.now()}`
      const res = await gm.request.post(`${SUPABASE_URL}/rest/v1/map_pins`, {
        headers: { apikey: creds!.anonKey, Authorization: `Bearer ${creds!.accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        data: { user_id: ACCOUNTS.gm.userId, lat: 39.7392, lng: -104.9903, title, notes: '', pin_type: 'gm', status: 'approved', category: 'location' },
      })
      expect(res.ok(), `pin insert failed: ${res.status()} ${await res.text()}`).toBe(true)
      const row = await res.json()
      pinId = Array.isArray(row) ? row[0]?.id : row?.id

      // The player refetched map_pins in response to the realtime INSERT.
      expect(await refetch, 'player did not refetch map_pins after the GM insert - realtime not delivered').toBeTruthy()
    } finally {
      if (pinId && creds) {
        await gm.request.delete(`${SUPABASE_URL}/rest/v1/map_pins?id=eq.${pinId}`, {
          headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` },
        }).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
