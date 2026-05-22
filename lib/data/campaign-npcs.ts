// Repository: campaign_npcs (grand re-architecture Phase 1b exemplar).
//
// One of the hottest tables (50+ inline .from across components today).
// These functions are the typed seam consumers will call instead of
// hand-rolling `supabase.from('campaign_npcs')...`. Queries here mirror
// shapes that already exist in the codebase (e.g. the table page's
// roster refetch + per-NPC health update), so migrating a call site is a
// find-and-replace, not a behavior change. Grows as more call sites
// migrate (Phase 3/5).

import { db, type Row, type Update } from './db'

export type CampaignNpc = Row<'campaign_npcs'>

/** All NPCs for a campaign. Mirrors the table page's roster refetch. */
export async function getCampaignNpcs(campaignId: string): Promise<CampaignNpc[]> {
  const { data, error } = await db()
    .from('campaign_npcs')
    .select('*')
    .eq('campaign_id', campaignId)
  if (error) throw error
  return data ?? []
}

/**
 * Patch one NPC and return the updated row. Follows the project rule
 * (lessons.md): always `.select()` after `.update()` and surface the
 * error rather than fire-and-forget. Returns `{ data, error }` so callers
 * can keep their optimistic-state-then-reconcile flow.
 */
export async function updateCampaignNpc(id: string, patch: Update<'campaign_npcs'>) {
  return db()
    .from('campaign_npcs')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle()
}
