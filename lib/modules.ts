// Phase 5 Sprint 1 — Module System client helpers.
//
// The MVP loop is: an author publishes a module_versions row with a
// flat jsonb snapshot of their campaign's content; a subscriber
// campaign clones that snapshot into its own rows via
// cloneModuleIntoCampaign. Cloned rows carry source_module_* pointers
// so Phase B can diff+merge upstream updates without re-cloning.
//
// No RPC / stored procedure — everything runs through the supabase-js
// client so RLS applies. The clone is not atomic at the DB level; if a
// later step fails the caller is expected to surface the error and
// leave the partial state visible (same pattern the existing setting
// seed pipeline in /app/campaigns/new uses).

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Shapes that a module snapshot carries ──────────────────────
// These are loose on purpose: the publish wizard (Sprint 2) is the
// authority on what's written into module_versions.snapshot; this
// module is a lenient reader. Fields are carried through verbatim
// where the column names match, with defaults for anything missing.

export interface ModuleSnapshotNpc {
  _external_id?: string      // original campaign_npcs.id at publish time
  _pin_external_id?: string  // original campaign_pin_id (for pin remap)
  name: string
  reason?: number | null
  acumen?: number | null
  physicality?: number | null
  influence?: number | null
  dexterity?: number | null
  wp_max?: number | null
  rp_max?: number | null
  skills?: any
  equipment?: any
  notes?: string | null
  motivation?: string | null
  portrait_url?: string | null
  npc_type?: string | null
  sort_order?: number | null
  [key: string]: any
}

export interface ModuleSnapshotPin {
  _external_id?: string
  name: string
  lat: number | null
  lng: number | null
  notes?: string | null
  category?: string | null
  sort_order?: number | null
  [key: string]: any
}

export interface ModuleSnapshotSceneToken {
  _external_id?: string
  _npc_external_id?: string  // if this token represents an NPC, remap via npcMap
  name?: string | null
  token_type: 'npc' | 'pc' | 'object' | string
  portrait_url?: string | null
  grid_x?: number | null
  grid_y?: number | null
  color?: string | null
  is_visible?: boolean | null
  wp_max?: number | null
  wp_current?: number | null
  destroyed_portrait_url?: string | null
  lootable?: boolean | null
  [key: string]: any
}

export interface ModuleSnapshotScene {
  _external_id?: string
  name: string
  grid_cols?: number | null
  grid_rows?: number | null
  background_url?: string | null
  cell_px?: number | null
  cell_feet?: number | null
  has_grid?: boolean | null
  img_scale?: number | null
  tokens?: ModuleSnapshotSceneToken[]
  [key: string]: any
}

export interface ModuleSnapshotHandout {
  _external_id?: string
  title: string
  content: string | null
  attachments?: any[]
  [key: string]: any
}

export interface ModuleSnapshot {
  npcs?: ModuleSnapshotNpc[]
  pins?: ModuleSnapshotPin[]
  scenes?: ModuleSnapshotScene[]
  handouts?: ModuleSnapshotHandout[]
  [key: string]: any
}

export interface ModuleListing {
  id: string
  name: string
  tagline: string | null
  description: string | null
  cover_image_url: string | null
  parent_setting: string | null
  author_user_id: string | null
  visibility: 'private' | 'unlisted' | 'listed'
  latest_version_id: string | null
  latest_version?: {
    id: string
    version: string
    published_at: string
  } | null
}

export interface CloneResult {
  subscriptionId: string
  counts: {
    pins: number
    npcs: number
    scenes: number
    tokens: number
    handouts: number
  }
}

export interface SnapshotCounts {
  pins: number
  npcs: number
  scenes: number
  tokens: number
  handouts: number
}

export interface BuildSnapshotOptions {
  includePins?: boolean
  includeNpcs?: boolean
  includeScenes?: boolean
  includeHandouts?: boolean
}

export interface ModuleForCampaign {
  id: string
  name: string
  tagline: string | null
  description: string | null
  parent_setting: string | null
  visibility: 'private' | 'unlisted' | 'listed'
  latest_version_id: string | null
  latest_version: {
    id: string
    version: string
    version_major: number
    version_minor: number
    version_patch: number
    published_at: string
  } | null
}

