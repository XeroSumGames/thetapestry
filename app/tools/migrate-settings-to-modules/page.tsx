'use client'
// Thriver-only one-shot tool to publish the deprecated /stories/new
// settings (Chased, Mongrels, Empty, The Rock, The Arena) as Modules.
// Each click creates one module + one version, marks listed +
// approved so it shows in the marketplace immediately, and is
// idempotent (skips if a module with the same name already exists
// in the public-listed set).
//
// Source data: SETTING_NPCS / SETTING_PINS / SETTING_SCENES dicts in
// lib/. Synthetic UUIDs are used for snapshot row ids — cloneSnapshot
// rewrites them on subscribe-clone so the values don't matter, only
// uniqueness within the snapshot.
//
// SCOPE: ships NPCs + pins + scenes only. Vehicles (Mongrels' Minnie)
// and handouts aren't in the cloneSnapshotIntoCampaign path yet —
// extending that is Phase 2 of this migration. Each module's
// description flags the gap.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { SETTING_NPCS } from '../../../lib/setting-npcs'
import { SETTING_PINS } from '../../../lib/setting-pins'
import { SETTING_SCENES } from '../../../lib/setting-scenes'
import { SETTING_HANDOUTS } from '../../../lib/setting-handouts'
import type { ModuleSnapshot } from '../../../lib/modules'

interface SettingDef {
  key: string
  name: string
  parentSetting: string | null
  tagline: string
  description: string
  contentTags: string[]
  sessionEstimate: number
  playerCountRecommended: number
}

// Module ordering matches Xero's published-marketplace ordering:
// Empty (intro) → Chased → Mongrels → The Arena → The Basement.
// Tagline = the public-facing one-liner the user authored. Description
// extends the tagline with a content-shipped line so subscribers know
// what they actually get on day one.
const SETTINGS_TO_MIGRATE: SettingDef[] = [
  {
    key: 'empty',
    name: 'Empty',
    parentSetting: null,
    tagline: 'The perfect introduction to Distemper, a group of survivors searching a gas station realize they might not be alone.',
    description: 'The perfect introduction to Distemper, a group of survivors searching a gas station realize they might not be alone.\n\nIncludes the Stansfield\'s Gas Station tactical scene and a small NPC set. Outcome depends on stealth, timing, and whether anyone hits the door bell.',
    contentTags: ['one-shot', 'intro', 'stealth'],
    sessionEstimate: 1,
    playerCountRecommended: 3,
  },
  {
    key: 'chased',
    name: 'Chased',
    parentSetting: null,
    tagline: 'A group of survivors making their way through Redden State forest come face to face with horror in the post-apocalypse.',
    description: 'A group of survivors making their way through Redden State forest come face to face with horror in the post-apocalypse.\n\nIncludes the Connor Boys Farmhouse tactical scene, the full Chased NPC roster (Robertsons, Ortizes, Connors, Pastor Nick, Eric, Macy, Mikey, Maddy, Troy & Mark), and the rural Sussex County pin set. In-world broadcasts and handouts ship in a v1.1.0 patch.',
    contentTags: ['one-shot', 'horror', 'rescue', 'rural'],
    sessionEstimate: 3,
    playerCountRecommended: 4,
  },
  {
    key: 'mongrels',
    name: 'Minnie & The Magnificent Mongrels',
    parentSetting: null,
    tagline: 'A road trip in a RV called Minnie across the broken back of America from Arizona to Montana as a group of misfits look for a new home.',
    description: 'A road trip in a RV called Minnie across the broken back of America from Arizona to Montana as a group of misfits look for a new home.\n\nIncludes the Day One barn scene, the Minnie interior tactical map, and the full Mongrels NPC roster. Minnie as a drivable vehicle and the Mongrels handouts ship in a v1.1.0 patch.',
    contentTags: ['one-shot', 'road', 'combat-heavy'],
    sessionEstimate: 2,
    playerCountRecommended: 4,
  },
  {
    key: 'arena',
    name: 'The Arena',
    parentSetting: null,
    tagline: "The Duke of Denver's private playground, the Ball Arena is now a deadly gladiatorial where many people enter but only one ever leaves.",
    description: "The Duke of Denver's private playground, the Ball Arena is now a deadly gladiatorial where many people enter but only one ever leaves.\n\nMinimal v1.0.0 content — meant as a publishing seed for GMs to build their own arena variant on top. Expand the NPC roster, scenes, and pins to fit your bracket.",
    contentTags: ['sandbox', 'combat-heavy', 'standalone'],
    sessionEstimate: 6,
    playerCountRecommended: 4,
  },
  {
    key: 'basement',
    name: 'The Basement',
    parentSetting: null,
    tagline: 'A fight club where players can practice combat and test out various weapons as they face off against NPCs in a bloodstained basement.',
    description: 'A fight club where players can practice combat and test out various weapons as they face off against NPCs in a bloodstained basement.\n\nA training-room module — designed for new tables to learn the combat system, or established tables to test loadouts before a session. Minimal v1.0.0 content; bring your own NPCs and weapons.',
    contentTags: ['training', 'combat-heavy', 'standalone'],
    sessionEstimate: 1,
    playerCountRecommended: 4,
  },
]

