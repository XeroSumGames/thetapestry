import { test, expect } from '@playwright/test'
import { AUTH, canAuth, ACCOUNTS } from './_fixtures'
import { captureAnonKey, resolveCreds, SUPABASE_URL, type SupaCreds } from './_teardown'

// SECTION E (whispers half) - a whisper posted in one context shows in the
// other's feed live. The whispers_feed sub only mounts when the Whispers tab is
// active (MapView.tsx:446), so both contexts open /map -> Pins panel ->
// Whispers tab first. Post via REST (RLS: author_user_id must equal the poster's
// own uid). Reversible: delete the whisper on teardown (RLS allows Thrivers; GM
// is a Thriver). whispers IS in the realtime publication (verified live).

test.describe('Section E - whispers feed GM -> player', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('a whisper posted in one context shows in the other feed live', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let whisperId: string | null = null
    let creds: SupaCreds | null = null
    try {
      const anonP = captureAnonKey(gm)
      await Promise.all([
        gm.goto('/map', { waitUntil: 'domcontentloaded' }),
        pl.goto('/map', { waitUntil: 'domcontentloaded' }),
      ])
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()

      // Open the Pins panel + switch to the Whispers tab in both contexts
      // (arms the whispers_feed realtime sub + loads the feed).
      for (const p of [gm, pl]) {
        await p.getByRole('button', { name: /^pins$/i }).first().click().catch(() => {})
        await p.waitForTimeout(500)
        await p.getByText(/whispers/i).first().click().catch(() => {})
        await p.waitForTimeout(800)
      }

      // GM posts a whisper via REST (author_user_id must equal the GM's own uid).
      const content = `[E2E] whisper ${Date.now()}`
      const res = await gm.request.post(`${SUPABASE_URL}/rest/v1/whispers`, {
        headers: { apikey: creds!.anonKey, Authorization: `Bearer ${creds!.accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        data: { author_user_id: ACCOUNTS.gm.userId, content },
      })
      expect(res.ok(), `whisper insert failed: ${res.status()} ${await res.text()}`).toBe(true)
      const row = await res.json()
      whisperId = Array.isArray(row) ? row[0]?.id : row?.id

      // Player's whispers feed shows it live, no reload (~2s; 8s headroom).
      await expect(pl.getByText(content).first()).toBeVisible({ timeout: 8_000 })
    } finally {
      if (whisperId && creds) {
        await gm.request.delete(`${SUPABASE_URL}/rest/v1/whispers?id=eq.${whisperId}`, {
          headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` },
        }).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
