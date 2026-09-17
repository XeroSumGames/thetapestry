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
      /* KEEP THE RESPONSE. This call used to go straight to .json(), throwing
         away the status and body, so every possible cause collapsed into the
         one useless message "INSERT did not return an id" - which reads like a
         schema or PostgREST quirk and sent me hunting a column REVOKE that did
         not exist. The server had said exactly what was wrong; the spec
         discarded it. A fixture step that can fail must report HOW. */
      const lfgRes = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/lfg_posts`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { author_user_id: gmUserId, kind: 'gm_seeking_players', title: tag, body: 'E2E spec - safe to ignore', moderation_status: 'approved' } })
      const lfgStatus = lfgRes.status()
      const lfgBody = (await lfgRes.text()).slice(0, 400)

      /* How many posts this GM has already made in the CURRENT clock hour, to
         name the likeliest cause in the failure message rather than leaving the
         next reader to rediscover it. Approximate ON PURPOSE and labelled as
         such: check_rate_limit increments its counter BEFORE comparing, so it
         also counts attempts that were then DENIED - the real budget can be
         spent while fewer than 5 posts exist. Never assert on this number. */
      const hourStart = new Date(new Date().setMinutes(0, 0, 0)).toISOString()
      const thisHour = await gm.request.get(
        `${SUPABASE_URL}/rest/v1/lfg_posts?author_user_id=eq.${gmUserId}&created_at=gte.${encodeURIComponent(hourStart)}&select=id`,
        { headers: H(gmCreds!) }).then(r => r.json()).then((r: unknown[]) => r?.length ?? -1).catch(() => -1)

      const RATE_HINT = `
  The lfg_posts INSERT policy's WITH CHECK includes check_rate_limit('lfg_post', 5):`
        + ` FIVE per user per CLOCK HOUR. It is the likeliest cause of a 4xx mentioning row-level security here,`
        + ` and running the suite repeatedly inside one hour will spend the budget. That is the abuse control`
        + ` WORKING, not a defect - do NOT raise the limit or clear the rate_limits table to go green.`
        + ` It resets at the top of the hour. Note the counter increments BEFORE it compares, so RETRIES DEEPEN`
        + ` THE DENIAL rather than escaping it - which is why this surfaces as a hard failure and never as flaky.`
        + `
  Posts by this GM in the current hour: ${thisHour} (approximate - denied attempts also consume budget).`

      expect(lfgRes.ok(), `lfg_posts INSERT failed: HTTP ${lfgStatus} ${lfgBody}${RATE_HINT}`).toBeTruthy()
      const lfgInsert = JSON.parse(lfgBody || '[]') as Array<{ id: string }>
      lfgPostId = lfgInsert?.[0]?.id ?? null
      expect(lfgPostId, `lfg_posts INSERT returned HTTP ${lfgStatus} but no row: ${lfgBody}${RATE_HINT}`).toBeTruthy()

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
