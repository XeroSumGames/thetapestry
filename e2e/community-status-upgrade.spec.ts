import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, type SupaCreds } from './_teardown'

// Community stage upgrade contract: a group (stage='group') that reaches the
// 13-member threshold shows a CommunityPromoteBanner inside the Community Status
// panel. The GM names it and clicks "Promote to Community", which writes
// stage='community' to the communities table and unlocks Morale checks.
//
// The "New Community" UI creates with stage='community' by default.
// This spec bypasses that to REST-INSERT a group, then drives the banner through
// the real UI, confirming the stage flip in DB.
//
// Seeding: 13 NPC members (same pattern as communities-lifecycle.spec). The
// combined member count (PCs + NPCs) must reach COMMUNITY_THRESHOLD=13.
// The GM auto-joins campaign_members, so only 12 NPC members are actually needed,
// but we seed 13 to be safe (matches the lifecycle spec).

const ROLES = ['gatherer', 'maintainer', 'safety', 'unassigned'] as const
const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Community stage upgrade (group -> community via promote banner)', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM promotes a group that hit 13 members -> stage flips to community', async ({ browser }) => {
    const gmCtx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await gmCtx.newPage()
    let campaignId: string | null = null
    let communityId: string | null = null
    let gmCreds: SupaCreds | null = null
    const promotedName = `Community-${Date.now().toString(36)}`
    try {
      const gmAnonP = captureAnonKey(gm)

      // GM creates throwaway campaign.
      const tag = `[E2E ${Date.now().toString(36)}] StageUpgrade`
      await gm.goto('/stories/new', { waitUntil: 'domcontentloaded' })
      gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()
      await gm.getByPlaceholder('e.g. The Kansas City Survivors').fill(tag)
      await gm.getByRole('button', { name: /custom setting/i }).first().click().catch(() => {})
      await gm.getByRole('button', { name: /^create story$/i }).click()
      await gm.waitForURL(/\/stories\/[0-9a-f-]{36}$/i, { timeout: 30_000 })
      campaignId = gm.url().split('/stories/')[1]

      // REST INSERT a community with stage='group' (bypasses the UI which
      // creates with stage='community'). This is what triggers the promote banner.
      const commInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/communities`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: 'New Group', stage: 'group', status: 'active' } },
      )).json() as Array<{ id: string }>
      communityId = commInsert?.[0]?.id ?? null
      expect(communityId, 'community INSERT did not return an id').toBeTruthy()

      // Seed 13 NPCs + 13 community_members (same pattern as communities-lifecycle.spec).
      // Brings combined count to 13 which triggers COMMUNITY_THRESHOLD gate in banner.
      const RUN = `E2E-SU-${Date.now().toString(36)}`
      const npcData = Array.from({ length: 13 }, (_, i) => ({
        campaign_id: campaignId, name: `${RUN} M${i + 1}`,
        reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 0,
        skills: [], equipment: [], wp_max: 10, rp_max: 6, wp_current: 10, rp_current: 6,
        status: 'active', sort_order: i + 1,
      }))
      const npcs = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_npcs`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' }, data: npcData },
      )).json() as Array<{ id: string }>
      expect(npcs.length, 'should have seeded 13 NPCs').toBe(13)

      const memberData = npcs.map((n: { id: string }, i: number) => ({
        community_id: communityId, npc_id: n.id,
        role: ROLES[i % ROLES.length], recruitment_type: 'member', status: 'active',
      }))
      await gm.request.post(
        `${SUPABASE_URL}/rest/v1/community_members`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=minimal' }, data: memberData },
      )

      // Navigate to table + open Community > Status panel (where CommunityPromoteBanner renders).
      await gm.goto(`/stories/${campaignId}/table`, { waitUntil: 'domcontentloaded' })
      await expect(async () => {
        await gm.getByRole('button', { name: /^Community/ }).first().click().catch(() => {})
        await gm.getByRole('button', { name: 'Status', exact: true }).click({ timeout: 2_000 }).catch(() => {})
        await expect(gm.getByText(/ready to become a community/i).first()).toBeVisible({ timeout: 2_000 })
      }, 'CommunityPromoteBanner should appear in Status panel at 13 members').toPass({ timeout: 30_000 })

      // Fill the new community name + dismiss the confirm dialog + click Promote.
      await gm.getByPlaceholder('Name the new Community').fill(promotedName)
      gm.once('dialog', d => d.accept())
      await gm.getByRole('button', { name: 'Promote to Community' }).click()

      // REST poll: stage flipped to 'community' and name updated.
      await expect.poll(async () => {
        const rows = await (await gm.request.get(
          `${SUPABASE_URL}/rest/v1/communities?id=eq.${communityId}&select=stage,name`,
          { headers: H(gmCreds!) },
        )).json() as Array<{ stage: string; name: string }>
        return rows?.[0] ?? null
      }, { timeout: 12_000, message: 'communities.stage did not flip to community after Promote' }).toMatchObject({
        stage: 'community',
        name: promotedName,
      })
    } finally {
      if (campaignId && gmCreds) {
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await gmCtx.close()
    }
  })
})
