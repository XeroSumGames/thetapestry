import { describe, it, expect, vi } from 'vitest'
import {
  grantAdvantage,
  consumeAdvantage,
  listPendingAdvantages,
  listCampaignPendingAdvantages,
  deleteAdvantage,
} from '../../lib/advantages'

// Minimal mock supabase that records the query shape per call.
function makeMockSupabase(opts: {
  insertReturn?: { data?: any; error?: { message: string } | null }
  updateError?: { message: string } | null
  selectReturn?: { data?: any[]; error?: { message: string } | null }
  deleteError?: { message: string } | null
} = {}) {
  const calls: any[] = []
  const supabase: any = {
    from(table: string) {
      return {
        insert(payload: any) {
          calls.push({ op: 'insert', table, payload })
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({
                    data: opts.insertReturn?.data ?? { id: 'adv-1', ...payload },
                    error: opts.insertReturn?.error ?? null,
                  })
                },
              }
            },
          }
        },
        update(payload: any) {
          calls.push({ op: 'update', table, payload })
          return {
            eq(_col: string, _val: any) {
              return {
                is(_col2: string, _val2: any) {
                  return Promise.resolve({ error: opts.updateError ?? null })
                },
              }
            },
          }
        },
        select(_cols: string) {
          calls.push({ op: 'select', table })
          const chain: any = {
            eq(_col: string, _val: any) { return chain },
            is(_col: string, _val: any) { return chain },
            order(_col: string, _opts: any) {
              return Promise.resolve({
                data: opts.selectReturn?.data ?? [],
                error: opts.selectReturn?.error ?? null,
              })
            },
          }
          return chain
        },
        delete() {
          calls.push({ op: 'delete', table })
          return {
            eq(_col: string, _val: any) {
              return Promise.resolve({ error: opts.deleteError ?? null })
            },
          }
        },
      }
    },
  }
  return { supabase, calls }
}

describe('grantAdvantage', () => {
  it('shapes the row + returns the inserted advantage', async () => {
    const { supabase, calls } = makeMockSupabase()
    const result = await grantAdvantage({
      supabase,
      campaignId: 'camp-1',
      characterId: 'char-1',
      grantedBy: 'gm-uuid',
      skillName: 'Demolitions*',
      cmodDelta: 1,
      description: 'found a chemistry textbook in the warehouse',
      sourceRollLogId: 'rl-1',
    })
    expect(result.error).toBeNull()
    expect(result.advantage).toBeTruthy()
    expect(calls[0].op).toBe('insert')
    expect(calls[0].table).toBe('advantages')
    expect(calls[0].payload).toEqual({
      campaign_id: 'camp-1',
      character_id: 'char-1',
      granted_by: 'gm-uuid',
      skill_name: 'Demolitions*',
      cmod_delta: 1,
      description: 'found a chemistry textbook in the warehouse',
      source_roll_log_id: 'rl-1',
    })
  })

  it('trims skill_name and description', async () => {
    const { supabase, calls } = makeMockSupabase()
    await grantAdvantage({
      supabase, campaignId: 'c', characterId: 'ch', grantedBy: 'gm',
      skillName: '  Medicine*  ', cmodDelta: 2, description: '  patched up gear  ',
    })
    expect(calls[0].payload.skill_name).toBe('Medicine*')
    expect(calls[0].payload.description).toBe('patched up gear')
  })

  it('rejects empty skill_name', async () => {
    const { supabase } = makeMockSupabase()
    const r = await grantAdvantage({
      supabase, campaignId: 'c', characterId: 'ch', grantedBy: 'gm',
      skillName: '   ', cmodDelta: 1, description: 'x',
    })
    expect(r.advantage).toBeNull()
    expect(r.error).toMatch(/skill_name/)
  })

  it('rejects empty description', async () => {
    const { supabase } = makeMockSupabase()
    const r = await grantAdvantage({
      supabase, campaignId: 'c', characterId: 'ch', grantedBy: 'gm',
      skillName: 'x', cmodDelta: 1, description: '   ',
    })
    expect(r.advantage).toBeNull()
    expect(r.error).toMatch(/description/)
  })

  it('rejects zero or non-finite cmod_delta', async () => {
    const { supabase } = makeMockSupabase()
    expect((await grantAdvantage({
      supabase, campaignId: 'c', characterId: 'ch', grantedBy: 'gm',
      skillName: 'x', cmodDelta: 0, description: 'x',
    })).error).toMatch(/cmod_delta/)
    expect((await grantAdvantage({
      supabase, campaignId: 'c', characterId: 'ch', grantedBy: 'gm',
      skillName: 'x', cmodDelta: Number.NaN, description: 'x',
    })).error).toMatch(/cmod_delta/)
  })

  it('surfaces RLS / DB errors as a string', async () => {
    const { supabase } = makeMockSupabase({ insertReturn: { error: { message: 'rls denial' } } })
    const r = await grantAdvantage({
      supabase, campaignId: 'c', characterId: 'ch', grantedBy: 'gm',
      skillName: 'x', cmodDelta: 1, description: 'y',
    })
    expect(r.error).toBe('rls denial')
    expect(r.advantage).toBeNull()
  })
})

