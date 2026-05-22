// Repository: campaign_npcs (grand re-architecture Phase 1b/3 exemplar).
//
// One of the hottest tables (50+ inline .from across components today).
// These functions are the typed seam consumers call instead of hand-
// rolling `supabase.from('campaign_npcs')...`.
//
// CONVENTION (behavior-preserving migration): repos return the raw
// Supabase `{ data, error }` result, just TYPED. So an existing call site
// `const { data, error } = await supabase.from('campaign_npcs')...` becomes
// a true drop-in `const { data, error } = await getCampaignNpcs(id)` - same
// shape, same error handling, same Promise.all behavior, now with the table
// name + columns centralised and the row typed. Error-handling improvements
// (throw-on-error wrappers, etc.) are a separate, later concern; the seam's
// first job is centralisation + typing without changing behavior.

import { db, type Row, type Update } from './db'

export type CampaignNpc = Row<'campaign_npcs'>

/**
 * All NPCs for a campaign. Drop-in for the ubiquitous
 * `supabase.from('campaign_npcs').select('*').eq('campaign_id', id)`.
 */
export function getCampaignNpcs(campaignId: string) {
  return db().from('campaign_npcs').select('*').eq('campaign_id', campaignId)
}

/**
 * Patch one NPC. Drop-in for `supabase.from('campaign_npcs').update(p).eq('id', id)`.
 * Pass `.select()` follow-up at the call site if it needs the row back; this
 * mirrors the bare update shape most call sites use.
 */
export function updateCampaignNpc(id: string, patch: Update<'campaign_npcs'>) {
  return db().from('campaign_npcs').update(patch).eq('id', id)
}

/**
 * Insert one or many NPC rows. Drop-in for `supabase.from('campaign_npcs').insert(rows)`.
 * Payload typed loosely during migration (rows are built dynamically by the
 * NPC generator); tighten to Insert<'campaign_npcs'> in a later typing pass.
 */
export function insertCampaignNpcs(rows: any) {
  return db().from('campaign_npcs').insert(rows)
}
