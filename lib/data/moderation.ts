// Repository: the /moderate dashboard's queries (grand re-architecture Phase 5).
//
// The moderation page hand-rolled 54 inline `supabase.from(...)` calls across
// 12 tables. This seam centralises them. Behavior-preserving: each fn returns
// the raw typed builder (drop-in for `const { data, error } = await ...`), and
// the call-site orchestration (Promise.all, conditional hydration, optimistic
// setState) stays put. `moderationPendingCounts()` is the one exception - it
// owns the 9-count fan-out and returns the computed counts object.
//
// READ side migrated first (this file's current contents - all non-destructive
// SELECT/count). The write/delete/suspend actions migrate in a second pass.

import { db } from './db'

export type ModerationStatus = 'pending' | 'approved' | 'rejected'

/**
 * The pending-queue badge counts for every section. Owns the 9-query fan-out
 * (was inline in loadPendingCounts) and returns the counts object the page
 * feeds straight into setPendingCounts.
 */
export async function moderationPendingCounts() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const c = db()
  const [rumorsRes, npcsRes, commsRes, usersRes, modulesRes, forumsRes, warstoriesRes, lfgRes, bugsRes] = await Promise.all([
    c.from('map_pins').select('id', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending'),
    c.from('world_npcs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    c.from('world_communities').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
    c.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    c.from('modules').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending').eq('visibility', 'listed'),
    c.from('forum_threads').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
    c.from('war_stories').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
    c.from('lfg_posts').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
    c.from('bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ])
  return {
    rumors: rumorsRes.count ?? 0,
    npcs: npcsRes.count ?? 0,
    communities: commsRes.count ?? 0,
    users: usersRes.count ?? 0,
    modules: modulesRes.count ?? 0,
    forums: forumsRes.count ?? 0,
    warstories: warstoriesRes.count ?? 0,
    lfg: lfgRes.count ?? 0,
    bugs: bugsRes.count ?? 0,
  }
}

// --- Per-section loaders (drop-in builders) ---------------------------------

/** Rumor map_pins for the moderation queue (joins the author username). */
export function loadRumorPins(status: ModerationStatus) {
  return db().from('map_pins')
    .select('*, profiles!map_pins_user_id_fkey(username)')
    .eq('pin_type', 'rumor')
    .eq('status', status)
    .order('created_at', { ascending: false })
}

/** Most-recent bug reports (capped at 100). */
export function loadBugReports() {
  return db().from('bug_reports')
    .select('id, reporter_id, reporter_email, reporter_name, page_url, description, user_agent, status, thriver_notes, response_text, responded_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
}

/** Pending world_npcs (author username joined). Always the 'pending' queue. */
export function loadPendingWorldNpcs() {
  return db().from('world_npcs')
    .select('*, profiles:created_by(username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
}

/** world_communities rows for a moderation status (publisher/campaign hydrated separately). */
export function loadWorldCommunitiesByStatus(status: ModerationStatus) {
  return db().from('world_communities').select('*').eq('moderation_status', status).order('created_at', { ascending: false })
}

/** Listed modules for a moderation status (author hydrated separately). */
export function loadModulesByStatus(status: ModerationStatus) {
  return db().from('modules').select('*').eq('moderation_status', status).eq('visibility', 'listed').order('created_at', { ascending: false })
}

/** forum_threads for a moderation status (author/campaign hydrated separately). */
export function loadForumThreadsByStatus(status: ModerationStatus) {
  return db().from('forum_threads').select('*').eq('moderation_status', status).order('created_at', { ascending: false })
}

/** war_stories for a moderation status (author/campaign hydrated separately). */
export function loadWarStoriesByStatus(status: ModerationStatus) {
  return db().from('war_stories').select('*').eq('moderation_status', status).order('created_at', { ascending: false })
}

/** lfg_posts for a moderation status (author hydrated separately). */
export function loadLfgPostsByStatus(status: ModerationStatus) {
  return db().from('lfg_posts').select('*').eq('moderation_status', status).order('created_at', { ascending: false })
}

/** A single profile's role (for the Thriver-gate banner). */
export function getProfileRole(userId: string) {
  return db().from('profiles').select('role').eq('id', userId).maybeSingle()
}

// --- Reusable two-step hydration helpers (used by 5 loaders) ----------------
// The moderation list loaders do a plain SELECT then batch-look-up author
// usernames + source-campaign names by id. These are the shared lookups.
// NOTE: call sites keep their `ids.length > 0 ? helper(ids) : Promise.resolve(...)`
// guard so the no-rows case still skips the round-trip exactly as before.

/** profiles (id, username) for a set of ids. */
export function usernamesByIds(ids: string[]) {
  return db().from('profiles').select('id, username').in('id', ids)
}

/** campaigns (id, name) for a set of ids. */
export function campaignNamesByIds(ids: string[]) {
  return db().from('campaigns').select('id, name').in('id', ids)
}