interface MigrationResult {
  setting: string
  ok: boolean
  moduleId?: string
  versionId?: string
  error?: string
  skipped?: string
  counts?: { npcs: number; pins: number; scenes: number }
}

export default function MigrateSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [isThriver, setIsThriver] = useState<boolean | null>(null)
  const [results, setResults] = useState<Record<string, MigrationResult | null>>({})
  const [running, setRunning] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) { setIsThriver(false); return }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setIsThriver(((data?.role ?? '') as string).toLowerCase() === 'thriver')
    })()
  }, [supabase])

  function newId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }

  function buildSnapshot(setting: string): ModuleSnapshot {
    // Build a `ModuleSnapshot` (per lib/modules.ts) — the shape
    // `cloneModuleIntoCampaign` reads when a subscriber clones a
    // module version into a fresh campaign. The crucial column-name
    // contract: pins use `name` (matches campaign_pins.name) and
    // scenes are flat with tokens nested inside, NOT the
    // campaign-snapshot wrapper shape.
    //
    // _external_id is just a unique key within this snapshot so the
    // clone can remap NPC→pin links if any get authored later. For
    // setting modules with no in-snapshot links between rows, the
    // value is opaque.
    const npcSeeds = SETTING_NPCS[setting] ?? []
    const pinSeeds = SETTING_PINS[setting] ?? []
    const sceneSeeds = SETTING_SCENES[setting] ?? []
    const handoutSeeds = SETTING_HANDOUTS[setting] ?? []

    const npcs = npcSeeds.map((n: any, idx) => ({
      _external_id: newId(),
      name: n.name,
      reason: n.reason ?? 0,
      acumen: n.acumen ?? 0,
      physicality: n.physicality ?? 0,
      influence: n.influence ?? 0,
      dexterity: n.dexterity ?? 0,
      wp_max: n.wp_max ?? 10,
      rp_max: n.rp_max ?? 6,
      skills: n.skills ?? null,
      equipment: n.equipment ?? null,
      notes: n.notes ?? null,
      motivation: n.motivation ?? null,
      portrait_url: n.portrait_url ?? null,
      npc_type: n.npc_type ?? 'goon',
      sort_order: idx + 1,
    }))

    const pins = pinSeeds.map((p: any, idx) => ({
      _external_id: newId(),
      // SettingPin.title (in-code seed shape) → ModuleSnapshotPin.name
      // (DB column name). This rename is the whole point of the fix —
      // the prior version stored `title` here and crashed clone
      // INSERTs against campaign_pins.name NOT NULL.
      name: p.title,
      lat: p.lat,
      lng: p.lng,
      notes: p.notes ?? '',
      category: p.category ?? 'location',
      sort_order: idx + 1,
    }))

    const scenes = sceneSeeds.map((s: any) => ({
      _external_id: newId(),
      name: s.name,
      grid_cols: s.grid_cols,
      grid_rows: s.grid_rows,
      // Setting scene seeds carry `image_url` for the background; the
      // module snapshot's `background_url` column is the equivalent.
      background_url: s.image_url ?? s.background_url ?? null,
      cell_px: s.cell_px ?? 35,
      cell_feet: s.cell_feet ?? 3,
      has_grid: s.has_grid ?? true,
      img_scale: s.img_scale ?? 1,
      // No tokens — seed scenes ship empty maps. The clone path skips
      // empty token arrays cleanly.
      tokens: [],
    }))

    const handouts = handoutSeeds.map((h: any) => ({
      _external_id: newId(),
      title: h.title,
      content: h.content ?? '',
      attachments: [],
    }))

    return { npcs, pins, scenes, handouts }
  }

  async function migrate(def: SettingDef) {
    setRunning(def.key)
    setResults(prev => ({ ...prev, [def.key]: null }))
    try {
      // Idempotency: if a module with this name already exists, UPDATE
      // metadata + REFRESH the existing version's snapshot to the
      // current seed data + current ModuleSnapshot shape. Re-running
      // the tool is the correct path to ship snapshot-shape fixes
      // (previously it skipped the snapshot, which left broken
      // snapshots stranded — the very bug that motivated the
      // 2026-04-29 lenient-reader pass on cloneModuleIntoCampaign).
      const { data: existing } = await supabase
        .from('modules')
        .select('id, name, latest_version_id')
        .eq('name', def.name)
        .limit(1)
      if (existing && existing.length > 0) {
        const existingMod = existing[0] as { id: string; name: string; latest_version_id: string | null }
        const { error: updErr } = await supabase
          .from('modules')
          .update({
            tagline: def.tagline,
            description: def.description,
            content_tags: def.contentTags,
            session_count_estimate: def.sessionEstimate,
            player_count_recommended: def.playerCountRecommended,
          })
          .eq('id', existingMod.id)
        if (updErr) {
          setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: `update metadata: ${updErr.message}` } }))
          return
        }
        // Refresh the snapshot too. Targets the latest_version_id
        // pointer so we never accidentally rewrite an older version
        // a subscriber pinned to. If the pointer's null (impossible
        // for a published module but defensive), we skip the refresh.
        const snapshot = buildSnapshot(def.key)
        let refreshNote = 'metadata only'
        if (existingMod.latest_version_id) {
          const { error: snapErr } = await supabase
            .from('module_versions')
            .update({ snapshot })
            .eq('id', existingMod.latest_version_id)
          if (snapErr) {
            setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: `refresh snapshot: ${snapErr.message}` } }))
            return
          }
          refreshNote = `metadata + snapshot (${snapshot.npcs?.length ?? 0} npcs, ${snapshot.pins?.length ?? 0} pins, ${snapshot.scenes?.length ?? 0} scenes, ${snapshot.handouts?.length ?? 0} handouts)`
        }
        const result: MigrationResult = {
          setting: def.key,
          ok: true,
          moduleId: existingMod.id,
          versionId: existingMod.latest_version_id ?? undefined,
          skipped: `Refreshed existing module "${def.name}" — ${refreshNote}.`,
          counts: { npcs: snapshot.npcs?.length ?? 0, pins: snapshot.pins?.length ?? 0, scenes: snapshot.scenes?.length ?? 0 },
        }
        setResults(prev => ({ ...prev, [def.key]: result }))
        return
      }

      const snapshot = buildSnapshot(def.key)
      const { user } = await getCachedAuth()
      if (!user) {
        setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: 'not authenticated' } }))
        return
      }

      // 1. Insert the module row. Listed + approved so it appears in
      //    /modules immediately. Source campaign null — these modules
      //    are synthetic from setting seeds, no source campaign.
      const { data: modRow, error: modErr } = await supabase
        .from('modules')
        .insert({
          author_user_id: user.id,
          source_campaign_id: null,
          name: def.name,
          tagline: def.tagline,
          description: def.description,
          parent_setting: def.parentSetting,
          content_tags: def.contentTags,
          session_count_estimate: def.sessionEstimate,
          player_count_recommended: def.playerCountRecommended,
          visibility: 'listed',
          moderation_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (modErr || !modRow) {
        setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: modErr?.message ?? 'module insert returned no row' } }))
        return
      }

      // 2. Insert the v1.0.0 module_version with the synthesized snapshot.
      const { data: verRow, error: verErr } = await supabase
        .from('module_versions')
        .insert({
          module_id: modRow.id,
          version: '1.0.0',
          version_major: 1,
          version_minor: 0,
          version_patch: 0,
          published_by: user.id,
          changelog: 'Initial publish — migrated from the deprecated /stories/new setting seed.',
          snapshot,
        })
        .select('id')
        .single()
      if (verErr || !verRow) {
        setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: verErr?.message ?? 'version insert returned no row' } }))
        return
      }

      // 3. Point modules.latest_version_id at the version we just inserted.
      const { error: updErr } = await supabase
        .from('modules')
        .update({ latest_version_id: verRow.id })
        .eq('id', modRow.id)
      if (updErr) {
        setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: `latest_version pointer: ${updErr.message}` } }))
        return
      }

      const result: MigrationResult = {
        setting: def.key,
        ok: true,
        moduleId: modRow.id,
        versionId: verRow.id,
        counts: { npcs: snapshot.npcs?.length ?? 0, pins: snapshot.pins?.length ?? 0, scenes: snapshot.scenes?.length ?? 0 },
      }
      setResults(prev => ({ ...prev, [def.key]: result }))
    } catch (err: any) {
      setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: err?.message ?? 'unknown' } }))
    } finally {
      setRunning(null)
    }
  }

  async function migrateAll() {
    for (const def of SETTINGS_TO_MIGRATE) {
      await migrate(def)
    }
  }

  if (isThriver === null) {
    return <div style={{ padding: '24px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>Checking…</div>
  }
  if (!isThriver) {
    return (
      <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto', color: '#d4cfc9' }}>
        <div style={{ fontSize: '20px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>Access Denied</div>
        <div style={{ fontSize: '14px' }}>Thriver-only tool. Contact xerosumgames@gmail.com if you think this is wrong.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: '900px', margin: '0 auto', color: '#d4cfc9' }}>
      <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
        Thriver Tool
      </div>
      <h1 style={{ margin: 0, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
        Migrate Settings to Modules
      </h1>
      <p style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.5 }}>
        Publishes the five deprecated /stories/new settings (Chased, Mongrels, Empty, The Rock, The Arena) as Module-marketplace entries.
        Each migration creates one module + one v1.0.0 version, marks visibility=listed and moderation=approved so it appears immediately
        on /modules. Idempotent — clicking Migrate on an already-published setting reports "skipped".
      </p>
      <p style={{ marginTop: '4px', fontSize: '13px', color: '#cce0f5' }}>
        Scope: NPCs + pins + scenes ship in v1.0.0. Vehicles and handouts (Mongrels&apos; Minnie, Chased&apos;s broadcasts) need a v1.1.0 publish
        once cloneSnapshotIntoCampaign learns to clone them. Each module&apos;s description flags the gap so subscribers know.
      </p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '20px', marginBottom: '16px' }}>
        <button onClick={migrateAll} disabled={!!running}
          style={{ padding: '9px 22px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, cursor: running ? 'wait' : 'pointer', opacity: running ? 0.5 : 1 }}>
          {running ? `Migrating ${running}…` : 'Migrate All'}
        </button>
        <a href="/modules" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#c4a7f0', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          → /modules
        </a>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {SETTINGS_TO_MIGRATE.map(def => {
          const r = results[def.key]
          return (
            <div key={def.key} style={{ padding: '14px 16px', background: '#1a1a1a', border: `1px solid ${r?.ok === false ? '#c0392b' : r?.ok ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{def.name}</div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>{def.tagline}</div>
                </div>
                <button onClick={() => migrate(def)} disabled={!!running}
                  style={{ padding: '6px 14px', background: r?.ok ? '#1a2e10' : '#2a1a3e', border: `1px solid ${r?.ok ? '#2d5a1b' : '#5a2e5a'}`, borderRadius: '3px', color: r?.ok ? '#7fc458' : '#c4a7f0', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: running === def.key ? 'wait' : 'pointer', opacity: running === def.key ? 0.5 : 1, fontWeight: 600 }}>
                  {running === def.key ? 'Migrating…' : r?.ok ? 'Done' : 'Migrate'}
                </button>
              </div>
              {r && (
                <div style={{ marginTop: '8px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', color: r.ok ? '#7fc458' : '#f5a89a' }}>
                  {r.skipped && <>↩ {r.skipped}</>}
                  {r.ok && !r.skipped && r.counts && <>✓ Published — {r.counts.npcs} NPCs, {r.counts.pins} pins, {r.counts.scenes} scenes (module {r.moduleId?.slice(0, 8)}…)</>}
                  {!r.ok && <>✗ {r.error}</>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
