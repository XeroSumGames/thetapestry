import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth, ACCOUNTS } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch13 - Campfire LFG + War Stories: the composer UI flows campfire-social.spec
// left uncovered (it proved the shared moderation trigger via forum_threads; the
// LFG/war-story composers + the LFG "I'm Interested" action were untested).
//
// Both surfaces auto-approve a Thriver-authored post (LFG: isThriver, lfg/page.tsx:486;
// War Stories: isCampaignScope || isThriver, war-stories/page.tsx:349) - the same
// "Thrivers ARE the moderation layer" rule the forum test relies on. The gm
// account is a Thriver, so we assert moderation_status='approved' as the proof the
// Thriver auto-approve path ran (isThriver is set after an async profiles role
// fetch, so we wait for it before posting, else the post races to 'pending').
//
// Both tables confirmed live on prod (lfg_posts, lfg_interests, war_stories) before
// writing this - the war-stories page has a "table not applied" fallback, so its
// "+ New Story" button being ENABLED is itself the live-schema gate.
//
// Throwaway [E2E]-tagged rows; teardown deletes what each account created via its
// OWN session (RLS backstop). War Story posted at GLOBAL scope so it never attaches
// to a real campaign's feed.

const RUN = `[E2E ${Date.now().toString(36)}]`

