import { test, expect } from '@playwright/test'
import { AUTH, ACCOUNTS, canAuth } from './_fixtures'
import { captureAnonKey, resolveCreds, SUPABASE_URL, type SupaCreds } from './_teardown'

// MESSAGES - DM realtime delivery (Sys O). GM sends a direct message; the
// recipient's OPEN thread must render it live. The messages page subscribes to
// postgres_changes INSERT on `messages` filtered by conversation_id
// (app/messages/page.tsx:190-206), and `messages` is in the realtime
// publication - so we send via the GM's own REST session (the same insert the
// UI does, app/messages/page.tsx:214) and assert the body lands in marv's
// thread with no reload. Robust + isolated (no <canvas>, no app edits).
//
// TEARDOWN CAVEAT (Xero-approved 2026-05-27): `messages` has insert + select
// RLS but NO delete policy yet, so a sent DM cannot be torn down. The teardown
// below ATTEMPTS the delete best-effort: today it no-ops and one tagged
// throwaway DM persists between the disposable test accounts (gm <-> marv, not
// real users) - Xero OK'd that. The moment the pending author-can-delete-own-
// message RLS policy lands (Puffer; routed in todo.md alongside HP's per-message
// delete button), this SAME teardown starts succeeding and the residue stops
// accruing, with no change to this spec.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Messages - DM realtime delivery', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('a DM sent by the GM appears in the recipient thread live (postgres_changes)', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()

    const runId = Date.now().toString(36)
    const bodyText = `[E2E ${runId}] dm realtime ping`
    const gmUserId = ACCOUNTS.gm.userId
    const marvUserId = ACCOUNTS.marv.userId

    let creds: SupaCreds | null = null
    let convId: string | null = null
    let messageId: string | null = null
    try {
      const anonP = captureAnonKey(gm)
      await gm.goto('/messages', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()
      expect(Boolean(gmUserId && marvUserId), 'gm/marv userId missing from _fixtures').toBe(true)

      // GM opens/creates the DM with marv. The RPC is symmetric (reuses any
      // existing gm<->marv conversation) and provisions BOTH participant rows.
      const rpc = await gm.request.post(`${SUPABASE_URL}/rest/v1/rpc/get_or_create_dm`, {
        headers: { ...H(creds!), 'Content-Type': 'application/json' },
        data: { other_user_id: marvUserId },
      })
      expect(rpc.ok(), 'get_or_create_dm RPC failed').toBe(true)
      convId = await rpc.json().catch(() => null)
      expect(typeof convId === 'string' && convId.length > 0, 'no conversation id returned').toBe(true)

      // Recipient (marv) opens THAT conversation so its postgres_changes sub is
      // live - the thread only subscribes once activeConvId is set (page.tsx:159).
      // The send input renders exactly when the thread is open = our "ready" gate.
      await pl.goto(`/messages?conv=${convId}`, { waitUntil: 'domcontentloaded' })
      await expect(
        pl.getByPlaceholder(/send a message/i),
        'marv could not open the conversation (participant row missing?)',
      ).toBeVisible({ timeout: 20_000 })
      await pl.waitForTimeout(2000) // let the realtime channel finish joining before we insert

      // GM sends the DM via its own session (RLS msg_insert: sender = auth.uid()
      // AND a participant). Capture the row id for best-effort teardown.
      const ins = await gm.request.post(`${SUPABASE_URL}/rest/v1/messages`, {
        headers: { ...H(creds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
        data: { conversation_id: convId, sender_user_id: gmUserId, body: bodyText },
      })
      expect(ins.ok(), 'message insert failed (RLS / participant?)').toBe(true)
      const rows = await ins.json().catch(() => [])
      messageId = Array.isArray(rows) && rows[0]?.id ? rows[0].id : null

      // The recipient's OPEN thread must render the message live, no reload.
      await expect(
        pl.getByText(bodyText).first(),
        'DM did not arrive in the recipient thread via realtime (postgres_changes not delivered)',
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      // Best-effort delete of ONLY the message this run created (see header). We
      // never touch the conversation / participant rows - they may pre-date the run.
      if (creds && messageId) {
        await gm.request.delete(`${SUPABASE_URL}/rest/v1/messages?id=eq.${messageId}`, {
          headers: H(creds),
        }).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
