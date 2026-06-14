// Repository: the campaign Communities panel (components/CampaignCommunity.tsx)
// queries (grand re-architecture Phase 5).
//
// CampaignCommunity hand-rolled 56 inline `supabase.from(...)` calls across 13
// tables (communities, community_members, community_stockpile_items,
// community_morale_checks, community_events, community_migrations,
// world_communities, campaign_members, campaign_npcs, campaign_pins,
// characters, profiles, roll_log). This seam centralises them as drop-in
// builders: each returns the raw typed builder so `const { data, error } =
// await fn(args)` is a one-line swap and the call-site orchestration (the big
// load() fan-out, the schism/migration/publish multi-step flows, optimistic
// setState) stays put. Every .eq/.in/.is/.not/.order is preserved verbatim;
// deletes stay scoped. Inserts that need the row back keep `.select().single()`
// chained at the call site (the builders support it).

import { db, type Insert, type Update } from './db'

// --- communities ------------------------------------------------------------

export function campaignCommunities(campaignId: string) {
  return db().from('communities').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true })
}
export function insertCommunity(row: Insert<'communities'>) {
  return db().from('communities').insert(row)
}
export function updateCommunity(id: string, patch: Update<'communities'>) {
  return db().from('communities').update(patch).eq('id', id)
}
export function deleteCommunity(id: string) {
  return db().from('communities').delete().eq('id', id)
}
// Y11-c: empty community -> hard-delete; community with active members ->
// soft-dissolve (members leave with reason='dissolved', status flips), the same
// end state the morale 3-failure dissolve produces, so history + survivor
// migration are preserved. Caller passes the LIVE active member ids.
export async function deleteOrDissolveCommunity(
  id: string,
  activeMemberIds: string[],
): Promise<{ mode: 'deleted' | 'dissolved'; error?: string }> {
  if (activeMemberIds.length === 0) {
    const { error } = await deleteCommunity(id)
    return { mode: 'deleted', error: error?.message }
  }
  const now = new Date().toISOString()
  const { error: leftErr } = await db().from('community_members')
    .update({ left_at: now, left_reason: 'dissolved' }).in('id', activeMemberIds)
  if (leftErr) return { mode: 'dissolved', error: leftErr.message }
  const { error } = await updateCommunity(id, { status: 'dissolved', dissolved_at: now })
  return { mode: 'dissolved', error: error?.message }
}

// --- community_members ------------------------------------------------------

/** Active (not-left) members across a set of communities. */
export function activeMembersForCommunities(communityIds: string[]) {
  return db().from('community_members').select('*').in('community_id', communityIds).is('left_at', null)
}
/** Members soft-removed with left_reason='dissolved' (migration offer pool). */
export function dissolvedMembersForCommunities(communityIds: string[]) {
  return db().from('community_members').select('*').in('community_id', communityIds).eq('left_reason', 'dissolved')
}
export function insertMembers(rows: Insert<'community_members'> | Insert<'community_members'>[]) {
  return db().from('community_members').insert(rows as any)
}
export function updateMember(id: string, patch: Update<'community_members'>) {
  return db().from('community_members').update(patch).eq('id', id)
}
export function updateMembersByIds(ids: string[], patch: Update<'community_members'>) {
  return db().from('community_members').update(patch).in('id', ids)
}
export function deleteMember(id: string) {
  return db().from('community_members').delete().eq('id', id)
}

// --- community_stockpile_items ----------------------------------------------

export function stockpileItems(communityId: string) {
  return db().from('community_stockpile_items').select('*').eq('community_id', communityId).order('name')
}
export function insertStockpileItem(row: Insert<'community_stockpile_items'>) {
  return db().from('community_stockpile_items').insert(row)
}
export function updateStockpileItemQty(id: string, qty: number) {
  return db().from('community_stockpile_items').update({ qty }).eq('id', id)
}
export function deleteStockpileItem(id: string) {
  return db().from('community_stockpile_items').delete().eq('id', id)
}

// --- community_morale_checks ------------------------------------------------

/** Full Morale history for one community (dashboard). */
export function moraleHistory(communityId: string) {
  return db().from('community_morale_checks')
    .select('week_number, outcome, members_before, members_after, role_snapshot, rolled_at')
    .eq('community_id', communityId)
    .order('week_number', { ascending: true })
}
/** Recent Morale outcomes across communities (trend chips). */
export function recentMoraleForCommunities(communityIds: string[]) {
  return db().from('community_morale_checks')
    .select('community_id, week_number, outcome')
    .in('community_id', communityIds)
    .order('week_number', { ascending: false })
}

// --- community_events -------------------------------------------------------

export function communityEventsForCommunities(communityIds: string[]) {
  return db().from('community_events')
    .select('id, community_id, event_type, payload, author_user_id, created_at')
    .in('community_id', communityIds)
    .order('created_at', { ascending: false })
}
export function deleteCommunityEvent(id: string) {
  return db().from('community_events').delete().eq('id', id)
}

