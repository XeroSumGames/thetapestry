'use client'
// Phase 5 Sprint 3b — Review modal.
//
// When a subscriber's campaign is behind on module updates, this
// modal lets them selectively apply the diff between their cloned
// version and the target version. Each change is a checkbox with
// a smart default:
//   - ADDED   → checked by default (opt-out)
//   - CHANGED, not locally edited → checked (overwrite safe)
//   - CHANGED, locally edited      → UNCHECKED (don't stomp custom work)
//   - REMOVED → unchecked (keep unless user says delete)
//
// Cloned rows with `edited_since_clone = true` are surfaced with
// a ⚠ "You've customized this" marker so the default skip makes
// sense visually.

import { useEffect, useMemo, useState } from 'react'
import {
  applyModuleUpdate,
  type ModuleSnapshot,
  type SelectedChanges,
} from '../lib/modules'
import { diffSnapshots, summarizeDiff, type SectionDiff } from '../lib/module-diff'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ModuleReviewModalProps {
  supabase: SupabaseClient
  subscriptionId: string
  campaignId: string
  moduleName: string
  currentVersionId: string
  currentVersionLabel: string   // e.g. "1.0.0"
  newVersionId: string
  newVersionLabel: string       // e.g. "1.1.0"
  currentSnapshot: ModuleSnapshot
  newSnapshot: ModuleSnapshot
  onClose: () => void
  onApplied: (result: { errors: string[] }) => void
}

// Which cloned rows in this campaign have the edited_since_clone
// flag set for the current module subscription? Drives the
// "you've customized this" marker on changed items.
interface EditedFlags {
  npcs:     Map<string, boolean>  // key = local id; true = edited
  pins:     Map<string, boolean>
  scenes:   Map<string, boolean>
  handouts: Map<string, boolean>
}

