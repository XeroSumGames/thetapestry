import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// LFG interest notification contract: when a player marks interest in a GM's
// LFG post via an lfg_interests INSERT, the DB trigger notify_lfg_interest
// fires and creates a notifications row for the post author with
// type='lfg_interest', title='New interest on your LFG post', and a link
// pointing to /campfire/lfg#lfg-{postId}.
//
// This spec drives the trigger via REST INSERT (same table-level path as the
// UI's toggleInterest() function). No campaign or session needed.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('LFG interest notification trigger', () => {
  test.skip(!canAuth('gm') || !canAuth('marv'), 'needs gm + marv sessions/creds')

  test('player interest on LFG post fires lfg_interest notification to post author', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const plCtx = await browser.newContext({ storageState: AUTH.marv })
    const gm = await gmCtx.newPage()
    const pl = await plCtx.newPage()
    let lfgPostId: string | null = null
    let gmCreds: SupaCreds | null = null
    let gmUserId: string | null = null
    try {
      // Navigate to a lightweight page so cookies are fully initialised in both
      // contexts before we read them via resolveCreds.
      const gmAnonP = captureAnonKey(gm)
      const plAnonP = captureAnonKey(pl)
      await gm.goto('/campfire/lfg', { waitUntil: 'domcontentloaded' })
      await pl.goto('/campfire/lfg', { waitUntil: 'domcontentloaded' })
      gmCreds = await resolveCreds(gm, gmAnonP)
      const plCreds = await resolveCreds(pl, plAnonP)
      expect(gmCreds && plCreds, 'could not resolve gm + marv creds').toBeTruthy()

      gmUserId = userIdFromToken(gmCreds!.accessToken)
      const marvUserId = userIdFromToken(plCreds!.accessToken)
      expect(gmUserId, 'could not derive GM user id from JWT').toBeTruthy()
      expect(marvUserId, 'could not derive Marv user id from JWT').toBeTruthy()

      // GM REST-INSERT an LFG post. moderation_status='approved' is the default
      // in the schema but explicit here so RLS lfg_select_approved lets Marv
      // see it (required for the lfg_int_insert policy's NOT EXISTS sub-check).
      const tag = `E2E-LFG-${Date.now().toString(36)}`
      const lfgInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/lfg_posts`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { author_user_id: gmUserId, kind: 'gm_seeking_players', title: tag, body: 'E2E spec - safe to ignore', moderation_status: 'approved' } },
      )).json() as Array<{ id: string }>
      lfgPostId = lfgInsert?.[0]?.id ?? null
      expect(lfgPostId, 'lfg_posts INSERT did not return an id').toBeTruthy()

      // Marv REST-INSERT an interest. RLS lfg_int_insert enforces:
      //   interested_user_id = auth.uid() (Marv's session)
      //   AND post NOT authored by Marv (prevents self-interest)
      // The trigger notify_lfg_interest fires AFTER INSERT (SECURITY DEFINER)
      // and inserts a notifications row for the post author (GM).
      const intResp = await pl.request.post(
        `${SUPABASE_URL}/rest/v1/lfg_interests`,
        { headers: { ...H(plCreds!), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          data: { post_id: lfgPostId, interested_user_id: marvUserId } },
      )
      expect(intResp.status(), `lfg_interests INSERT returned ${intResp.status()}`).toBeLessThan(300)

      // Poll notifications for the GM. The trigger creates:
      //   type='lfg_interest', title='New interest on your LFG post',
      //   link='/campfire/lfg#lfg-{postId}'
      // RLS notifications_select: user_id = auth.uid() -> GM sees own rows.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${gmUserId}&type=eq.lfg_interest&link=like.*${lfgPostId}*&select=id,type,title,link`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ id: string; type: string; title: string; link: string }>
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
      }, { timeout: 15_000, message: 'lfg_interest notification did not appear for GM after Marv expressed interest' }).toMatchObject({
        type: 'lfg_interest',
        title: 'New interest on your LFG post',
        link: expect.stringContaining(lfgPostId!),
      })
    } finally {
      if (lfgPostId && gmCreds) {
        // lfg_interests CASCADE-deleted by ON DELETE CASCADE on lfg_posts.
        // The triggered notification row is GM's own data and is NOT teardown'd
        // (it is noise on the test account, not real user data).
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/lfg_posts?id=eq.${lfgPostId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await gmCtx.close()
      await plCtx.close()
    }
  })
})
