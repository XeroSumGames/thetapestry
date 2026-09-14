import { test, expect } from '@playwright/test'
import { AUTH, canAuth } from './_fixtures'
import { SUPABASE_URL, captureAnonKey, resolveCreds, userIdFromToken, type SupaCreds } from './_teardown'

// Ch10 - NPC damage apply via gm_apply_damage RPC.
//
// Covers the "Apply-damage -> WP/RP" gap:
//   1. Throwaway campaign + NPC (campaign_npcs with explicit wp_current=10).
//   2. GM calls the gm_apply_damage SECURITY DEFINER RPC with p_target_kind='npc'.
//      The function performs: UPDATE campaign_npcs SET wp_current = MAX(0, wp_current - p_wp_damage).
//   3. Poll campaign_npcs: wp_current reduced by the damage amount.
//   4. Poll roll_log: the audit row gm_apply_damage inserts has via='gm_apply',
//      target_kind='npc', and the correct wp_damage value.
//
// NPC wp_current is stored directly on campaign_npcs (no separate state table).
// NULL wp_current is COALESCE'd to 0 by the RPC, so the test explicitly sets
// wp_current=10 to avoid the 0-damage edge case.
//
// RLS: gm_apply_damage is SECURITY DEFINER; the caller must be authenticated and
// the campaign's gm_user_id must match the caller's auth.uid(). The GM owns the
// throwaway campaign, so this passes.
//
// roll_log SELECT RLS: gm_user_id = auth.uid() (line 2795 in schema.sql).
// campaign_npcs SELECT RLS: GM of the campaign.
//
// Teardown: DELETE campaign CASCADE-removes campaign_npcs + roll_log rows.

const H = (c: SupaCreds) => ({ apikey: c.anonKey, Authorization: `Bearer ${c.accessToken}` })

test.describe('NPC damage apply - gm_apply_damage RPC contract', () => {
  test.skip(!canAuth('gm'), 'needs gm session/creds')

  test('gm_apply_damage reduces NPC wp_current and inserts a roll_log row', async ({ browser }) => {
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

      const tag = `E2E-NPCDMG-${Date.now().toString(36)}`
      const WP_START = 10
      const DAMAGE = 4
      const WP_AFTER = WP_START - DAMAGE  // 6

      // Throwaway campaign. invite_code has no DEFAULT in the schema.
      const campInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaigns?select=id`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { gm_user_id: gmUserId, name: `${tag}-campaign`, invite_code: tag } },
      )).json() as Array<{ id: string }>
      campaignId = campInsert?.[0]?.id ?? null
      expect(campaignId, 'campaigns INSERT did not return an id').toBeTruthy()

      // NPC with explicit wp_current (NULL would be COALESCE'd to 0 by the RPC,
      // making MAX(0, 0 - 4) = 0 which is a valid but less useful test signal).
      const npcInsert = await (await gm.request.post(
        `${SUPABASE_URL}/rest/v1/campaign_npcs`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          data: { campaign_id: campaignId, name: tag, wp_max: WP_START, rp_max: 6,
                  wp_current: WP_START, rp_current: 6 } },
      )).json() as Array<{ id: string }>
      const npcId = npcInsert?.[0]?.id ?? null
      expect(npcId, 'campaign_npcs INSERT did not return an id').toBeTruthy()

      // Call the RPC. gm_apply_damage is SECURITY DEFINER; the in-function GM
      // check validates gm_user_id = auth.uid() for this campaign.
      const rpc = await gm.request.post(
        `${SUPABASE_URL}/rest/v1/rpc/gm_apply_damage`,
        { headers: { ...H(gmCreds!), 'Content-Type': 'application/json' },
          data: { p_campaign_id: campaignId, p_target_kind: 'npc', p_target_id: npcId, p_wp_damage: DAMAGE } },
      )
      expect(rpc.ok(), `gm_apply_damage RPC failed: ${rpc.status()} ${await rpc.text()}`).toBe(true)

      // Assert NPC wp_current was updated in campaign_npcs.
      const npcRows = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/campaign_npcs?id=eq.${npcId}&select=wp_current`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ wp_current: number }>
      expect(npcRows.length, 'campaign_npcs row not found after damage').toBe(1)
      expect(
        npcRows[0]?.wp_current,
        `NPC wp_current should be ${WP_AFTER} (${WP_START} - ${DAMAGE}) after gm_apply_damage`,
      ).toBe(WP_AFTER)

      // Assert the audit row in roll_log.
      // damage_json.via='gm_apply' distinguishes this from live-combat attack rows.
      const logRows = await (await gm.request.get(
        `${SUPABASE_URL}/rest/v1/roll_log?campaign_id=eq.${campaignId}&order=created_at.desc&limit=1&select=target_name,damage_json`,
        { headers: H(gmCreds!) },
      )).json() as Array<{ target_name: string; damage_json: Record<string, unknown> }>
      expect(logRows.length, 'roll_log audit row not found after gm_apply_damage').toBe(1)
      expect(logRows[0]?.target_name, 'roll_log target_name should match NPC name').toBe(tag)
      expect(logRows[0]?.damage_json?.via, 'damage_json.via should be gm_apply').toBe('gm_apply')
      expect(logRows[0]?.damage_json?.target_kind, 'damage_json.target_kind should be npc').toBe('npc')
      expect(logRows[0]?.damage_json?.wp_damage, `damage_json.wp_damage should be ${DAMAGE}`).toBe(DAMAGE)
      expect(logRows[0]?.damage_json?.wp_before, `damage_json.wp_before should be ${WP_START}`).toBe(WP_START)
      expect(logRows[0]?.damage_json?.wp_after, `damage_json.wp_after should be ${WP_AFTER}`).toBe(WP_AFTER)
    } finally {
      if (campaignId && gmCreds) {
        // CASCADE DELETE removes campaign_npcs + roll_log rows for this campaign.
        await gm.request.delete(
          `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`,
          { headers: H(gmCreds) },
        ).catch(() => {})
      }
      await ctx.close()
    }
  })
})
