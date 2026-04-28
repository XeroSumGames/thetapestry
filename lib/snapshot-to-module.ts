// Pure transform from a campaign-snapshot JSON file (the export format
// produced by `lib/campaign-snapshot.ts`) into a `ModuleSnapshot` ready
// to feed into `publishModuleVersion`. No DB calls, no auth — runs
// entirely on the parsed JSON object.
//
// Mirrors the field selection in `buildCampaignSnapshot` so a module
// published from a snapshot file is indistinguishable from one
// published from the live campaign it came from.
//
// What's intentionally dropped:
//   • character_states[] — orphan live-state references; the underlying
//     `characters` rows aren't in the snapshot, so the IDs would dangle
//   • campaign_id / captured_at / version metadata — not part of the
//     module shape; the new module gets its own metadata at publish time
//   • PC tokens (token.character_id != null) — PCs don't travel with
//     modules, same rule as buildCampaignSnapshot
//   • per-NPC live state (wp_current/rp_current/death_countdown/incap)
//     — clones start fresh

import type { ModuleSnapshot, SnapshotCounts } from './modules'

// Loose shape — we treat the file leniently and skip unknown sections.
export interface CampaignSnapshotFile {
  npcs?: any[]
  pins?: any[]
  notes?: any[]
  scenes?: { scene: any; tokens?: any[] }[]
  // Anything else (character_states, version, captured_at, …) is ignored.
  [key: string]: any
}

export interface SnapshotTransformOptions {
  includePins?: boolean
  includeNpcs?: boolean
  includeScenes?: boolean
  includeHandouts?: boolean
}

export interface SnapshotTransformResult {
  snapshot: ModuleSnapshot
  counts: SnapshotCounts
}

export function snapshotToModuleSnapshot(
  file: CampaignSnapshotFile,
  options: SnapshotTransformOptions = {},
): SnapshotTransformResult {
  const opts = {
    includePins: options.includePins ?? true,
    includeNpcs: options.includeNpcs ?? true,
    includeScenes: options.includeScenes ?? true,
    includeHandouts: options.includeHandouts ?? true,
  }

  const snapshot: ModuleSnapshot = {}
  const counts: SnapshotCounts = { pins: 0, npcs: 0, scenes: 0, tokens: 0, handouts: 0 }

  if (opts.includePins && Array.isArray(file.pins)) {
    snapshot.pins = file.pins.map((p: any) => ({
      _external_id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      notes: p.notes ?? '',
      category: p.category ?? 'location',
      sort_order: p.sort_order,
    }))
    counts.pins = snapshot.pins.length
  }

  if (opts.includeNpcs && Array.isArray(file.npcs)) {
    snapshot.npcs = file.npcs.map((n: any) => ({
      _external_id: n.id,
      _pin_external_id: n.campaign_pin_id ?? undefined,
      name: n.name,
      reason: n.reason,
      acumen: n.acumen,
      physicality: n.physicality,
      influence: n.influence,
      dexterity: n.dexterity,
      wp_max: n.wp_max,
      rp_max: n.rp_max,
      skills: n.skills,
      equipment: n.equipment,
      notes: n.notes,
      motivation: n.motivation,
      portrait_url: n.portrait_url,
      npc_type: n.npc_type,
      sort_order: n.sort_order,
    }))
    counts.npcs = snapshot.npcs.length
  }

  if (opts.includeScenes && Array.isArray(file.scenes)) {
    snapshot.scenes = file.scenes.map((wrap: any) => {
      // Snapshot files wrap each scene as { scene: {...}, tokens: [...] }
      // — flatten to the ModuleSnapshotScene shape (scene fields at top
      // level, tokens as a child array).
      const s = wrap.scene ?? {}
      const rawTokens: any[] = Array.isArray(wrap.tokens) ? wrap.tokens : []
      // PC tokens (linked to a character_id) don't travel with modules.
      const usefulTokens = rawTokens.filter((t: any) => !t.character_id)
      const tokens = usefulTokens.map((t: any) => ({
        _external_id: t.id,
        _npc_external_id: t.npc_id ?? undefined,
        name: t.name,
        token_type: t.token_type,
        portrait_url: t.portrait_url,
        grid_x: t.grid_x,
        grid_y: t.grid_y,
        color: t.color,
        is_visible: t.is_visible,
        wp_max: t.wp_max,
        destroyed_portrait_url: t.destroyed_portrait_url,
        lootable: t.lootable,
      }))
      counts.tokens += tokens.length
      return {
        _external_id: s.id,
        name: s.name,
        grid_cols: s.grid_cols,
        grid_rows: s.grid_rows,
        background_url: s.background_url,
        cell_px: s.cell_px,
        cell_feet: s.cell_feet,
        has_grid: s.has_grid,
        img_scale: s.img_scale,
        tokens,
      }
    })
    counts.scenes = snapshot.scenes.length
  }

  if (opts.includeHandouts && Array.isArray(file.notes)) {
    snapshot.handouts = file.notes.map((h: any) => ({
      _external_id: h.id,
      title: h.title,
      content: h.content ?? '',
      attachments: Array.isArray(h.attachments) ? h.attachments : [],
    }))
    counts.handouts = snapshot.handouts.length
  }

  return { snapshot, counts }
}

// Sanity check — does this object look like a campaign-snapshot file?
// Used by /modules/import to reject non-snapshot uploads early with a
// clear error message instead of letting the transform produce empty
// arrays silently.
export function looksLikeCampaignSnapshot(file: any): boolean {
  if (!file || typeof file !== 'object') return false
  // The export always carries at least these top-level keys, even when
  // the campaign is empty (arrays are present, just empty).
  return (
    Array.isArray(file.npcs) &&
    Array.isArray(file.pins) &&
    Array.isArray(file.scenes)
  )
}
