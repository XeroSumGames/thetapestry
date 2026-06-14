import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// Community member CRUD contract: GMs can add NPCs to communities, read the
// member list, and remove members. This spec drives the full lifecycle via REST:
//
//   1. Throwaway campaign + community + NPC (all CASCADE from campaign on delete).
//   2. INSERT community_member row linking the NPC to the community.
//      (community_members_insert RLS: GM of the community's campaign.)
//   3. GET: member appears in the list (1 row), npc_id matches.
//   4. DELETE: member removed (community_members_delete RLS: same GM check).
//   5. GET: list is empty (0 rows).
//
// Teardown: DELETE campaign (CASCADE kills communities, campaign_npcs, community_members).

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('Community member CRUD - REST contract', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('GM can add and remove an NPC from a community', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH.gm })
    const gm = await ctx.newPage()
    let campaignId: string | null = null
    let gmCreds: SupaCreds | null = null

    try {
      const gmAnonP = captureAnonKey(gm)
      await gm.goto('/campfire', { waitUntil: 'domcontentloaded' })
      gmCreds = await resolveCreds(gm, gmAnonP)
      expect(gmCreds, 'could not resolve GM creds').toBeTruthy()

      const gmUserId = userIdFromToken(gmCreds!.accessToken)
      expect(gmUserId, 'could not derive GM user id from JWT').toBeTruthy()

      const tag = `E2E-CM-${Date.now().toString(36)}`

      // Throwaway campaign. invite_code has no DEFAULT in the schema - must supply.
      const campInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaigns`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { gm_user_id: gmUserId, name: `${tag}-campaign`, invite_code: tag } },
      )).json() as Array<{ id: string }>
      campaignId = campInsert?.[0]?.id ?? null
      expect(campaignId, 'campaigns INSERT did not return an id').toBeTruthy()

      // INSERT community in the throwaway campaign.
      // communities_insert RLS: GM of the campaign.
      const commInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/communities`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: tag } },
      )).json() as Array<{ id: string }>
      const communityId = commInsert?.[0]?.id ?? null
      expect(communityId, 'communities INSERT did not return an id').toBeTruthy()

      // INSERT a campaign NPC to serve as the community member subject.
      // campaign_npcs INSERT RLS: GM of the campaign.
      const npcInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_npcs`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: tag } },
      )).json() as Array<{ id: string }>
      const npcId = npcInsert?.[0]?.id ?? null
      expect(npcId, 'campaign_npcs INSERT did not return an id').toBeTruthy()

      // INSERT community_member linking NPC to the community.
      // community_member_one_subject CHECK: exactly one of npc_id/character_id must be non-null.
      // community_members_insert RLS: GM of the campaign (via community -> campaign join).
      const memberInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/community_members`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { community_id: communityId, npc_id: npcId, recruitment_type: 'member', role: 'unassigned', status: 'active' } },
      )).json() as Array<{ id: string }>
      const memberId = memberInsert?.[0]?.id ?? null
      expect(memberId, 'community_members INSERT did not return an id (check community_members_insert RLS)').toBeTruthy()

      // GET: member appears in the list (1 row).
      const listAfterAdd = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/community_members?community_id=eq.${communityId}&select=id,npc_id`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ id: string; npc_id: string }>
      expect(listAfterAdd.length, 'expected 1 community_member after INSERT').toBe(1)
      expect(listAfterAdd[0]?.npc_id, 'community_member npc_id mismatch').toBe(npcId)

      // DELETE community_member.
      // community_members_delete RLS: GM of the community's campaign.
      await gm.request.delete(
        `${SUPABASE_URL}/rest/v1/community_members?id=eq.${memberId}`,
        { headers: H(gmCreds!) },
      )

      // GET: list is empty (0 rows).
      const listAfterRemove = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/community_members?community_id=eq.${communityId}&select=id`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ id: string }>
      expect(listAfterRemove.length, 'community_member still present after DELETE').toBe(0)
    } finally {
      if (campaignId && gmCreds) {
        // CASCADE DELETE kills communities, campaign_npcs, and community_members.
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })
})