// ── listAvailableModules ───────────────────────────────────────
// Returns modules the current user can pick from campaign-creation:
// their own + anything listed+approved. Unlisted modules are omitted
// because they're invite-link-only by convention.
export async function listAvailableModules(
  supabase: SupabaseClient,
): Promise<ModuleListing[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // RLS already restricts reads; we just need to include unlisted
  // modules here when we add invite-link support later. For MVP we
  // fetch everything SELECT-able and let RLS do the heavy lifting.
  const { data, error } = await supabase
    .from('modules')
    .select('id, name, tagline, description, cover_image_url, parent_setting, author_user_id, visibility, latest_version_id, latest_version:module_versions!modules_latest_version_id_fkey(id, version, published_at)')
    .not('latest_version_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    // The FK-named join above may not match your schema's auto-named
    // constraint. Fallback to a two-step fetch if the join errors out.
    return listAvailableModulesFallback(supabase)
  }

  // Supabase returns the related row as an array even for 1:1 joins;
  // normalize it down.
  return (data ?? []).map((r: any) => ({
    ...r,
    latest_version: Array.isArray(r.latest_version) ? r.latest_version[0] ?? null : r.latest_version ?? null,
  })) as ModuleListing[]
}

async function listAvailableModulesFallback(
  supabase: SupabaseClient,
): Promise<ModuleListing[]> {
  const { data: modules, error } = await supabase
    .from('modules')
    .select('id, name, tagline, description, cover_image_url, parent_setting, author_user_id, visibility, latest_version_id')
    .not('latest_version_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error || !modules) return []
  const versionIds = modules.map((m: any) => m.latest_version_id).filter(Boolean)
  if (versionIds.length === 0) {
    return modules.map((m: any) => ({ ...m, latest_version: null })) as ModuleListing[]
  }
  const { data: versions } = await supabase
    .from('module_versions')
    .select('id, version, published_at')
    .in('id', versionIds)
  const byId = new Map<string, any>((versions ?? []).map((v: any) => [v.id, v]))
  return modules.map((m: any) => ({
    ...m,
    latest_version: byId.get(m.latest_version_id) ?? null,
  })) as ModuleListing[]
}

// ── cloneModuleIntoCampaign ────────────────────────────────────
// Copies a module version's snapshot into an existing campaign. The
// campaign must already exist (typical call site is right after
// campaigns INSERT in the create-campaign flow). Order matters: pins
// first so NPC → pin links can resolve, scenes before tokens, then
// handouts. Each section records source_module_id +
// source_module_version_id on the cloned rows.
//
// Not atomic — if a later step fails, earlier rows stay committed.
// Callers should surface the error message alongside "campaign was
// partially seeded" the same way the setting-seed pipeline already
// does.
export async function cloneModuleIntoCampaign(
  supabase: SupabaseClient,
  versionId: string,
  campaignId: string,
): Promise<CloneResult> {
  // 1. Load the version + its parent module id.
  const { data: version, error: vErr } = await supabase
    .from('module_versions')
    .select('id, module_id, snapshot')
    .eq('id', versionId)
    .single()
  if (vErr || !version) {
    throw new Error(`Load module version failed: ${vErr?.message ?? 'not found'}`)
  }
  const snapshot = (version.snapshot ?? {}) as ModuleSnapshot
  const source_module_id = version.module_id as string
  const source_module_version_id = version.id as string

  const counts = { pins: 0, npcs: 0, scenes: 0, tokens: 0, handouts: 0 }

  // 2. Pins first — NPCs and (in the future) pin-anchored content
  // reference them. We key the remap on _external_id when present,
  // falling back to name for older snapshots that didn't capture it.
  const pinMap: Record<string, string> = {}
  const pinNameMap: Record<string, string> = {}
  if (snapshot.pins && snapshot.pins.length > 0) {
    const pinRows = snapshot.pins.map((p, i) => ({
      campaign_id: campaignId,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      notes: p.notes ?? '',
      category: p.category ?? 'location',
      revealed: false,
      sort_order: p.sort_order ?? i + 1,
      source_module_id,
      source_module_version_id,
    }))
    const { data: inserted, error: pErr } = await supabase
      .from('campaign_pins')
      .insert(pinRows)
      .select('id, name')
    if (pErr) throw new Error(`pins: ${pErr.message}`)
    inserted?.forEach((row: any, i: number) => {
      const src = snapshot.pins![i]
      if (src._external_id) pinMap[src._external_id] = row.id
      pinNameMap[row.name] = row.id
    })
    counts.pins = inserted?.length ?? 0
  }

  // 3. NPCs — remap campaign_pin_id through pinMap / pinNameMap. Keep
  // WP/RP current at max on clone since a module-derived campaign is
  // fresh, no matter how worn the source campaign's NPCs got.
  const npcMap: Record<string, string> = {}
  if (snapshot.npcs && snapshot.npcs.length > 0) {
    const npcRows = snapshot.npcs.map((n, i) => {
      const pinId =
        (n._pin_external_id && pinMap[n._pin_external_id])
        ?? (n.pin_name && pinNameMap[n.pin_name])
        ?? null
      return {
        campaign_id: campaignId,
        campaign_pin_id: pinId,
        name: n.name,
        reason: n.reason ?? null,
        acumen: n.acumen ?? null,
        physicality: n.physicality ?? null,
        influence: n.influence ?? null,
        dexterity: n.dexterity ?? null,
        skills: n.skills ?? null,
        equipment: n.equipment ?? null,
        notes: n.notes ?? null,
        motivation: n.motivation ?? null,
        portrait_url: n.portrait_url ?? null,
        npc_type: n.npc_type ?? null,
        wp_max: n.wp_max ?? null,
        rp_max: n.rp_max ?? null,
        wp_current: n.wp_max ?? null,
        rp_current: n.rp_max ?? null,
        status: 'active',
        sort_order: n.sort_order ?? i + 1,
        source_module_id,
        source_module_version_id,
      }
    })
    const { data: inserted, error: nErr } = await supabase
      .from('campaign_npcs')
      .insert(npcRows)
      .select('id')
    if (nErr) throw new Error(`npcs: ${nErr.message}`)
    inserted?.forEach((row: any, i: number) => {
      const src = snapshot.npcs![i]
      if (src._external_id) npcMap[src._external_id] = row.id
    })
    counts.npcs = inserted?.length ?? 0
  }

  // 4. Scenes + their tokens. Each scene is inserted individually so
  // we can keep the scene_id → tokens wiring straight. Token rows
  // remap npc_id through npcMap; tokens without a match are still
  // inserted (object tokens, PC tokens) with null npc_id.
  if (snapshot.scenes && snapshot.scenes.length > 0) {
    for (const scene of snapshot.scenes) {
      const { tokens, _external_id: _unused, ...rest } = scene
      const sceneRow = {
        campaign_id: campaignId,
        name: rest.name,
        grid_cols: rest.grid_cols ?? 20,
        grid_rows: rest.grid_rows ?? 15,
        background_url: rest.background_url ?? null,
        cell_px: rest.cell_px ?? 35,
        cell_feet: rest.cell_feet ?? 3,
        has_grid: rest.has_grid ?? true,
        img_scale: rest.img_scale ?? 1,
        is_active: false,
        source_module_id,
        source_module_version_id,
      }
      const { data: createdScene, error: sErr } = await supabase
        .from('tactical_scenes')
        .insert(sceneRow)
        .select('id')
        .single()
      if (sErr || !createdScene) throw new Error(`scenes: ${sErr?.message ?? 'insert failed'}`)
      counts.scenes += 1

      if (tokens && tokens.length > 0) {
        const tokenRows = tokens.map((t) => ({
          scene_id: createdScene.id,
          name: t.name ?? null,
          token_type: t.token_type ?? 'object',
          portrait_url: t.portrait_url ?? null,
          grid_x: t.grid_x ?? null,
          grid_y: t.grid_y ?? null,
          color: t.color ?? null,
          is_visible: t.is_visible ?? true,
          wp_max: t.wp_max ?? null,
          wp_current: t.wp_max ?? null,
          destroyed_portrait_url: t.destroyed_portrait_url ?? null,
          lootable: t.lootable ?? null,
          // NPC-linked tokens remap; character-linked tokens never
          // clone (PCs don't travel with modules).
          npc_id: t._npc_external_id ? (npcMap[t._npc_external_id] ?? null) : null,
          character_id: null,
          source_module_id,
          source_module_version_id,
        }))
        const { error: tErr } = await supabase
          .from('scene_tokens')
          .insert(tokenRows)
        if (tErr) throw new Error(`scene_tokens: ${tErr.message}`)
        counts.tokens += tokenRows.length
      }
    }
  }

  // 5. Handouts → campaign_notes.
  if (snapshot.handouts && snapshot.handouts.length > 0) {
    const handoutRows = snapshot.handouts.map((h) => ({
      campaign_id: campaignId,
      title: h.title,
      content: h.content ?? '',
      attachments: Array.isArray(h.attachments) ? h.attachments : [],
      source_module_id,
      source_module_version_id,
    }))
    const { error: hErr } = await supabase
      .from('campaign_notes')
      .insert(handoutRows)
    if (hErr) throw new Error(`handouts: ${hErr.message}`)
    counts.handouts = handoutRows.length
  }

  // 6. Subscription record. Duplicates the (campaign, module) pair
  // are blocked by UNIQUE; if the campaign was already subscribed to
  // this module we skip.
  const { data: subRow, error: subErr } = await supabase
    .from('module_subscriptions')
    .upsert(
      {
        campaign_id: campaignId,
        module_id: source_module_id,
        current_version_id: source_module_version_id,
        status: 'active',
      },
      { onConflict: 'campaign_id,module_id' },
    )
    .select('id')
    .single()
  if (subErr) {
    // Not fatal — the content is already cloned. Surface the error
    // so the caller can warn, but don't roll anything back.
    throw new Error(`module_subscription: ${subErr.message}`)
  }

  return {
    subscriptionId: subRow?.id ?? '',
    counts,
  }
}

// ── getModuleForCampaign ───────────────────────────────────────
// Returns the author's module for this campaign (if any). Used by
// the edit page to decide between "Publish as Module" (first time)
// and "Publish New Version" (re-publish). Only the author's own
// module counts — two GMs can't co-author the same source today.
export async function getModuleForCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<ModuleForCampaign | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('modules')
    .select('id, name, tagline, description, parent_setting, visibility, latest_version_id')
    .eq('source_campaign_id', campaignId)
    .eq('author_user_id', user.id)
    .maybeSingle()
  if (error || !data) return null

  let latest_version: ModuleForCampaign['latest_version'] = null
  if (data.latest_version_id) {
    const { data: v } = await supabase
      .from('module_versions')
      .select('id, version, version_major, version_minor, version_patch, published_at')
      .eq('id', data.latest_version_id)
      .maybeSingle()
    if (v) latest_version = v as any
  }

  return { ...(data as any), latest_version }
}