// --- community_migrations ---------------------------------------------------

export function insertMigrations(rows: Insert<'community_migrations'>[]) {
  return db().from('community_migrations').insert(rows as any)
}

// --- world_communities (the public mirror) ----------------------------------

/** World mirror rows for a set of source communities (publish state). */
export function worldRowsForCommunities(sourceCommunityIds: string[]) {
  return db().from('world_communities')
    .select('id, source_community_id, moderation_status, community_status, size_band, faction_label, last_public_update_at')
    .in('source_community_id', sourceCommunityIds)
}
/** Approved world communities as migration targets. */
export function approvedWorldCommunityTargets() {
  return db().from('world_communities').select('id, name, size_band, faction_label').eq('moderation_status', 'approved').order('name')
}
export function insertWorldCommunity(row: Insert<'world_communities'>) {
  return db().from('world_communities').insert(row)
}
export function updateWorldCommunity(id: string, patch: Update<'world_communities'>) {
  return db().from('world_communities').update(patch).eq('id', id)
}
export function deleteWorldCommunity(id: string) {
  return db().from('world_communities').delete().eq('id', id)
}

// --- campaign_* + characters + profiles + roll_log (read-mostly) ------------

/** NPC options (id/name/skills) for the recruit + rebalance pickers. */
export function campaignNpcOptions(campaignId: string) {
  return db().from('campaign_npcs').select('id, name, skills').eq('campaign_id', campaignId).order('name')
}
/** Campaign members joined to their character (PC roster + user map). */
export function campaignMembersWithChars(campaignId: string) {
  return db().from('campaign_members')
    .select('character_id, user_id, characters:character_id(id, name)')
    .eq('campaign_id', campaignId)
    .not('character_id', 'is', null)
}
/** The viewer's character id in this campaign (Leave affordance). */
export function myCharacterInCampaign(campaignId: string, userId: string) {
  return db().from('campaign_members').select('character_id').eq('campaign_id', campaignId).eq('user_id', userId).maybeSingle()
}
/** The viewer's character id, requiring a non-null character (founder enroll). */
export function myFoundingCharacter(campaignId: string, userId: string) {
  return db().from('campaign_members').select('character_id').eq('campaign_id', campaignId).eq('user_id', userId).not('character_id', 'is', null).maybeSingle()
}
/** The user_id behind a campaign character (leader resolution). */
export function userIdForCharacter(campaignId: string, characterId: string) {
  return db().from('campaign_members').select('user_id').eq('campaign_id', campaignId).eq('character_id', characterId).maybeSingle()
}
/** Campaign pins (Homestead picker + publish coords). */
export function campaignPins(campaignId: string) {
  return db().from('campaign_pins').select('id, name, lat, lng').eq('campaign_id', campaignId).order('name')
}
/** A single pin's coords (publish Homestead lookup). */
export function pinCoords(pinId: string) {
  return db().from('campaign_pins').select('lat, lng').eq('id', pinId).maybeSingle()
}
/** A character's data blob (stockpile withdraw -> PC inventory). */
export function getCharacterData(characterId: string) {
  return db().from('characters').select('data').eq('id', characterId).single()
}
export function updateCharacterData(characterId: string, data: unknown) {
  return db().from('characters').update({ data: data as any }).eq('id', characterId)
}
/** Profile usernames for community-event authors. */
export function eventAuthorUsernames(ids: string[]) {
  return db().from('profiles').select('id, username').in('id', ids)
}
/** Fetch the apprentice NPC bonded to a master PC in a given campaign.
 *  Returns { memberId, npc, apprenticeMeta } or null if no active bond. */
export async function fetchApprenticeNpc(
  characterId: string,
  campaignId: string,
): Promise<{ memberId: string; npc: any; apprenticeMeta: any } | null> {
  const { data: bond } = await db()
    .from('community_members')
    .select('id, npc_id, apprentice_meta, communities!inner(campaign_id)')
    .eq('apprentice_of_character_id', characterId)
    .eq('recruitment_type', 'apprentice')
    .is('left_at', null)
    .eq('communities.campaign_id', campaignId)
    .maybeSingle()
  if (!bond || !(bond as any).npc_id) return null
  const { data: npc } = await db()
    .from('campaign_npcs')
    .select('*')
    .eq('id', (bond as any).npc_id)
    .maybeSingle()
  if (!npc) return null
  return { memberId: (bond as any).id, npc, apprenticeMeta: (bond as any).apprentice_meta }
}

/** Recruit-outcome roll_log rows for the dashboard (filtered client-side by community). */
export function recruitRolls(campaignId: string) {
  return db().from('roll_log')
    .select('character_name, label, damage_json, created_at')
    .eq('campaign_id', campaignId)
    .eq('outcome', 'recruit')
    .order('created_at', { ascending: false })
    .limit(200)
}
