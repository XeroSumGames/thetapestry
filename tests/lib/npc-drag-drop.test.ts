import { describe, it, expect, vi } from 'vitest'
import {
  reorderNpcs,
  dirtyNpcSortRows,
  persistNpcSort,
  persistNpcFolder,
  folderDbValue,
  compareNpcSort,
  planNpcRowDrop,
} from '../../lib/npc-drag-drop'

describe('planNpcRowDrop', () => {
  const folder = [{ id: 'a', sort_order: 1 }, { id: 'b', sort_order: 2 }, { id: 'c', sort_order: 3 }]
  it('dragging an NPC from another folder onto a row = move into this folder', () => {
    expect(planNpcRowDrop(folder, 'x', 'b', 'West Gate')).toEqual({ kind: 'move', folder: 'West Gate' })
  })
  it('moving onto a row in the "Unfiled" folder clears the folder', () => {
    expect(planNpcRowDrop(folder, 'x', 'b', 'Unfiled')).toEqual({ kind: 'move', folder: null })
  })
  it('dragging within the folder = reorder with only the changed rows', () => {
    const plan = planNpcRowDrop(folder, 'c', 'a', 'West Gate')
    expect(plan?.kind).toBe('reorder')
    if (plan?.kind === 'reorder') expect(plan.dirty.map(n => [n.id, n.sort_order])).toEqual([['c', 1], ['a', 2], ['b', 3]])
  })
  it('dropping on itself or with no drag is a no-op', () => {
    expect(planNpcRowDrop(folder, 'a', 'a', 'West Gate')).toBeNull()
    expect(planNpcRowDrop(folder, null, 'a', 'West Gate')).toBeNull()
  })
})

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

describe('persistNpcSort error reporting', () => {
  // Regression guard: this used to return void and swallow every row error, so
  // a rejected write left the UI showing an order the DB never saved and the
  // player only discovered it on refresh. The caller now re-pulls on error, so
  // the error has to actually reach it.
  function mockFailing(failId: string | null, message = 'rls denied') {
    const attempted: string[] = []
    const supabase: any = {
      from() {
        return {
          update() {
            return {
              eq(_col: string, val: any) {
                attempted.push(val)
                return Promise.resolve({ error: failId === val ? { message } : null })
              },
            }
          },
        }
      },
    }
    return { supabase, attempted }
  }

  it('reports no error when every row write lands', async () => {
    const { supabase } = mockFailing(null)
    expect(await persistNpcSort(supabase, [{ id: 'a', sort_order: 1 }])).toEqual({ error: null })
  })

  it('returns the first row error so the caller can re-pull', async () => {
    const { supabase } = mockFailing('b')
    const { error } = await persistNpcSort(supabase, [
      { id: 'a', sort_order: 1 }, { id: 'b', sort_order: 2 },
    ])
    expect(error?.message).toBe('rls denied')
  })

  it('still attempts every row even when one fails, so one bad row cannot strand the rest', async () => {
    const { supabase, attempted } = mockFailing('a')
    await persistNpcSort(supabase, [
      { id: 'a', sort_order: 1 }, { id: 'b', sort_order: 2 }, { id: 'c', sort_order: 3 },
    ])
    expect([...attempted].sort()).toEqual(['a', 'b', 'c'])
  })

  it('reports no error for an empty dirty list', async () => {
    const { supabase } = mockFailing(null)
    expect(await persistNpcSort(supabase, [])).toEqual({ error: null })
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

  it('maps the player tab\'s "Unfiled" label to null, not the literal string', async () => {
    const { supabase, updateCalls } = makeMockSupabase()
    await persistNpcFolder(supabase, 'npc-3', 'Unfiled')
    expect(updateCalls[0].payload).toEqual({ folder: null })
  })
})

describe('folderDbValue', () => {
  it('keeps real folder names', () => {
    expect(folderDbValue('West Gate')).toBe('West Gate')
  })
  it('maps both "no folder" labels to null', () => {
    expect(folderDbValue('Uncategorized')).toBeNull()
    expect(folderDbValue('Unfiled')).toBeNull()
  })
})

describe('compareNpcSort', () => {
  it('orders by sort_order before name, so a drag-reorder survives render', () => {
    const rows = [
      { name: 'Alice', sort_order: 3 },
      { name: 'Zed', sort_order: 1 },
      { name: 'Mo', sort_order: 2 },
    ]
    expect([...rows].sort(compareNpcSort).map(r => r.name)).toEqual(['Zed', 'Mo', 'Alice'])
  })
  it('puts null sort_order last and breaks ties by name', () => {
    const rows = [
      { name: 'Bea', sort_order: null },
      { name: 'Al', sort_order: null },
      { name: 'Cy', sort_order: 5 },
    ]
    expect([...rows].sort(compareNpcSort).map(r => r.name)).toEqual(['Cy', 'Al', 'Bea'])
  })
})