// ── buildCampaignSnapshot ──────────────────────────────────────
// Reads a campaign's live content and serializes it into the
// ModuleSnapshot shape. Each row keeps its database id as
// _external_id so cross-row links (NPC → pin, scene token → NPC)
// survive the clone into a new campaign. Per-session state
// (wp_current / rp_current / death_countdown / is_active etc) is
// intentionally omitted — a cloned module should start fresh.
export async function buildCampaignSnapshot(
  supabase: SupabaseClient,
  campaignId: string,
  options: BuildSnapshotOptions = {},
): Promise<{ snapshot: ModuleSnapshot; counts: SnapshotCounts }> {
  const opts = {
    includePins: options.includePins ?? true,
    includeNpcs: options.includeNpcs ?? true,
    includeScenes: options.includeScenes ?? true,
    includeHandouts: options.includeHandouts ?? true,
  }

  const snapshot: ModuleSnapshot = {}
  const counts: SnapshotCounts = { pins: 0, npcs: 0, scenes: 0, tokens: 0, handouts: 0 }

  if (opts.includePins) {
    const { data: pins, error } = await supabase
      .from('campaign_pins')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order')
    if (error) throw new Error(`Read pins: ${error.message}`)
    snapshot.pins = (pins ?? []).map((p: any) => ({
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

  if (opts.includeNpcs) {
    const { data: npcs, error } = await supabase
      .from('campaign_npcs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order')
    if (error) throw new Error(`Read npcs: ${error.message}`)
    snapshot.npcs = (npcs ?? []).map((n: any) => ({
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

  if (opts.includeScenes) {
    const { data: scenes, error } = await supabase
      .from('tactical_scenes')
      .select('*')
      .eq('campaign_id', campaignId)
    if (error) throw new Error(`Read scenes: ${error.message}`)
    const sceneRows = scenes ?? []
    const sceneIds = sceneRows.map((s: any) => s.id)
    const tokensByScene: Record<string, any[]> = {}
    if (sceneIds.length > 0) {
      const { data: tokens, error: tErr } = await supabase
        .from('scene_tokens')
        .select('*')
        .in('scene_id', sceneIds)
      if (tErr) throw new Error(`Read scene_tokens: ${tErr.message}`)
      for (const t of tokens ?? []) {
        ;(tokensByScene[t.scene_id] ??= []).push(t)
      }
    }
    snapshot.scenes = sceneRows.map((s: any) => {
      const rawTokens = tokensByScene[s.id] ?? []
      // Character-linked tokens (PC tokens) never clone — PCs don't
      // travel with modules. Filter them out at snapshot time.
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

  if (opts.includeHandouts) {
    const { data: handouts, error } = await supabase
      .from('campaign_notes')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at')
    if (error) throw new Error(`Read handouts: ${error.message}`)
    snapshot.handouts = (handouts ?? []).map((h: any) => ({
      _external_id: h.id,
      title: h.title,
      content: h.content ?? '',
      attachments: Array.isArray(h.attachments) ? h.attachments : [],
    }))
    counts.handouts = snapshot.handouts.length
  }

  return { snapshot, counts }
}

// ── publishModuleVersion ───────────────────────────────────────
// Creates (first publish) or updates (re-publish) a modules row +
// inserts a fresh module_versions row. The caller provides an
// already-built snapshot (see buildCampaignSnapshot). Semver is
// passed explicitly so the UI can bump major/minor/patch per the
// author's pick.
//
// Returns the module id + the freshly-inserted version id.
export interface PublishParams {
  campaignId: string
  moduleId?: string          // omit on first publish; required on re-publish
  name: string
  tagline?: string | null
  description?: string | null
  parentSetting?: string | null
  visibility: 'private' | 'unlisted' | 'listed'
  version: string            // '1.0.0', '1.1.0', etc.
  changelog?: string | null
  snapshot: ModuleSnapshot
}

export async function publishModuleVersion(
  supabase: SupabaseClient,
  params: PublishParams,
): Promise<{ moduleId: string; versionId: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not logged in')

  let moduleId = params.moduleId

  if (!moduleId) {
    // First publish — create the module row. Listed modules enter
    // Thriver moderation as 'pending'; private / unlisted skip the
    // queue.
    const { data, error } = await supabase
      .from('modules')
      .insert({
        author_user_id: user.id,
        source_campaign_id: params.campaignId,
        name: params.name,
        tagline: params.tagline ?? null,
        description: params.description ?? null,
        parent_setting: params.parentSetting ?? 'custom',
        visibility: params.visibility,
        moderation_status: params.visibility === 'listed' ? 'pending' : 'approved',
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`Create module failed: ${error?.message ?? 'unknown'}`)
    moduleId = data.id as string
  } else {
    // Re-publish — keep the module row alive, refresh metadata.
    // Listed re-submissions reset moderation to 'pending'; other
    // tiers stay approved.
    const update: any = {
      name: params.name,
      tagline: params.tagline ?? null,
      description: params.description ?? null,
      visibility: params.visibility,
    }
    if (params.visibility === 'listed') update.moderation_status = 'pending'
    const { error } = await supabase.from('modules').update(update).eq('id', moduleId)
    if (error) throw new Error(`Update module failed: ${error.message}`)
  }

  const parts = params.version.split('.').map((n) => parseInt(n, 10))
  const [major, minor, patch] = [parts[0] || 0, parts[1] || 0, parts[2] || 0]

  const { data: versionRow, error: vErr } = await supabase
    .from('module_versions')
    .insert({
      module_id: moduleId,
      version: params.version,
      version_major: major,
      version_minor: minor,
      version_patch: patch,
      published_by: user.id,
      changelog: params.changelog ?? null,
      snapshot: params.snapshot as any,
    })
    .select('id')
    .single()
  if (vErr || !versionRow) throw new Error(`Publish version failed: ${vErr?.message ?? 'unknown'}`)

  return { moduleId: moduleId as string, versionId: versionRow.id as string }
}

// ── Semver helpers ─────────────────────────────────────────────
// Simple bump: '1.2.3' + 'patch' → '1.2.4'; 'minor' → '1.3.0';
// 'major' → '2.0.0'. Missing parts default to 0.
export function bumpSemver(current: string, kind: 'major' | 'minor' | 'patch'): string {
  const [maj, min, pat] = current.split('.').map((n) => parseInt(n, 10) || 0)
  if (kind === 'major') return `${maj + 1}.0.0`
  if (kind === 'minor') return `${maj}.${min + 1}.0`
  return `${maj}.${min}.${pat + 1}`
}
