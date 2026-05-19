import { describe, it, expect, vi } from 'vitest'
import {
  firstImpressionCmodDelta,
  firstImpressionVibe,
  firstImpressionProgressionMessage,
  resolveFirstImpression,
} from '../../lib/first-impression-resolver'

describe('firstImpressionCmodDelta', () => {
  it('maps the SRD ladder outcomes exactly', () => {
    expect(firstImpressionCmodDelta('High Insight')).toBe(2)
    expect(firstImpressionCmodDelta('Wild Success')).toBe(1)
    expect(firstImpressionCmodDelta('Success')).toBe(0)
    expect(firstImpressionCmodDelta('Failure')).toBe(-1)
    expect(firstImpressionCmodDelta('Dire Failure')).toBe(-2)
    expect(firstImpressionCmodDelta('Low Insight')).toBe(-3)
  })

  it('does NOT use the legacy shifted ladder', () => {
    // Pre-2026-05-10 code shifted every tier +1 (Success gave +1
    // instead of 0, Low Insight gave -2 instead of -3, etc).
    // Locking the corrected mapping against regression.
    expect(firstImpressionCmodDelta('Success')).not.toBe(1)
    expect(firstImpressionCmodDelta('Low Insight')).not.toBe(-2)
    expect(firstImpressionCmodDelta('Dire Failure')).not.toBe(-1)
  })

  it('returns 0 for unknown outcomes (defensive)', () => {
    expect(firstImpressionCmodDelta('')).toBe(0)
    expect(firstImpressionCmodDelta('UnknownOutcome')).toBe(0)
    expect(firstImpressionCmodDelta('Grappled!')).toBe(0)
  })
})

describe('firstImpressionVibe', () => {
  it('maps each canonical delta to its vibe label', () => {
    expect(firstImpressionVibe(2)).toBe('great first impression')
    expect(firstImpressionVibe(1)).toBe('good first impression')
    expect(firstImpressionVibe(0)).toBe('neutral first impression')
    expect(firstImpressionVibe(-1)).toBe('rough start')
    expect(firstImpressionVibe(-2)).toBe('bad blood')
    expect(firstImpressionVibe(-3)).toBe('catastrophic first impression')
  })

  it('treats >= +2 as great (defensive vs clamp jitter)', () => {
    expect(firstImpressionVibe(3)).toBe('great first impression')
    expect(firstImpressionVibe(99)).toBe('great first impression')
  })

  it('falls back to catastrophic for under -3 (defensive)', () => {
    expect(firstImpressionVibe(-4)).toBe('catastrophic first impression')
    expect(firstImpressionVibe(-99)).toBe('catastrophic first impression')
  })
})

describe('firstImpressionProgressionMessage', () => {
  it('formats with NPC name + signed CMod for positive', () => {
    expect(firstImpressionProgressionMessage('Jules', 2))
      .toBe('Met Jules - great first impression (CMod +2).')
    expect(firstImpressionProgressionMessage('Marlowe Finch', 1))
      .toBe('Met Marlowe Finch - good first impression (CMod +1).')
  })

  it('uses +0 (not -0) for the zero case', () => {
    expect(firstImpressionProgressionMessage('Frankie', 0))
      .toBe('Met Frankie - neutral first impression (CMod +0).')
  })

  it('preserves the minus sign for negatives (no extra "+")', () => {
    expect(firstImpressionProgressionMessage('Stranger', -1))
      .toBe('Met Stranger - rough start (CMod -1).')
    expect(firstImpressionProgressionMessage('Enemy', -3))
      .toBe('Met Enemy - catastrophic first impression (CMod -3).')
  })

  it('handles NPC names with spaces and punctuation', () => {
    expect(firstImpressionProgressionMessage("Frank \"Frankie\" Wallace", 0))
      .toBe('Met Frank "Frankie" Wallace - neutral first impression (CMod +0).')
  })
})

// ── Phase 2: resolveFirstImpression side-effectful resolver ────────
// Mocks the supabase client surface (from().insert() and rpc()) and
// asserts the resolver calls them with the right shape + returns
// the computed cmodDelta/vibe/warnings.

