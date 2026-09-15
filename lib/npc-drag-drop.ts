// NPC roster drag/drop helpers - shared between the GM-side NpcRoster
// component and the player-side inline render in
// app/stories/[id]/table/page.tsx. Pure helpers + thin async writers
// so both surfaces compute reorders identically and persist via the
// same campaign_npcs UPDATE path (RLS opened to any campaign member
// in sql/campaign-npcs-rls-fix.sql).
//
// Extracted 2026-05-19 alongside Q2 scope C (post-playtest mark
// 01:32:51 - "players should be able to drag/drop NPCs in their NPC
// tab"). RLS allowed the writes already; the gap was purely UI side.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface NpcDragRow {
  id: string
  sort_order?: number | null
  folder?: string | null
}

// Compute the new ordering after dragging dragId onto targetId.
// Returns the renumbered array (sort_order 1..N). Caller persists via
// persistNpcSort. Dropping a row onto itself or an unknown target is
// a no-op (returns input array unchanged).
export function reorderNpcs<T extends NpcDragRow>(
  npcs: T[],
  dragId: string | null | undefined,
  targetId: string,
): T[] {
  if (!dragId || dragId === targetId) return npcs
  const fromIdx = npcs.findIndex(n => n.id === dragId)
  const toIdx = npcs.findIndex(n => n.id === targetId)
  if (fromIdx < 0 || toIdx < 0) return npcs
  const next = [...npcs]
  const [moved] = next.splice(fromIdx, 1)
  next.splice(toIdx, 0, moved)
  return next.map((n, i) => ({ ...n, sort_order: i + 1 }))
}

// Diff old vs new orderings, returning only the rows whose sort_order
// changed. Use to avoid persisting rows that didn't move (a drag from
// index 2 → 5 only mutates positions 2..5; positions 0..1 and 6..N
// stay put).
export function dirtyNpcSortRows<T extends NpcDragRow>(prev: T[], next: T[]): T[] {
  const prevOrder = new Map(prev.map(n => [n.id, n.sort_order ?? null]))
  return next.filter(n => prevOrder.get(n.id) !== n.sort_order)
}

// Persist sort_order for the dirty rows. Best-effort: each row is its
// own UPDATE so a partial failure doesn't roll back the whole batch.
// RLS on campaign_npcs lets any campaign member UPDATE
// (sql/campaign-npcs-rls-fix.sql).
export async function persistNpcSort(
  supabase: SupabaseClient,
  dirty: NpcDragRow[],
): Promise<void> {
  if (dirty.length === 0) return
  await Promise.all(dirty.map(n =>
    supabase.from('campaign_npcs').update({ sort_order: n.sort_order }).eq('id', n.id),
  ))
}

// The display label for "no folder" differs by surface: the GM roster
// calls it 'Uncategorized', the player NPC tab calls it 'Unfiled'. Both
// mean folder = null in the DB. Before 2026-09-15 only 'Uncategorized'
// was mapped, so a player dropping an NPC on 'Unfiled' wrote the literal
// string "Unfiled" as a real folder name.
export function folderDbValue(folderName: string): string | null {
  return folderName === 'Uncategorized' || folderName === 'Unfiled' ? null : folderName
}

// Sort comparator for NPCs inside one folder: saved sort_order first
// (nulls last), name as the tiebreak. The player tab used to sort by
// name only, which silently discarded every drag-reorder.
export function compareNpcSort(
  a: { name?: string | null; sort_order?: number | null },
  b: { name?: string | null; sort_order?: number | null },
): number {
  const as = a.sort_order ?? Number.MAX_SAFE_INTEGER
  const bs = b.sort_order ?? Number.MAX_SAFE_INTEGER
  if (as !== bs) return as - bs
  return (a.name ?? '').localeCompare(b.name ?? '')
}

// Decide what dropping dragId onto the row targetId inside a folder means.
// Dragged NPC not in that folder = move it into the folder; already in it =
// reorder (returns only the rows whose sort_order changed); otherwise null.
// Kept here (not inline in the table page) so it's testable and the god-
// component doesn't grow.
export type NpcRowDropPlan<T> =
  | { kind: 'move'; folder: string | null }
  | { kind: 'reorder'; dirty: T[] }
export function planNpcRowDrop<T extends NpcDragRow>(
  bucketNpcs: T[],
  dragId: string | null | undefined,
  targetId: string,
  bucketName: string,
): NpcRowDropPlan<T> | null {
  if (!dragId || dragId === targetId) return null
  if (!bucketNpcs.some(n => n.id === dragId)) return { kind: 'move', folder: folderDbValue(bucketName) }
  const renumbered = reorderNpcs(bucketNpcs, dragId, targetId)
  if (renumbered === bucketNpcs) return null
  return { kind: 'reorder', dirty: dirtyNpcSortRows(bucketNpcs, renumbered) }
}

// Move a single NPC to a different folder. 'Uncategorized' / 'Unfiled'
// map to null in the DB (see folderDbValue). Returns the supabase error
// if any (caller decides whether to surface it).
export async function persistNpcFolder(
  supabase: SupabaseClient,
  npcId: string,
  folderName: string,
): Promise<{ error: any | null }> {
  const folder = folderDbValue(folderName)
  const { error } = await supabase
    .from('campaign_npcs')
    .update({ folder })
    .eq('id', npcId)
  return { error }
}
