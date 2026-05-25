import { test, expect, type Page } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Ch12 [Sys H] - Communities lifecycle: create a community, populate it to the
// 13-member Community threshold, run one Weekly Check, and assert it resolves to
// a persisted history row.
//
// The Weekly Check is the flagship centerpiece. Its modal RUN button is gated by
// `eligible = memberCount >= 13` (CommunityMoraleModal.tsx:336) - a Community must
// be full before morale rolls. So the test seeds 13 NPC members via REST (the GM
// owns the throwaway campaign, so its session can insert campaign_npcs +
// community_members - schema.sql:2088 / 2288). The check is DICE-DRIVEN
// (roll2d6 = Math.random), so we assert the STRUCTURE it always writes - a
// community_morale_checks row + community.week_number incremented from 0 to 1 -
// not specific Fed/Clothed/Morale values.
//
// Runs in its OWN throwaway campaign (never the Arena); teardown deletes the
// campaign and CASCADE clears the community + members + checks + npcs.

const RUN = `[E2E ${Date.now().toString(36)}]`
const ROLES = ['gatherer', 'maintainer', 'safety', 'unassigned'] as const

async function rows(page: Page, creds: SupaCreds, query: string): Promise<any[]> {
  const res = await page.request.get(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` },
  })
  if (!res.ok()) return []
  const out = await res.json().catch(() => [])
  return Array.isArray(out) ? out : []
}

async function insertReturning(page: Page, creds: SupaCreds, table: string, data: unknown): Promise<any[]> {
  const res = await page.request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: {
      apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    data,
  })
  expect(res.ok(), `insert ${table} failed: ${res.status()} ${await res.text()}`).toBe(true)
  return res.json()
}

test.describe('Ch12 - Communities lifecycle (create -> populate to 13 -> weekly check)', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM creates a community, fills it to 13 members, and a Weekly Check writes a history row', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    let campaignId: string | null = null
    let communityId: string | null = null
    let creds: SupaCreds | null = null
    const commName = `${RUN} Community`
    try {
      const anonP = captureAnonKey(gm)

      // --- Throwaway campaign ---
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      creds = await resolveCreds(gm, anonP)
      expect(creds, 'could not resolve GM creds').toBeTruthy()
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(`${RUN} Communities`)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]
      expect(campaignId, 'no campaign id').toBeTruthy()

      // --- Create the community via the real UI ---
      // The /community route is read-only; creation lives on the table page under
      // the "Community ▾" header menu -> "New Community" (opens the modal with the
      // create form, page.tsx:5427). Retry the menu-open + item-click until the
      // name field shows (post-navigation hydration race on a client menu).
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      const nameField = gm.getByPlaceholder('e.g. The Mongrels')
      await expect(async () => {
        await gm.getByRole('button', { name: /^Community/ }).first().click().catch(() => {})
        await gm.getByRole('button', { name: 'New Community' }).click({ timeout: 2_000 }).catch(() => {})
        await expect(nameField).toBeVisible({ timeout: 2_000 })
      }, 'the New Community create form should open').toPass({ timeout: 25_000 })
      await nameField.fill(commName)
      await gm.getByRole('button', { name: 'Create', exact: true }).click()
      await expect.poll(async () => {
        const c = await rows(gm, creds!, `communities?campaign_id=eq.${campaignId}&select=id,stage,status`)
        if (c.length === 1) communityId = c[0].id
        return c.length === 1 && c[0].stage === 'community'
      }, { timeout: 15_000, message: 'a community row should exist after Create' }).toBe(true)

      // --- Populate to 13 members (seed 13 NPCs + 13 active members via REST) ---
      const npcData = Array.from({ length: 13 }, (_, i) => ({
        campaign_id: campaignId, name: `${RUN} M${i + 1}`,
        reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 0,
        skills: [], equipment: [], wp_max: 10, rp_max: 6, wp_current: 10, rp_current: 6,
        status: 'active', sort_order: i + 1,
      }))
      const npcs = await insertReturning(gm, creds!, 'campaign_npcs', npcData)
      expect(npcs.length, 'should have seeded 13 NPCs').toBe(13)
      const memberData = npcs.map((n: { id: string }, i: number) => ({
        community_id: communityId, npc_id: n.id,
        role: ROLES[i % ROLES.length], recruitment_type: 'member', status: 'active',
      }))
      await insertReturning(gm, creds!, 'community_members', memberData)
      expect(
        (await rows(gm, creds!, `community_members?community_id=eq.${communityId}&left_at=is.null&select=id`)).length,
        'community should have 13 active members',
      ).toBe(13)

      // --- Reload + reopen the panel (Community ▾ -> Status) so it picks up the
      // 13 seeded members; the card chip then reflects the count. ---
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      await expect(async () => {
        await gm.getByRole('button', { name: /^Community/ }).first().click().catch(() => {})
        await gm.getByRole('button', { name: 'Status', exact: true }).click({ timeout: 2_000 }).catch(() => {})
        await expect(gm.getByText(/13 members/i).first()).toBeVisible({ timeout: 2_000 })
      }, 'the community Status panel should show the 13-member count').toPass({ timeout: 25_000 })

      // --- Run one Weekly Check ---
      // Card button opens the modal; the modal's own "🎲 Run Weekly Check" rolls
      // (now eligible at 13 members). A client onClick post-navigation, so retry
      // the open until the modal's roll control appears.
      const modalRoll = gm.getByRole('button', { name: '🎲 Run Weekly Check' })
      await expect(async () => {
        await gm.getByRole('button', { name: 'Run Weekly Check', exact: true }).first().click().catch(() => {})
        await expect(modalRoll).toBeVisible({ timeout: 3_000 })
      }, 'the Weekly Check modal should open').toPass({ timeout: 25_000 })
      await modalRoll.click()
      // Result stage -> finalize (label varies; "Finalize & Save" on the common
      // no-dissolve path - a week-1 check can never hit the 3rd-failure dissolve).
      const finalize = gm.getByRole('button', { name: /^Finalize/ })
      await expect(finalize, 'the result stage should offer Finalize').toBeVisible({ timeout: 15_000 })
      await finalize.click()

      // --- The check persisted: a morale history row + week_number advanced to 1 ---
      await expect.poll(
        async () => (await rows(gm, creds!, `community_morale_checks?community_id=eq.${communityId}&select=week_number,outcome`)).length,
        { timeout: 15_000, message: 'a community_morale_checks history row should be written' },
      ).toBe(1)
      const morale = (await rows(gm, creds!, `community_morale_checks?community_id=eq.${communityId}&select=week_number,outcome`))[0]
      expect(typeof morale.outcome, 'the check recorded an outcome').toBe('string')
      expect(morale.outcome.length, 'outcome is non-empty').toBeGreaterThan(0)
      await expect.poll(
        async () => (await rows(gm, creds!, `communities?id=eq.${communityId}&select=week_number`))[0]?.week_number,
        { timeout: 10_000, message: 'community week_number should advance to 1' },
      ).toBe(1)
      // Both resource checks (fed + clothed) were also written.
      expect(
        (await rows(gm, creds!, `community_resource_checks?community_id=eq.${communityId}&select=kind`)).map(r => r.kind).sort(),
        'fed + clothed resource checks written',
      ).toEqual(['clothed', 'fed'])
    } finally {
      if (campaignId && creds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}` } },
        ).catch(() => {})
      }
      await gmCtx.close()
    }
  })
})
