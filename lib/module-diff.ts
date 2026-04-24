// Phase 5 Sprint 3 — snapshot-vs-snapshot diff helper.
//
// Takes two ModuleSnapshots (typically consecutive versions) and
// returns a per-content-type breakdown of which items were added,
// removed, or changed. Powers the version-history diff summary and
// the subscriber update-review modal.
//
// Identity: items are matched by `_external_id` (the original
// campaign row uuid at publish time). If either side lacks an
// external id, falls back to matching by `name` (pins/npcs/scenes)
// or `title` (handouts). This keeps early-days pre-Sprint-2
// snapshots diff-able even without the stable id.
//
// Change detection: two items share an external id but have
// different JSON representations (after normalizing key order).
// The diff carries the before/after object refs so the review UI
// can render them side-by-side.

import type {
  ModuleSnapshot,
  ModuleSnapshotNpc,
  ModuleSnapshotPin,
  ModuleSnapshotScene,
  ModuleSnapshotHandout,
} from './modules'

export interface SectionDiff<T> {
  added: T[]
  removed: T[]
  changed: Array<{ before: T; after: T }>
}

export interface SnapshotDiff {
  npcs: SectionDiff<ModuleSnapshotNpc>
  pins: SectionDiff<ModuleSnapshotPin>
  scenes: SectionDiff<ModuleSnapshotScene>
  handouts: SectionDiff<ModuleSnapshotHandout>
  totals: {
    added: number
    removed: number
    changed: number
  }
}

// Stable stringify so two objects with the same keys in different
// orders compare equal. Recursive — preserves arrays, sorts object
// keys. Used only to detect change; not shown to the user.
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  const keys = Object.keys(v as Record<string, unknown>).sort()
  return '{' + keys.map(k =>
    JSON.stringify(k) + ':' + stableStringify((v as any)[k])
  ).join(',') + '}'
}

// Strip bookkeeping fields that shouldn't count as "changed" —
// _external_id, sort_order, and fields that clone resets anyway.
function stripBookkeeping<T extends Record<string, any>>(item: T): T {
  const { _external_id, _pin_external_id, _npc_external_id, sort_order, ...rest } = item
  return rest as T
}

function diffSection<T extends Record<string, any>>(
  before: T[] | undefined,
  after: T[] | undefined,
  keyFn: (item: T) => string,
): SectionDiff<T> {
  const beforeMap = new Map<string, T>()
  const afterMap = new Map<string, T>()
  for (const item of before ?? []) beforeMap.set(keyFn(item), item)
  for (const item of after ?? []) afterMap.set(keyFn(item), item)

  const added: T[] = []
  const removed: T[] = []
  const changed: Array<{ before: T; after: T }> = []

  for (const [key, aItem] of afterMap) {
    const bItem = beforeMap.get(key)
    if (!bItem) {
      added.push(aItem)
    } else if (stableStringify(stripBookkeeping(bItem)) !== stableStringify(stripBookkeeping(aItem))) {
      changed.push({ before: bItem, after: aItem })
    }
  }
  for (const [key, bItem] of beforeMap) {
    if (!afterMap.has(key)) {
      removed.push(bItem)
    }
  }

  return { added, removed, changed }
}

// Identity helpers — prefer _external_id; fall back to name/title.
function npcKey(n: ModuleSnapshotNpc): string {
  return n._external_id ?? `name:${(n.name ?? '').toLowerCase()}`
}
function pinKey(p: ModuleSnapshotPin): string {
  return p._external_id ?? `name:${(p.name ?? '').toLowerCase()}`
}
function sceneKey(s: ModuleSnapshotScene): string {
  return s._external_id ?? `name:${(s.name ?? '').toLowerCase()}`
}
function handoutKey(h: ModuleSnapshotHandout): string {
  return h._external_id ?? `title:${(h.title ?? '').toLowerCase()}`
}

export function diffSnapshots(
  before: ModuleSnapshot | null | undefined,
  after: ModuleSnapshot | null | undefined,
): SnapshotDiff {
  const b = before ?? {}
  const a = after ?? {}
  const npcs = diffSection(b.npcs, a.npcs, npcKey)
  const pins = diffSection(b.pins, a.pins, pinKey)
  const scenes = diffSection(b.scenes, a.scenes, sceneKey)
  const handouts = diffSection(b.handouts, a.handouts, handoutKey)
  const totals = {
    added: npcs.added.length + pins.added.length + scenes.added.length + handouts.added.length,
    removed: npcs.removed.length + pins.removed.length + scenes.removed.length + handouts.removed.length,
    changed: npcs.changed.length + pins.changed.length + scenes.changed.length + handouts.changed.length,
  }
  return { npcs, pins, scenes, handouts, totals }
}

// One-line summary like "+2 NPCs, -1 pin, 3 handouts updated".
// Omits a bucket when its counts are 0 so the line stays compact.
// Empty diff returns "(no changes)".
export function summarizeDiff(d: SnapshotDiff): string {
  const parts: string[] = []
  const bucket = (name: string, section: SectionDiff<any>) => {
    if (section.added.length > 0) parts.push(`+${section.added.length} ${name}`)
    if (section.removed.length > 0) parts.push(`−${section.removed.length} ${name}`)
    if (section.changed.length > 0) parts.push(`${section.changed.length} ${name} updated`)
  }
  bucket('NPCs', d.npcs)
  bucket('pins', d.pins)
  bucket('scenes', d.scenes)
  bucket('handouts', d.handouts)
  return parts.length === 0 ? '(no changes)' : parts.join(', ')
}
