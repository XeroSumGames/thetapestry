import { describe, it, expect, vi } from 'vitest'
import {
  reorderNpcs,
  dirtyNpcSortRows,
  persistNpcSort,
  persistNpcFolder,
} from '../../lib/npc-drag-drop'

describe('reorderNpcs', () => {
  const seed = [
    { id: 'a', sort_order: 1 },
    { id: 'b', sort_order: 2 },
    { id: 'c', sort_order: 3 },
    { id: 'd', sort_order: 4 },
  ]

  it('moves a row forward and renumbers from 1', () => {
    const out = reorderNpcs(seed, 'a', 'c')
    expect(out.map(n => n.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(out.map(n => n.sort_order)).toEqual([1, 2, 3, 4])
  })

  it('moves a row backward', () => {
    const out = reorderNpcs(seed, 'd', 'b')
    expect(out.map(n => n.id)).toEqual(['a', 'd', 'b', 'c'])
    expect(out.map(n => n.sort_order)).toEqual([1, 2, 3, 4])
  })

  it('is a no-op when dragId equals targetId', () => {
    const out = reorderNpcs(seed, 'b', 'b')
    expect(out).toBe(seed)
  })

  it('is a no-op when dragId is null or undefined', () => {
    expect(reorderNpcs(seed, null, 'a')).toBe(seed)
    expect(reorderNpcs(seed, undefined, 'a')).toBe(seed)
  })

  it('is a no-op when target is unknown', () => {
    const out = reorderNpcs(seed, 'a', 'missing')
    expect(out).toBe(seed)
  })
})

describe('dirtyNpcSortRows', () => {
  it('returns only rows whose sort_order changed', () => {
    const prev = [
      { id: 'a', sort_order: 1 }, { id: 'b', sort_order: 2 },
      { id: 'c', sort_order: 3 }, { id: 'd', sort_order: 4 },
    ]
    const next = [
      { id: 'a', sort_order: 1 }, { id: 'c', sort_order: 2 },
      { id: 'b', sort_order: 3 }, { id: 'd', sort_order: 4 },
    ]
    const dirty = dirtyNpcSortRows(prev, next)
    expect(dirty.map(n => n.id).sort()).toEqual(['b', 'c'])
  })

  it('returns an empty array when nothing changed', () => {
    const same = [{ id: 'a', sort_order: 1 }, { id: 'b', sort_order: 2 }]
    expect(dirtyNpcSortRows(same, same)).toEqual([])
  })

  it('treats null sort_order distinctly from set values', () => {
    const prev: Array<{ id: string; sort_order: number | null }> = [{ id: 'a', sort_order: null }]
    const next: Array<{ id: string; sort_order: number | null }> = [{ id: 'a', sort_order: 1 }]
    expect(dirtyNpcSortRows(prev, next)).toEqual([{ id: 'a', sort_order: 1 }])
  })
})

function makeMockSupabase() {
  const updateCalls: any[] = []
  const supabase: any = {
    from(table: string) {
      return {
        update(payload: any) {
          return {
            eq(col: string, val: any) {
              updateCalls.push({ table, payload, col, val })
              return Promise.resolve({ error: null })
            },
          }
        },
      }
    },
  }
  return { supabase, updateCalls }
}

describe('persistNpcSort', () => {
  it('fires one update per dirty row, all against campaign_npcs', async () => {
    const { supabase, updateCalls } = makeMockSupabase()
    await persistNpcSort(supabase, [
      { id: 'a', sort_order: 2 }, { id: 'b', sort_order: 3 },
    ])
    expect(updateCalls.length).toBe(2)
    expect(updateCalls.every(c => c.table === 'campaign_npcs')).toBe(true)
    expect(updateCalls[0].payload).toEqual({ sort_order: 2 })
    expect(updateCalls[0].col).toBe('id')
    expect(updateCalls[0].val).toBe('a')
  })

  it('does nothing for empty dirty list', async () => {
    const { supabase, updateCalls } = makeMockSupabase()
    await persistNpcSort(supabase, [])
    expect(updateCalls).toEqual([])
  })
})

describe('persistNpcFolder', () => {
  it('writes a normal folder name verbatim', async () => {
    const { supabase, updateCalls } = makeMockSupabase()
    await persistNpcFolder(supabase, 'npc-1', 'Antagonists')
    expect(updateCalls).toEqual([{
      table: 'campaign_npcs',
      payload: { folder: 'Antagonists' },
      col: 'id', val: 'npc-1',
    }])
  })

  it('maps "Uncategorized" to null per existing convention', async () => {
    const { supabase, updateCalls } = makeMockSupabase()
    await persistNpcFolder(supabase, 'npc-2', 'Uncategorized')
    expect(updateCalls[0].payload).toEqual({ folder: null })
  })
})
