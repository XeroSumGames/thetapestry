// Repository: the world-map (MapView) queries (grand re-architecture Phase 5).
//
// MapView hand-rolled 28 inline `supabase.from(...)` DB calls plus 7
// `supabase.storage.from('pin-attachments')` calls across 10 tables. This
// seam centralises them. Behavior-preserving: each fn returns the raw typed
// builder (drop-in for `const { data, error } = await ...`), so the call-site
// orchestration (optimistic setState, conditional hydration, the username /
// campaign-name two-step lookups) stays put. Every delete/update stays scoped
// to its exact `.eq` filter - never broaden.

import { db, type Insert, type Update } from './db'

// --- Reads -----------------------------------------------------------------

/** Whispers feed (most recent 100; author usernames hydrated separately). */
export function loadWhispersFeed() {
  return db().from('whispers')
    .select('id, author_user_id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
}

/** profiles (id, username) for a set of ids. */
export function profileUsernames(ids: string[]) {
  return db().from('profiles').select('id, username').in('id', ids)
}

/** profiles (id, username, role) - role drives the CANON badge in loadPins. */
export function profilesWithRole(ids: string[]) {
  return db().from('profiles').select('id, username, role').in('id', ids)
}

/** A single profile's role (for the survivor/thriver gate on init). */
export function getProfileRole(userId: string) {
  return db().from('profiles').select('role').eq('id', userId).single()
}

/** Campaigns the user GMs (for the encounter-modal picker). */
export function gmCampaigns(userId: string) {
  return db().from('campaigns').select('id, name').eq('gm_user_id', userId).order('name')
}

/** campaigns (id, name) for a set of ids (attribution on community popups). */
export function campaignNamesByIds(ids: string[]) {
  return db().from('campaigns').select('id, name').in('id', ids)
}

/** The user's approved published communities (eligible link-proposal "from" endpoints). */
export function approvedCommunitiesForCampaigns(campaignIds: string[]) {
  return db().from('world_communities')
    .select('id, name')
    .eq('moderation_status', 'approved')
    .in('source_campaign_id', campaignIds)
    .order('name')
}

/** The user's community subscriptions (seeds the Follow button state). */
export function mySubscriptions(userId: string) {
  return db().from('community_subscriptions').select('world_community_id').eq('user_id', userId)
}

/** Campaigns the user is a member of, with the campaign name joined. */
export function myCampaignMemberships(userId: string) {
  return db().from('campaign_members').select('campaign_id, campaigns(name)').eq('user_id', userId)
}

/** Revealed campaign pins across the given campaigns. */
export function revealedCampaignPins(campaignIds: string[]) {
  return db().from('campaign_pins').select('*').in('campaign_id', campaignIds).eq('revealed', true)
}

/** All map pins, newest first. */
export function allMapPins() {
  return db().from('map_pins').select('*').order('created_at', { ascending: false })
}

/** Approved world_communities that have homestead coords (the map overlay). */
export function approvedCommunitiesWithCoords() {
  return db().from('world_communities')
    .select('id, name, description, homestead_lat, homestead_lng, size_band, faction_label, community_status, source_campaign_id, last_public_update_at, subscriber_count')
    .eq('moderation_status', 'approved')
    .not('homestead_lat', 'is', null)
    .not('homestead_lng', 'is', null)
}

/** Active community-to-community links (trade/alliance/feud polylines). */
export function activeCommunityLinks() {
  return db().from('world_community_links')
    .select('id, community_a_id, community_b_id, link_type, narrative')
    .eq('status', 'active')
}

/** An existing pending encounter for this community+campaign (dup follow-up path). */
export function findPendingEncounter(worldCommunityId: string, campaignId: string) {
  return db().from('community_encounters')
    .select('id, narrative')
    .eq('world_community_id', worldCommunityId)
    .eq('encountering_campaign_id', campaignId)
    .eq('status', 'pending')
    .maybeSingle()
}

// --- Writes / deletes ------------------------------------------------------

export function followCommunity(userId: string, worldCommunityId: string) {
  return db().from('community_subscriptions').insert({ user_id: userId, world_community_id: worldCommunityId })
}
export function unfollowCommunity(userId: string, worldCommunityId: string) {
  return db().from('community_subscriptions').delete().eq('user_id', userId).eq('world_community_id', worldCommunityId)
}
export function insertCommunityLink(row: Insert<'world_community_links'>) {
  return db().from('world_community_links').insert(row)
}
export function insertCommunityEncounter(row: Insert<'community_encounters'>) {
  return db().from('community_encounters').insert(row)
}
export function updateEncounterNarrative(id: string, narrative: string) {
  return db().from('community_encounters').update({ narrative }).eq('id', id)
}
export function insertWhisper(authorUserId: string, content: string) {
  return db().from('whispers').insert({ author_user_id: authorUserId, content })
}
export function deleteWhisper(id: string) {
  return db().from('whispers').delete().eq('id', id)
}
/** Insert a pin and return the created row (.select().single()). */
export function insertMapPin(row: Insert<'map_pins'>) {
  return db().from('map_pins').insert(row).select().single()
}
export function deleteMapPin(id: string) {
  return db().from('map_pins').delete().eq('id', id)
}
export function updateMapPinStatus(id: string, status: string) {
  return db().from('map_pins').update({ status }).eq('id', id)
}
/** Dynamic patch from the edit form (callers build a Record). */
export function updateMapPin(id: string, patch: Record<string, unknown>) {
  return db().from('map_pins').update(patch as Update<'map_pins'>).eq('id', id)
}
export function updateMapPinType(id: string, pinType: string) {
  return db().from('map_pins').update({ pin_type: pinType }).eq('id', id)
}
/** Fire-and-forget view bump (callers do not await). */
export function bumpPinViewCount(id: string, current: number) {
  return db().from('map_pins').update({ view_count: current + 1 }).eq('id', id)
}

// --- Storage (pin-attachments bucket) --------------------------------------
// Storage is data access too - keeping it behind the seam means MapView never
// touches `supabase.storage` directly. getPublicUrl is synchronous (returns
// { data: { publicUrl } } immediately); the rest return promises.

const PIN_BUCKET = 'pin-attachments'

export function uploadPinAttachment(path: string, file: File, opts: { contentType?: string; upsert?: boolean }) {
  return db().storage.from(PIN_BUCKET).upload(path, file, opts)
}
export function listPinAttachments(prefix: string) {
  return db().storage.from(PIN_BUCKET).list(prefix)
}
export function pinAttachmentPublicUrl(path: string) {
  return db().storage.from(PIN_BUCKET).getPublicUrl(path)
}
export function removePinAttachments(paths: string[]) {
  return db().storage.from(PIN_BUCKET).remove(paths)
}
