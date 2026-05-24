// Repository: the tactical map (components/TacticalMap.tsx) queries (grand
// re-architecture Phase 5).
//
// TacticalMap hand-rolled 28 inline `supabase.from(...)` calls across 3 tables
// (tactical_scenes, scene_tokens, campaigns). This seam centralises them as
// drop-in builders: each returns the raw typed builder so `const { data,
// error } = await fn(args)` is a one-line swap and the call-site orchestration
// (optimistic setTokens/setScene, the wall/fog autosave, the multi-step scene
// create/activate/resize flows) stays put. Every .eq/.is/.neq is preserved
// verbatim; deletes stay scoped.

import { db, type Insert, type Update } from './db'

// --- tactical_scenes --------------------------------------------------------

/** All scenes for a campaign, newest first (loadScenes auto-picks is_active). */
export function campaignScenes(campaignId: string) {
  return db().from('tactical_scenes').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false })
}
/** Insert a scene (call site chains .select().single() for the created row). */
export function insertScene(row: Insert<'tactical_scenes'>) {
  return db().from('tactical_scenes').insert(row)
}
/** Generic single-scene patch (walls / fog_state / is_active / grid / lighting). */
export function updateScene(id: string, patch: Update<'tactical_scenes'>) {
  return db().from('tactical_scenes').update(patch).eq('id', id)
}
/** Deactivate every OTHER scene in the campaign (on activate-by-create). */
export function deactivateOtherScenes(campaignId: string, exceptId: string) {
  return db().from('tactical_scenes').update({ is_active: false }).eq('campaign_id', campaignId).neq('id', exceptId)
}
/** Deactivate every scene in the campaign (first half of activateScene). */
export function deactivateAllScenes(campaignId: string) {
  return db().from('tactical_scenes').update({ is_active: false }).eq('campaign_id', campaignId)
}

// --- scene_tokens -----------------------------------------------------------

/** Live (non-archived) tokens for a scene. */
export function sceneTokens(sceneId: string) {
  return db().from('scene_tokens').select('*').eq('scene_id', sceneId).is('archived_at', null)
}
/** Generic single-token patch (position / door / visibility / scale / etc.). */
export function updateToken(id: string, patch: Update<'scene_tokens'>) {
  return db().from('scene_tokens').update(patch).eq('id', id)
}
/** Insert one or many tokens (resize-remap rebuilds the whole set). */
export function insertTokens(rows: Insert<'scene_tokens'> | Insert<'scene_tokens'>[]) {
  return db().from('scene_tokens').insert(rows as any)
}
export function deleteToken(id: string) {
  return db().from('scene_tokens').delete().eq('id', id)
}
/** Wipe a scene's tokens (resize-remap clears before re-inserting). */
export function deleteTokensForScene(sceneId: string) {
  return db().from('scene_tokens').delete().eq('scene_id', sceneId)
}

// --- campaigns (vehicles JSON, for the passenger-move sync) ------------------

export function campaignVehiclesOnly(campaignId: string) {
  return db().from('campaigns').select('vehicles').eq('id', campaignId).maybeSingle()
}
