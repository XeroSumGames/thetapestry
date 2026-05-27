import { describe, it, expect, vi } from 'vitest'
import { decrementInitiativeAction, buildNpcInitiativeRow } from '../../lib/initiative-actions'

describe('buildNpcInitiativeRow', () => {
  it('links a roster NPC: npc_id + 2d6 + ACU + DEX + portrait/type', () => {
    const npc = { id: 'npc-1', name: 'Ash Salazar', acumen: 2, dexterity: 1, portrait_url: 'http://x/p.png', npc_type: 'raider' }
    const row = buildNpcInitiativeRow({ campaignId: 'camp-1', name: 'ash', npc, d1: 4, d2: 3 })
    expect(row).toMatchObject({
      campaign_id: 'camp-1',
      character_name: 'Ash Salazar', // roster name wins over the typed text
      npc_id: 'npc-1',
      portrait_url: 'http://x/p.png',
      npc_type: 'raider',
      roll: 4 + 3 + 2 + 1, // 10
      is_npc: true,
      is_active: false,
      actions_remaining: 2,
      character_id: null,
      user_id: null,
    })
  })

  it('ad-hoc NPC (npc null): npc_id null, plain 2d6, typed name kept', () => {
    const row = buildNpcInitiativeRow({ campaignId: 'camp-1', name: '  Mystery Goon  ', npc: null, d1: 5, d2: 2 })
    expect(row).toMatchObject({
      character_name: '  Mystery Goon  ', // caller already trims; builder keeps what it's given
      npc_id: null,
      portrait_url: null,
      npc_type: null,
      roll: 7, // 5 + 2, no modifier
      is_npc: true,
    })
  })

  it('treats missing ACU/DEX as 0', () => {
    const row = buildNpcInitiativeRow({ campaignId: 'c', name: 'x', npc: { id: 'n', name: 'No Stats' }, d1: 6, d2: 6 })
    expect(row.roll).toBe(12)
    expect(row.npc_id).toBe('n')
  })
})

// Minimal mock supabase covering the three query shapes
// decrementInitiativeAction uses:
//   1. from('initiative_order').select('*').eq(...)[.eq(...)].single()/.maybeSingle()  (entry lookup)
//   2. from('roll_log').insert({...})                                                  (best-effort action log)
//   3. from('initiative_order').update({...}).eq('id', x).select('id, actions_remaining')  (the decrement)
function makeMockSupabase(opts: {
  lookup?: { data?: any; error?: { message: string } | null }
  update?: { data?: any[]; error?: { message: string } | null }
  insertThrows?: boolean
} = {}) {
  const calls: any[] = []
  const supabase: any = {
    from(table: string) {
      return {
        select(_cols: string) {
          const chain: any = {
            eq(_c: string, _v: any) { return chain },
            single() { calls.push({ op: 'lookup', table, mode: 'single' }); return Promise.resolve({ data: opts.lookup?.data ?? null, error: opts.lookup?.error ?? null }) },
            maybeSingle() { calls.push({ op: 'lookup', table, mode: 'maybeSingle' }); return Promise.resolve({ data: opts.lookup?.data ?? null, error: opts.lookup?.error ?? null }) },
          }
          return chain
        },
        update(payload: any) {
          calls.push({ op: 'update', table, payload })
          return {
            eq(_c: string, _v: any) {
              return {
                select(_cols: string) {
                  return Promise.resolve({ data: opts.update?.data ?? [{ id: 'e1', actions_remaining: 0 }], error: opts.update?.error ?? null })
                },
              }
            },
          }
        },
        insert(payload: any) {
          calls.push({ op: 'insert', table, payload })
          if (opts.insertThrows) throw new Error('roll_log insert blew up')
          return Promise.resolve({ error: null })
        },
      }
    },
  }
  return { supabase, calls }
}

const ENTRY = { id: 'e1', character_name: 'Cree Hask', actions_remaining: 2, is_active: true }