function headers(creds: SupaCreds, extra: Record<string, string> = {}) {
  return { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}`, ...extra }
}

async function getRows(page: Page, creds: SupaCreds, query: string): Promise<any[]> {
  const res = await page.request.get(`${SUPABASE_URL}/rest/v1/${query}`, { headers: headers(creds) })
  if (!res.ok()) return []
  const out = await res.json().catch(() => [])
  return Array.isArray(out) ? out : []
}

async function del(page: Page, creds: SupaCreds, query: string) {
  await page.request.delete(`${SUPABASE_URL}/rest/v1/${query}`, { headers: headers(creds) }).catch(() => {})
}

// isThriver is set after an async profiles role fetch - wait for it so the client
// computes auto-approve (else the post races to 'pending'). Mirrors campfire-social.
async function waitForRoleFetch(page: Page) {
  await page.waitForResponse(
    r => r.url().includes('/rest/v1/profiles') && r.request().method() === 'GET',
    { timeout: 10_000 },
  ).catch(() => {})
}

test.describe('Ch13 - Campfire LFG + War Stories (composer + interest)', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  // --- LFG: Thriver composes a post (auto-approves), a player expresses interest. ---
  test('Thriver posts an LFG via the composer (auto-approves); a player marks interest (persists)', async ({ browser }) => {
    test.skip(!canAuth('marv'), 'the interest half needs marv session/creds')
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    gm.on('dialog', d => d.accept().catch(() => {}))
    const marvCtx = await browser.newContext({ storageState: AUTH.marv })
    const marv = await marvCtx.newPage()
    let postId: string | null = null
    let gmCreds: SupaCreds | null = null
    let marvCreds: SupaCreds | null = null
    const title = `${RUN} LFG`
    try {
      // --- GM (Thriver) composes the LFG post ---
      const gmAnon = captureAnonKey(gm)
      await gm.goto('/campfire/lfg', { waitUntil: 'domcontentloaded' })
      await waitForRoleFetch(gm)
      gmCreds = await resolveCreds(gm, gmAnon)
      expect(gmCreds, 'could not resolve gm creds').toBeTruthy()

      await gm.getByRole('button', { name: '+ New Post' }).click()
      await gm.getByPlaceholder(/e\.g\. Distemper/).fill(title)
      await gm.getByPlaceholder(/Describe the campaign/).fill(`${RUN} - automated E2E LFG post, safe to remove.`)
      await gm.getByRole('button', { name: 'Post', exact: true }).click()

      // Persisted + auto-approved (Thriver). LFG composer is inline (no nav), so poll REST.
      await expect.poll(async () => {
        const rows = await getRows(gm, gmCreds!, `lfg_posts?title=eq.${encodeURIComponent(title)}&select=id,moderation_status`)
        if (rows[0]) postId = rows[0].id
        return rows[0]?.moderation_status ?? null
      }, { timeout: 15_000, message: 'LFG post should persist and auto-approve for a Thriver' }).toBe('approved')
      expect(postId, 'no LFG post id').toBeTruthy()

      // --- marv (player) finds it via search + clicks "I'm Interested" ---
      const marvAnon = captureAnonKey(marv)
      await marv.goto('/campfire/lfg', { waitUntil: 'domcontentloaded' })
      marvCreds = await resolveCreds(marv, marvAnon)
      expect(marvCreds, 'could not resolve marv creds').toBeTruthy()
      // Search by the unique title so the card is in the DOM regardless of how
      // many real LFG posts prod carries (the list paginates).
      await marv.getByPlaceholder(/Search LFG posts/i).fill(title)
      await marv.getByRole('button', { name: /Search/i }).click()
      // The card carries a stable id="lfg-<postId>" - scope the interest click to it.
      const card = marv.locator(`#lfg-${postId}`)
      await expect(card, 'marv should see the approved post after searching').toBeVisible({ timeout: 15_000 })
      await card.getByRole('button', { name: "I'm Interested" }).click()

      // The interest row persists (read via the gm/author roster, which RLS allows).
      await expect.poll(
        async () => (await getRows(gm, gmCreds!, `lfg_interests?post_id=eq.${postId}&select=interested_user_id`)).map(r => r.interested_user_id),
        { timeout: 10_000, message: 'marv\'s interest should persist on the post' },
      ).toContain(ACCOUNTS.marv.userId)
    } finally {
      // marv removes own interest (own-row RLS), then gm deletes the post.
      if (postId && marvCreds) await del(marv, marvCreds, `lfg_interests?post_id=eq.${postId}&interested_user_id=eq.${ACCOUNTS.marv.userId}`)
      if (postId && gmCreds) await del(gm, gmCreds, `lfg_posts?id=eq.${postId}`)
      await marvCtx.close()
      await gmCtx.close()
    }
  })

  // --- War Stories: Thriver composes a GLOBAL-scope story (auto-approves). ---
  test('Thriver posts a War Story via the composer at global scope (auto-approves)', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    gm.on('dialog', d => d.accept().catch(() => {}))
    let storyId: string | null = null
    let gmCreds: SupaCreds | null = null
    const title = `${RUN} WarStory`
    try {
      const gmAnon = captureAnonKey(gm)
      await gm.goto('/campfire/war-stories', { waitUntil: 'domcontentloaded' })
      await waitForRoleFetch(gm)
      gmCreds = await resolveCreds(gm, gmAnon)
      expect(gmCreds, 'could not resolve gm creds').toBeTruthy()

      // "+ New Story" is disabled when the war_stories table isn't applied, so
      // its being enabled is the live-schema gate.
      const compose = gm.getByRole('button', { name: '+ New Story' })
      await expect(compose, '+ New Story should be enabled (war_stories table is live)').toBeEnabled({ timeout: 15_000 })
      await compose.click()
      await gm.getByPlaceholder(/That time we talked the raiders down/).fill(title)
      await gm.getByPlaceholder('Tell the table what happened.').fill(`${RUN} - automated E2E war story, safe to remove.`)
      // Global scope: campaign_id + setting both null, so the story never lands
      // in a real campaign's feed. A Thriver still auto-approves (isThriver path).
      await gm.getByRole('button', { name: '🌐 Global' }).click()
      await gm.getByRole('button', { name: 'Post Story' }).click()

      await expect.poll(async () => {
        const rows = await getRows(gm, gmCreds!, `war_stories?title=eq.${encodeURIComponent(title)}&select=id,moderation_status,campaign_id`)
        if (rows[0]) storyId = rows[0].id
        return rows[0] ? { status: rows[0].moderation_status, campaign: rows[0].campaign_id } : null
      }, { timeout: 15_000, message: 'war story should persist and auto-approve for a Thriver' })
        .toEqual({ status: 'approved', campaign: null })
      expect(storyId, 'no war story id').toBeTruthy()
    } finally {
      if (storyId && gmCreds) await del(gm, gmCreds, `war_stories?id=eq.${storyId}`)
      await gmCtx.close()
    }
  })
})