describe('consumeAdvantage', () => {
  it('updates consumed_at + optional link, gated to pending rows', async () => {
    const { supabase, calls } = makeMockSupabase()
    const r = await consumeAdvantage(supabase, 'adv-1', 'rl-2')
    expect(r.error).toBeNull()
    expect(calls[0].op).toBe('update')
    expect(calls[0].payload.consumed_roll_log_id).toBe('rl-2')
    expect(typeof calls[0].payload.consumed_at).toBe('string')
  })

  it('omits consumed_roll_log_id when not provided', async () => {
    const { supabase, calls } = makeMockSupabase()
    await consumeAdvantage(supabase, 'adv-1')
    expect(calls[0].payload.consumed_roll_log_id).toBeNull()
  })

  it('surfaces RLS errors', async () => {
    const { supabase } = makeMockSupabase({ updateError: { message: 'denied' } })
    expect((await consumeAdvantage(supabase, 'adv-1')).error).toBe('denied')
  })
})

describe('listPendingAdvantages', () => {
  it('returns rows when present', async () => {
    const fake = [{ id: 'a', character_id: 'c', consumed_at: null }]
    const { supabase } = makeMockSupabase({ selectReturn: { data: fake as any } })
    const r = await listPendingAdvantages(supabase, 'c')
    expect(r.error).toBeNull()
    expect(r.rows).toEqual(fake)
  })

  it('returns empty array on error (with error string)', async () => {
    const { supabase } = makeMockSupabase({ selectReturn: { error: { message: 'oops' } } })
    const r = await listPendingAdvantages(supabase, 'c')
    expect(r.error).toBe('oops')
    expect(r.rows).toEqual([])
  })
})

describe('listCampaignPendingAdvantages', () => {
  it('queries the advantages table with the campaign scope', async () => {
    const fake = [{ id: 'a' }, { id: 'b' }]
    const { supabase } = makeMockSupabase({ selectReturn: { data: fake as any } })
    const r = await listCampaignPendingAdvantages(supabase, 'camp-1')
    expect(r.rows).toHaveLength(2)
    expect(r.error).toBeNull()
  })
})

describe('deleteAdvantage', () => {
  it('issues a delete against the advantages table', async () => {
    const { supabase, calls } = makeMockSupabase()
    await deleteAdvantage(supabase, 'adv-1')
    expect(calls[0].op).toBe('delete')
    expect(calls[0].table).toBe('advantages')
  })

  it('surfaces RLS errors', async () => {
    const { supabase } = makeMockSupabase({ deleteError: { message: 'no perm' } })
    expect((await deleteAdvantage(supabase, 'adv-1')).error).toBe('no perm')
  })
})
