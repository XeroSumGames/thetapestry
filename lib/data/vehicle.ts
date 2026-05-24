// Repository: the vehicle popout (app/vehicle/page.tsx) queries (grand
// re-architecture Phase 5).
//
// The vehicle page hand-rolled 14 inline `supabase.from(...)` DB calls across
// 6 tables (campaigns, profiles, campaign_members, campaign_npcs,
// tactical_scenes, scene_tokens). This seam centralises them as drop-in
// builders: each returns the raw typed builder so `const { data, error } =
// await fn(args)` is a one-line swap and the call-site orchestration
// (Promise.all, the PC/NPC crew mapping, the range/arc math, optimistic
// setState) stays put. Every `.eq`/`.is`/`.in` filter is preserved verbatim.
//
// NOT migrated here (intentionally): the two SECURITY DEFINER RPCs
// (update_vehicle_in_campaign, snap_token_to_seat) and decrementInitiativeAction
// - RPCs are not `.from(` and stay on the page's client for now.

import { db } from './db'

// --- Load / auth ------------------------------------------------------------

/** The campaign's GM + vehicles JSON (the popout reads one vehicle out of it). */
export function getCampaignVehicles(campaignId: string) {
  return db().from('campaigns').select('gm_user_id, vehicles').eq('id', campaignId).single()
}

/** A single profile's role (Thriver godmode check). */
export function getProfileRole(userId: string) {
  return db().from('profiles').select('role').eq('id', userId).maybeSingle()
}

/** Whether the user is a member of the campaign (canEdit gate). */
export function getMembership(campaignId: string, userId: string) {
  return db().from('campaign_members').select('id').eq('campaign_id', campaignId).eq('user_id', userId).maybeSingle()
}

/** PC crew pool: campaign members joined to their character (id/name/data). */
export function campaignMembersWithCharacters(campaignId: string) {
  return db().from('campaign_members')
    .select('character_id, characters:character_id(id, name, data)')
    .eq('campaign_id', campaignId)
    .not('character_id', 'is', null)
}

/** NPC crew pool: every campaign NPC with the attrs/skills the crew picker needs. */
export function campaignNpcsForCrew(campaignId: string) {
  return db().from('campaign_npcs')
    .select('id, name, reason, dexterity, physicality, influence, acumen, skills, status, wp_current, death_countdown')
    .eq('campaign_id', campaignId)
}

// --- Tactical scene / tokens ------------------------------------------------

/** The active scene's id + cell_feet (range-gate + targeting loaders). */
export function activeSceneWithCellFeet(campaignId: string) {
  return db().from('tactical_scenes').select('id, cell_feet').eq('campaign_id', campaignId).eq('is_active', true).maybeSingle()
}

/** Just the active scene's id (dismount-placement loader). */
export function activeSceneId(campaignId: string) {
  return db().from('tactical_scenes').select('id').eq('campaign_id', campaignId).eq('is_active', true).maybeSingle()
}

/** Tokens for the range-gate loader (footprint + identity columns). */
export function sceneTokensForRange(sceneId: string) {
  return db().from('scene_tokens')
    .select('name, token_type, character_id, npc_id, grid_x, grid_y, grid_w, grid_h')
    .eq('scene_id', sceneId)
    .is('archived_at', null)
}

/** Tokens for the dismount-to-adjacent loader (footprint + identity columns). */
export function sceneTokensForDismount(sceneId: string) {
  return db().from('scene_tokens')
    .select('grid_x, grid_y, grid_w, grid_h, character_id, npc_id, name, token_type')
    .eq('scene_id', sceneId)
    .is('archived_at', null)
}

/** Tokens for the mounted-weapon targeting loader (adds id + rotation). */
export function sceneTokensForTargeting(sceneId: string) {
  return db().from('scene_tokens')
    .select('id, name, npc_id, grid_x, grid_y, grid_w, grid_h, rotation, token_type')
    .eq('scene_id', sceneId)
    .is('archived_at', null)
}

// --- NPC combat -------------------------------------------------------------

/** Names for a set of NPC ids (targeting label map). */
export function npcNamesByIds(npcIds: string[]) {
  return db().from('campaign_npcs').select('id, name').in('id', npcIds)
}

/** A target NPC's defensive DEX + WP/RP pools (mounted-weapon attack resolve). */
export function getNpcCombatState(npcId: string) {
  return db().from('campaign_npcs').select('id, dexterity, wp_current, rp_current, wp_max, rp_max').eq('id', npcId).maybeSingle()
}

/** Apply a WP/RP pool update to a target NPC (mounted-weapon damage). */
export function updateNpcPools(npcId: string, wpCurrent: number, rpCurrent: number) {
  return db().from('campaign_npcs').update({ wp_current: wpCurrent, rp_current: rpCurrent }).eq('id', npcId)
}