describe('decrementInitiativeAction', () => {
  it('decrements by 1 (default cost) and reports not-zero', async () => {
    const { supabase } = makeMockSupabase({ lookup: { data: { ...ENTRY, actions_remaining: 2 } }, update: { data: [{ id: 'e1', actions_remaining: 1 }] } })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1', entryId: 'e1' })
    expect(r.ok).toBe(true)
    expect(r.newRemaining).toBe(1)
    expect(r.reachedZero).toBe(false)
  })

  it('reports reachedZero when the last action is spent', async () => {
    const { supabase } = makeMockSupabase({ lookup: { data: { ...ENTRY, actions_remaining: 1 } }, update: { data: [{ id: 'e1', actions_remaining: 0 }] } })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1', entryId: 'e1' })
    expect(r.ok).toBe(true)
    expect(r.newRemaining).toBe(0)
    expect(r.reachedZero).toBe(true)
  })

  it('honors an explicit cost > 1', async () => {
    const { supabase } = makeMockSupabase({ lookup: { data: { ...ENTRY, actions_remaining: 2 } }, update: { data: [{ id: 'e1', actions_remaining: 0 }] } })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1', entryId: 'e1', cost: 2 })
    expect(r.ok).toBe(true)
    expect(r.newRemaining).toBe(0)
    expect(r.reachedZero).toBe(true)
  })

  it('refuses when actions remaining < cost (no write)', async () => {
    const { supabase, calls } = makeMockSupabase({ lookup: { data: { ...ENTRY, actions_remaining: 0 } } })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1', entryId: 'e1' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/insufficient actions/)
    expect(r.newRemaining).toBe(0)
    expect(calls.some(c => c.op === 'update')).toBe(false)
  })

  it('looks up the ACTIVE entry when no entryId is given', async () => {
    const { supabase, calls } = makeMockSupabase({ lookup: { data: { ...ENTRY, actions_remaining: 2 } }, update: { data: [{ id: 'e1', actions_remaining: 1 }] } })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1' })
    expect(r.ok).toBe(true)
    expect(calls.find(c => c.op === 'lookup')?.mode).toBe('maybeSingle')
  })

  it('errors when there is no active entry', async () => {
    const { supabase } = makeMockSupabase({ lookup: { data: null } })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/no active entry/)
  })

  it('propagates a lookup error', async () => {
    const { supabase } = makeMockSupabase({ lookup: { error: { message: 'rls denied' } } })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1', entryId: 'e1' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('rls denied')
  })

  it('detects a silent RLS fail (update returns 0 rows, no error)', async () => {
    const { supabase } = makeMockSupabase({ lookup: { data: { ...ENTRY, actions_remaining: 2 } }, update: { data: [] } })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1', entryId: 'e1' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/silent RLS fail/)
    expect(r.newRemaining).toBe(2) // unchanged
  })

  it('propagates an update error', async () => {
    const { supabase } = makeMockSupabase({ lookup: { data: { ...ENTRY, actions_remaining: 2 } }, update: { error: { message: 'update boom' } } })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1', entryId: 'e1' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('update boom')
  })

  it('writes a roll_log action line when actionLabel is given', async () => {
    const { supabase, calls } = makeMockSupabase({ lookup: { data: { ...ENTRY, actions_remaining: 2 } }, update: { data: [{ id: 'e1', actions_remaining: 1 }] } })
    await decrementInitiativeAction(supabase, { campaignId: 'c1', entryId: 'e1', actionLabel: 'Cree Hask - Aim' })
    const ins = calls.find(c => c.op === 'insert')
    expect(ins).toBeTruthy()
    expect(ins.table).toBe('roll_log')
    expect(ins.payload.label).toBe('Cree Hask - Aim')
  })

  it('still decrements when the best-effort roll_log insert throws', async () => {
    const { supabase } = makeMockSupabase({ lookup: { data: { ...ENTRY, actions_remaining: 2 } }, update: { data: [{ id: 'e1', actions_remaining: 1 }] }, insertThrows: true })
    const r = await decrementInitiativeAction(supabase, { campaignId: 'c1', entryId: 'e1', actionLabel: 'Cree Hask - Aim' })
    expect(r.ok).toBe(true)
    expect(r.newRemaining).toBe(1)
  })
})
