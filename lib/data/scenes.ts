// Data-layer helpers for tactical scenes (kept out of the table god-component
// so the raw .from(...) lives in lib/data per the seam rule). Used by the
// header "Tactical Map" scene-picker dropdown (2026-05-25).
import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultSpawnCell } from '../tactical-spawn'

export interface PartyPc { characterId: string; name: string; portraitUrl: string | null }

// Ensure every party PC has a LIVE token on the scene: skip ones already live,
// un-archive removed ones (restoring their preserved position), and insert any
// never-placed ones clustered top-left via the shared spawn helper. Idempotent.
// Returns true if it changed anything (caller can refresh). Xero 2026-05-25:
// "don't make me place them each time; a char can be in as many scenes as the
// campaign has - they're never run at the same time."
export async function ensurePartyOnScene(supabase: SupabaseClient, sceneId: string, party: PartyPc[]): Promise<boolean> {
  if (party.length === 0) return false
  const { data: existing } = await supabase
    .from('scene_tokens').select('id, character_id, archived_at, grid_x, grid_y').eq('scene_id', sceneId)
  const byChar = new Map<string, any>()
  for (const t of existing ?? []) if ((t as any).character_id) byChar.set((t as any).character_id, t)
  const occupied = (existing ?? []).filter((t: any) => !t.archived_at).map((t: any) => ({ grid_x: t.grid_x, grid_y: t.grid_y }))
  const { data: scene } = await supabase.from('tactical_scenes').select('grid_cols, grid_rows').eq('id', sceneId).maybeSingle()
  const cols = (scene as any)?.grid_cols ?? 20, rows = (scene as any)?.grid_rows ?? 15
  const unarchiveIds: string[] = []
  const inserts: any[] = []
  for (const pc of party) {
    const ex = byChar.get(pc.characterId)
    if (ex && !ex.archived_at) continue // already on the map
    if (ex && ex.archived_at) { unarchiveIds.push(ex.id); if (ex.grid_x != null) occupied.push({ grid_x: ex.grid_x, grid_y: ex.grid_y }); continue }
    const spawn = defaultSpawnCell(cols, rows, occupied)
    occupied.push(spawn)
    inserts.push({ scene_id: sceneId, name: pc.name, token_type: 'pc', character_id: pc.characterId, is_visible: true, color: '#7ab3d4', portrait_url: pc.portraitUrl, grid_x: spawn.grid_x, grid_y: spawn.grid_y })
  }
  if (unarchiveIds.length) await supabase.from('scene_tokens').update({ archived_at: null }).in('id', unarchiveIds)
  if (inserts.length) await supabase.from('scene_tokens').insert(inserts)
  return unarchiveIds.length > 0 || inserts.length > 0
}

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
