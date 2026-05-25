// Data-layer helpers for tactical scenes (kept out of the table god-component
// so the raw .from(...) lives in lib/data per the seam rule). Used by the
// header "Tactical Map" scene-picker dropdown (2026-05-25).
import type { SupabaseClient } from '@supabase/supabase-js'

export function listCampaignScenes(supabase: SupabaseClient, campaignId: string) {
  return supabase
    .from('tactical_scenes')
    .select('id, name, is_active')
    .eq('campaign_id', campaignId)
    .order('created_at')
}

// Make exactly one scene active: clear the campaign's active flag, then set it
// on the chosen scene. TacticalMap's tactical_scenes subscription picks the
// new is_active up and re-renders.
export async function activateCampaignScene(supabase: SupabaseClient, campaignId: string, sceneId: string) {
  await supabase.from('tactical_scenes').update({ is_active: false }).eq('campaign_id', campaignId)
  await supabase.from('tactical_scenes').update({ is_active: true }).eq('id', sceneId)
}

// Create a fresh blank scene, make it the active one, and return its id (or
// null on error). Mirrors TacticalMap.createScene's insert + deactivate-others.
export async function createCampaignScene(supabase: SupabaseClient, campaignId: string, name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tactical_scenes')
    .insert({ campaign_id: campaignId, name, grid_cols: 20, grid_rows: 15, cell_feet: 3, cell_px: 35, is_active: true, has_grid: true })
    .select('id')
    .single()
  if (error || !data) return null
  await supabase.from('tactical_scenes').update({ is_active: false }).eq('campaign_id', campaignId).neq('id', (data as any).id)
  return (data as any).id as string
}
