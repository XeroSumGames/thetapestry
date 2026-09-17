import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

/**
 * THE LFG POST RATE LIMIT - an abuse control with, until now, ZERO coverage.
 *
 * `lfg_posts`'s INSERT policy carries
 *     check_rate_limit('lfg_post', 5)
 * which is FIVE posts per user per CLOCK HOUR, counted in the `rate_limits`
 * table on a `date_trunc('hour', now())` bucket. It is the only thing standing
 * between a signed-in user and unlimited posting to a public board, and nothing
 * in this suite asserted it worked. A silent regression - the policy dropped
 * during an RLS edit, the limit raised while debugging and never restored -
 * would have shipped completely unnoticed.
 *
 * It was found the way most of this suite's best rows were found: by a DIFFERENT
 * spec failing for a reason nobody had modelled (2026-09-16, hub diagnosis).
 *
 * WHY THIS RUNS AS percy, AND WHY THAT MATTERS - READ BEFORE REUSING percy:
 * this spec DELIBERATELY EXHAUSTS an account's hourly budget. Any other spec
 * posting LFG as the same account within the same hour would then fail, with a
 * confusing 42501 that looks like an RLS regression. `percy` is used here
 * because no other spec posts LFG as percy - `campfire-lfg-warstory` and
 * `lfg-interest-notification` both post as gm, with marv as the interested
 * party. IF YOU ADD AN LFG SPEC, DO NOT AUTHOR IT AS percy.
 *
 * WHY IT IS SAFE TO RUN REPEATEDLY: the assertion is "the control denies",
 * not "exactly five succeed". On a fresh hour five succeed and the sixth is
 * refused; on an already-spent hour zero succeed and the first is refused.
 * Both prove the control is live. The spec never asserts a count it cannot
 * know, because the counter increments BEFORE it compares - denied attempts
 * consume budget too, so rows-in-table is NOT the remaining budget.
 *
 * WHAT WOULD MAKE THIS FAIL, which is the point: if the limit were removed or
 * raised, every attempt would succeed and `denied` would stay null. This row
 * cannot pass on a missing control - which is the property most of the
 * assertions audited today turned out to lack.
 */

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

/** One more than the limit, so a fresh hour still reaches a denial. */
const LIMIT = 5
const ATTEMPTS = LIMIT + 1

test.describe('LFG post rate limit - the abuse control on public posting', () => {
  test.skip(!canAuth('percy'), 'needs a percy session/creds')

  test('a user cannot exceed the hourly LFG post budget', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.percy })
    const page = await ctx.newPage()
    const created: string[] = []
    let creds: SupaCreds | null = null

    try {
      const anonP = captureAnonKey(page)
      await page.goto('/campfire', { waitUntil: 'domcontentloaded' }).catch(() => {})
      creds = await resolveCreds(page, anonP)
      expect(creds, 'could not resolve percy creds').toBeTruthy()
      const userId = userIdFromToken(creds!.accessToken)
      expect(userId, 'could not derive percy user id from JWT').toBeTruthy()

      const run = `[E2E ${Date.now().toString(36)}] RateLimit`
      let denied: { status: number; body: string } | null = null
      let accepted = 0

      for (let i = 0; i < ATTEMPTS && !denied; i++) {
        const res = await page.request.post(`${SUPABASE_URL}/rest/v1/lfg_posts`,
          { headers: { ...H(creds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
            data: { author_user_id: userId, kind: 'player_seeking_group', title: `${run} ${i + 1}`,
                    body: 'E2E rate-limit probe - safe to ignore, deleted by the spec.' } })
        const body = (await res.text()).slice(0, 300)
        if (res.ok()) {
          accepted++
          const id = (JSON.parse(body || '[]') as Array<{ id: string }>)?.[0]?.id
          if (id) created.push(id)
        } else {
          denied = { status: res.status(), body }
        }
      }

      expect(denied,
        `${ATTEMPTS} consecutive LFG posts were ALL accepted. The hourly rate limit `
        + `(check_rate_limit('lfg_post', ${LIMIT}) in the lfg_posts INSERT policy) is not being enforced - a signed-in `
        + `user can post to a public board without bound. Check the policy still carries the check_rate_limit call.`)
        .not.toBeNull()

      /* PRECONDITION, and currently a KNOWN LIVE RED. Checked BEFORE the
         rate-limit assertions so this failure cannot be misfiled as one.
         enforce_moderation_on_insert() is shared across forum_threads,
         war_stories and lfg_posts. Its non-Thriver branch reads NEW.campaign_id,
         which lfg_posts does not have, so every non-Thriver INSERT dies with
         42703 - a Survivor or Ghost cannot post to LFG by any route, because a
         DB trigger cannot be routed around by the UI. Thrivers RETURN NEW before
         that line, which is why the two existing LFG specs (both posting as the
         Thriver gm) never saw it: the whole of LFG coverage ran on the one
         account class the bug cannot affect.
         Found 2026-09-16 by this spec, routed to the hub (SQL is their lane).
         When the trigger is fixed this row starts giving real rate-limit
         coverage, which still does not exist. */
      expect(denied!.body.includes('campaign_id'),
        `LFG INSERT is blocked by a LIVE APP BUG, not by the rate limit: ${denied!.body}
`
        + `  enforce_moderation_on_insert() reads NEW.campaign_id on a table that has no such column, so NO `
        + `NON-THRIVER CAN POST TO LFG AT ALL. Routed to the hub 2026-09-16. This row cannot measure the rate `
        + `limit until that is fixed - do not "fix" it by switching this spec to a Thriver account, which would `
        + `only hide the bug again the same way the existing LFG specs did.`).toBe(false)

      expect(denied!.status, `the refusal should be a policy denial, got HTTP ${denied!.status}: ${denied!.body}`)
        .toBeGreaterThanOrEqual(400)
      expect(denied!.body,
        `the refusal should be the RLS WITH CHECK failing (42501). A different error means the insert was rejected `
        + `for some other reason and this row is not actually exercising the rate limit: ${denied!.body}`)
        .toContain('42501')

      expect(accepted,
        `at most ${LIMIT} posts may be accepted in one clock hour, got ${accepted}. More means the limit is higher `
        + `than the policy says.`).toBeLessThanOrEqual(LIMIT)
    } finally {
      // Delete only the rows this run created, by id. Never a blanket delete on
      // lfg_posts - it is a real user-content table.
      if (creds) {
        for (const id of created) {
          await page.request.delete(`${SUPABASE_URL}/rest/v1/lfg_posts?id=eq.${id}`,
            { headers: H(creds) }).catch(() => {})
        }
      }
      await ctx.close()
    }
  })
})