export default function ModuleReviewModal({
  supabase,
  subscriptionId,
  campaignId,
  moduleName,
  currentVersionId,
  currentVersionLabel,
  newVersionId,
  newVersionLabel,
  currentSnapshot,
  newSnapshot,
  onClose,
  onApplied,
}: ModuleReviewModalProps) {
  const diff = useMemo(() => diffSnapshots(currentSnapshot, newSnapshot), [currentSnapshot, newSnapshot])
  const summary = useMemo(() => summarizeDiff(diff), [diff])

  // Load edit-tracking flags from the subscriber's cloned rows so
  // the checkbox defaults can respect local customization. Keyed
  // by a loose `name.toLowerCase()` fallback (same way the diff
  // comparator matches rows without stable ids).
  const [editedFlags, setEditedFlags] = useState<EditedFlags>({
    npcs: new Map(), pins: new Map(), scenes: new Map(), handouts: new Map(),
  })
  const [flagsLoaded, setFlagsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [npcsRes, pinsRes, scenesRes, notesRes] = await Promise.all([
        supabase.from('campaign_npcs')
          .select('name, edited_since_clone')
          .eq('campaign_id', campaignId)
          .eq('source_module_version_id', currentVersionId),
        supabase.from('campaign_pins')
          .select('name, edited_since_clone')
          .eq('campaign_id', campaignId)
          .eq('source_module_version_id', currentVersionId),
        supabase.from('tactical_scenes')
          .select('name, edited_since_clone')
          .eq('campaign_id', campaignId)
          .eq('source_module_version_id', currentVersionId),
        supabase.from('campaign_notes')
          .select('title, edited_since_clone')
          .eq('campaign_id', campaignId)
          .eq('source_module_version_id', currentVersionId),
      ])
      if (cancelled) return
      const toMap = (rows: any[] | null, key: string) => {
        const m = new Map<string, boolean>()
        for (const r of rows ?? []) m.set((r[key] ?? '').toLowerCase(), !!r.edited_since_clone)
        return m
      }
      setEditedFlags({
        npcs:     toMap(npcsRes.data,   'name'),
        pins:     toMap(pinsRes.data,   'name'),
        scenes:   toMap(scenesRes.data, 'name'),
        handouts: toMap(notesRes.data,  'title'),
      })
      setFlagsLoaded(true)
    })()
    return () => { cancelled = true }
  }, [supabase, campaignId, currentVersionId])

  // Checkbox state: Map<external-id, boolean> per section per bucket.
  const [checks, setChecks] = useState<SelectedChanges>({
    npcs:     { added: [], changed: [], removed: [] },
    pins:     { added: [], changed: [], removed: [] },
    scenes:   { added: [], changed: [], removed: [] },
    handouts: { added: [], changed: [], removed: [] },
  })

  // Seed defaults once diff + edited flags are loaded.
  useEffect(() => {
    if (!flagsLoaded) return
    const seed: SelectedChanges = {
      npcs:     { added: [], changed: [], removed: [] },
      pins:     { added: [], changed: [], removed: [] },
      scenes:   { added: [], changed: [], removed: [] },
      handouts: { added: [], changed: [], removed: [] },
    }
    // ADDED — check all.
    for (const n of diff.npcs.added)     if (n._external_id) seed.npcs.added.push(n._external_id)
    for (const p of diff.pins.added)     if (p._external_id) seed.pins.added.push(p._external_id)
    for (const s of diff.scenes.added)   if (s._external_id) seed.scenes.added.push(s._external_id)
    for (const h of diff.handouts.added) if (h._external_id) seed.handouts.added.push(h._external_id)
    // CHANGED — check unless locally edited.
    const seedChanged = <T extends { _external_id?: string; name?: string; title?: string }>(
      section: SectionDiff<T>,
      flags: Map<string, boolean>,
      target: string[],
      keyField: 'name' | 'title',
    ) => {
      for (const { after } of section.changed) {
        if (!after._external_id) continue
        const label = ((after as any)[keyField] ?? '').toLowerCase()
        const locallyEdited = flags.get(label) ?? false
        if (!locallyEdited) target.push(after._external_id)
      }
    }
    seedChanged(diff.npcs,     editedFlags.npcs,     seed.npcs.changed,     'name')
    seedChanged(diff.pins,     editedFlags.pins,     seed.pins.changed,     'name')
    seedChanged(diff.scenes,   editedFlags.scenes,   seed.scenes.changed,   'name')
    seedChanged(diff.handouts, editedFlags.handouts, seed.handouts.changed, 'title')
    // REMOVED — leave unchecked by default.
    setChecks(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagsLoaded, diff])

  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string>('')

  function toggleCheck(
    section: keyof SelectedChanges,
    bucket: 'added' | 'changed' | 'removed',
    externalId: string,
  ) {
    setChecks(prev => {
      const current = prev[section][bucket]
      const next = current.includes(externalId)
        ? current.filter(x => x !== externalId)
        : [...current, externalId]
      return { ...prev, [section]: { ...prev[section], [bucket]: next } }
    })
  }

  async function handleApply() {
    setApplying(true)
    setError('')
    try {
      const result = await applyModuleUpdate(supabase, {
        subscriptionId,
        campaignId,
        newVersionId,
        newSnapshot,
        accepted: checks,
      })
      if (result.errors.length > 0) {
        setError(`Apply partial — ${result.errors.length} error(s):\n${result.errors.join('\n')}`)
        setApplying(false)
        return
      }
      onApplied({ errors: [] })
    } catch (e: any) {
      setError(e?.message ?? 'Apply failed')
      setApplying(false)
    }
  }

  // ── Styles (match ModulePublishModal) ──────────────────────────
  const backdrop: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, padding: '20px',
  }
  const panel: React.CSSProperties = {
    background: '#1a1a1a', border: '1px solid #5a2e5a', borderLeft: '3px solid #8b5cf6',
    borderRadius: '4px', width: '720px', maxWidth: '100%',
    maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }
  const header: React.CSSProperties = {
    padding: '14px 18px', borderBottom: '1px solid #2e2e2e',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }
  const body: React.CSSProperties = {
    padding: '18px', flex: 1, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: '14px',
  }
  const footer: React.CSSProperties = {
    padding: '14px 18px', borderTop: '1px solid #2e2e2e',
    display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center',
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: '13px', fontWeight: 700, letterSpacing: '.08em',
    textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif',
    color: '#c4a7f0', marginBottom: '6px',
  }
  const changeRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 8px', borderRadius: '3px', background: '#111',
    border: '1px solid #2e2e2e',
  }

  // Render helper — one checkbox row per change item.
  function renderItems<T extends { _external_id?: string; name?: string; title?: string }>(
    items: T[],
    bucket: 'added' | 'changed' | 'removed',
    section: keyof SelectedChanges,
    sectionName: string,
    keyField: 'name' | 'title',
  ): React.ReactNode[] {
    return items
      .filter(i => !!i._external_id)
      .map(i => {
        const xid = i._external_id!
        const checked = checks[section][bucket].includes(xid)
        const label = ((i as any)[keyField] ?? '(unnamed)')
        const flags = editedFlags[section]
        const locallyEdited = bucket === 'changed'
          ? (flags.get(label.toLowerCase()) ?? false)
          : false
        return (
          <label key={`${bucket}-${xid}`} style={{ ...changeRow, cursor: 'pointer' }}>
            <input type="checkbox" checked={checked}
              onChange={() => toggleCheck(section, bucket, xid)} />
            <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', width: '72px', flexShrink: 0 }}>
              {sectionName}
            </span>
            <span style={{ fontSize: '14px', color: '#f5f2ee', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </span>
            {locallyEdited && (
              <span title="You've locally edited this row — skip by default to keep your changes"
                style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                ⚠ Customized
              </span>
            )}
          </label>
        )
      })
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        <div style={header}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c4a7f0' }}>
            📦 Review Update — {moduleName}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#c4a7f0', fontSize: '22px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={body}>

          <div style={{ fontSize: '14px', color: '#cce0f5', lineHeight: 1.5 }}>
            Your campaign is on <strong style={{ color: '#f5f2ee' }}>v{currentVersionLabel}</strong>.
            The author just published <strong style={{ color: '#c4a7f0' }}>v{newVersionLabel}</strong>.
            Pick which changes to pull in. The default skips anything you've locally customized.
          </div>
          <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Diff summary: <span style={{ color: '#c4a7f0' }}>{summary}</span>
          </div>

          {!flagsLoaded && (
            <div style={{ fontSize: '13px', color: '#cce0f5' }}>Loading your local edit history…</div>
          )}

          {flagsLoaded && diff.totals.added > 0 && (
            <div>
              <div style={sectionLabel}>✨ New content ({diff.totals.added})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {renderItems(diff.npcs.added,     'added', 'npcs',     'NPC',     'name')}
                {renderItems(diff.pins.added,     'added', 'pins',     'Pin',     'name')}
                {renderItems(diff.scenes.added,   'added', 'scenes',   'Scene',   'name')}
                {renderItems(diff.handouts.added, 'added', 'handouts', 'Handout', 'title')}
              </div>
            </div>
          )}

          {flagsLoaded && diff.totals.changed > 0 && (
            <div>
              <div style={sectionLabel}>✎ Updated content ({diff.totals.changed})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {renderItems(diff.npcs.changed.map(c => c.after),     'changed', 'npcs',     'NPC',     'name')}
                {renderItems(diff.pins.changed.map(c => c.after),     'changed', 'pins',     'Pin',     'name')}
                {renderItems(diff.scenes.changed.map(c => c.after),   'changed', 'scenes',   'Scene',   'name')}
                {renderItems(diff.handouts.changed.map(c => c.after), 'changed', 'handouts', 'Handout', 'title')}
              </div>
            </div>
          )}

          {flagsLoaded && diff.totals.removed > 0 && (
            <div>
              <div style={sectionLabel}>✘ Removed upstream ({diff.totals.removed})</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '6px', fontFamily: 'Barlow, sans-serif' }}>
                Check any you also want to delete from your campaign. Default: keep them — the author removed them from the module but you may have become attached.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {renderItems(diff.npcs.removed,     'removed', 'npcs',     'NPC',     'name')}
                {renderItems(diff.pins.removed,     'removed', 'pins',     'Pin',     'name')}
                {renderItems(diff.scenes.removed,   'removed', 'scenes',   'Scene',   'name')}
                {renderItems(diff.handouts.removed, 'removed', 'handouts', 'Handout', 'title')}
              </div>
            </div>
          )}

          {flagsLoaded && diff.totals.added + diff.totals.changed + diff.totals.removed === 0 && (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#cce0f5', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
              No content-level changes between v{currentVersionLabel} and v{newVersionLabel}. Clicking Apply just rehomes your subscription to the newer version.
            </div>
          )}

          {error && (
            <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', whiteSpace: 'pre-wrap' }}>
              {error}
            </div>
          )}
        </div>

        <div style={footer}>
          <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            → Applying to v{newVersionLabel}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} disabled={applying}
              style={{ padding: '8px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: applying ? 'not-allowed' : 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleApply} disabled={applying || !flagsLoaded}
              style={{ padding: '8px 18px', background: '#2a1a3e', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#c4a7f0', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: applying || !flagsLoaded ? 'not-allowed' : 'pointer', opacity: applying || !flagsLoaded ? 0.4 : 1, fontWeight: 600 }}>
              {applying ? 'Applying…' : `Apply Selected → v${newVersionLabel}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