function makeMockSupabase(opts: {
  insertError?: { message: string } | null
  rpcError?: { message: string } | null
  selectError?: { message: string } | null
} = {}) {
  const insertCalls: any[] = []
  const rpcCalls: any[] = []
  const supabase: any = {
    from(_table: string) {
      return {
        insert(payload: any) {
          insertCalls.push({ table: _table, payload })
          return Promise.resolve({ error: opts.insertError ?? null })
        },
        select(_cols: string) {
          return {
            eq(_col: string, _val: any) {
              return {
                single() {
                  // For appendProgressionEntry's read step. Return an
                  // empty character data envelope so the append path
                  // succeeds.
                  return Promise.resolve({ data: { data: {} }, error: opts.selectError ?? null })
                },
              }
            },
          }
        },
        update(_payload: any) {
          return { eq(_col: string, _val: any) { return Promise.resolve({ error: null }) } }
        },
      }
    },
    rpc(_fn: string, args: any) {
      rpcCalls.push({ fn: _fn, args })
      return Promise.resolve({ error: opts.rpcError ?? null })
    },
  }
  return { supabase, insertCalls, rpcCalls }
}

describe('resolveFirstImpression', () => {
  it('writes roll_log + bumps relationship + returns delta/vibe (clean path)', async () => {
    const { supabase, insertCalls, rpcCalls } = makeMockSupabase()
    const result = await resolveFirstImpression({
      supabase,
      campaignId: 'camp-1',
      userId: 'user-1',
      characterId: 'char-1',
      characterName: 'Shimmy Paint',
      npcId: 'npc-1',
      npcName: 'Jules',
      die1: 6, die2: 6, amod: 2, smod: 2, cmod: 0, total: 16,
      outcome: 'High Insight',
    })
    expect(result.cmodDelta).toBe(2)
    expect(result.vibe).toBe('great first impression')
    expect(result.warnings).toEqual([])
    // First insert is the roll_log row.
    expect(insertCalls[0].table).toBe('roll_log')
    expect(insertCalls[0].payload.label).toBe('Shimmy Paint - First Impression (Jules)')
    expect(insertCalls[0].payload.outcome).toBe('High Insight')
    // RPC call has the right shape.
    expect(rpcCalls[0].fn).toBe('bump_npc_relationship_cmod')
    expect(rpcCalls[0].args.p_delta).toBe(2)
    expect(rpcCalls[0].args.p_set_revealed).toBe(true)
    expect(rpcCalls[0].args.p_reveal_level).toBe('name_portrait')
  })

  it('surfaces RPC error as a warning, keeps going', async () => {
    const { supabase } = makeMockSupabase({ rpcError: { message: 'fake rls denial' } })
    const result = await resolveFirstImpression({
      supabase, campaignId: 'c', userId: 'u', characterId: 'char', characterName: 'X',
      npcId: 'n', npcName: 'Y',
      die1: 1, die2: 2, amod: 0, smod: 0, cmod: 0, total: 3, outcome: 'Dire Failure',
    })
    expect(result.cmodDelta).toBe(-2)
    expect(result.vibe).toBe('bad blood')
    expect(result.warnings.some(w => w.includes('fake rls denial'))).toBe(true)
  })

  it('surfaces roll_log error as a warning, keeps going to RPC', async () => {
    const { supabase, rpcCalls } = makeMockSupabase({ insertError: { message: 'log down' } })
    const result = await resolveFirstImpression({
      supabase, campaignId: 'c', userId: 'u', characterId: 'char', characterName: 'X',
      npcId: 'n', npcName: 'Y',
      die1: 4, die2: 5, amod: 0, smod: 0, cmod: 0, total: 9, outcome: 'Success',
    })
    expect(result.cmodDelta).toBe(0)
    expect(result.warnings.some(w => w.includes('log down'))).toBe(true)
    // RPC still attempted despite log failure.
    expect(rpcCalls).toHaveLength(1)
  })
})
