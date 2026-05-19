// Tests for collapseCoordEffortChains - per-Xero 2026-05-18 behavior
// where Coordinated Effort chain rows fold into a single bespoke banner
// row in the rolls feed. Locks the data-layer transformation; the
// banner JSX is tested visually via roll-feed-log-preview.html and the
// upcoming preplay smoke testplan.

import { describe, it, expect } from 'vitest'
import { collapseCoordEffortChains } from '../../components/RollsFeed'
import type { RollEntry } from '../../components/RollsFeed'

function mkRow(over: Partial<RollEntry>): RollEntry {
  // Minimal row shape - fields not asserted in these tests get sane defaults.
  return {
    id: over.id ?? 'id-' + Math.random().toString(36).slice(2, 8),
    campaign_id: 'camp-1',
    character_name: over.character_name ?? 'Anon',
    label: over.label ?? 'Anon - PHY Check',
    die1: over.die1 ?? 3,
    die2: over.die2 ?? 4,
    amod: over.amod ?? 0,
    smod: over.smod ?? 0,
    cmod: over.cmod ?? 0,
    total: over.total ?? 7,
    outcome: over.outcome ?? 'Success',
    created_at: over.created_at ?? '2026-05-18T20:00:00Z',
    target_name: null,
    damage_json: over.damage_json ?? null,
    insight_awarded: false,
    insight_used: null,
    coord_chain_id: over.coord_chain_id ?? null,
  } as unknown as RollEntry
}

describe('collapseCoordEffortChains', () => {
  it('passes through when there are no chain rows', () => {
    const rows = [
      mkRow({ character_name: 'Enya', label: 'Enya - ACU Check' }),
      mkRow({ character_name: 'Cree', label: 'Cree - PHY Check' }),
    ]
    const out = collapseCoordEffortChains(rows)
    expect(out).toEqual(rows)
  })

  it('collapses a 1-lead + 3-participant chain into a single enriched lead row', () => {
    const chainId = 'chain-1'
    const lead = mkRow({
      id: 'lead', character_name: 'Cree Hask',
      label: 'Coordinated Effort - Tactics*',
      coord_chain_id: chainId, outcome: 'Success', total: 9,
    })
    const p1 = mkRow({ id: 'p1', character_name: 'Marcus', label: 'Marcus - Tactics* (RSN)', coord_chain_id: chainId, outcome: 'Success', total: 8 })
    const p2 = mkRow({ id: 'p2', character_name: 'Knox', label: 'Knox - Tactics* (RSN)', coord_chain_id: chainId, outcome: 'Failure', total: 5 })
    const p3 = mkRow({ id: 'p3', character_name: 'Enya', label: 'Enya - Tactics* (RSN)', coord_chain_id: chainId, outcome: 'Wild Success', total: 12 })

    const out = collapseCoordEffortChains([lead, p1, p2, p3])

    expect(out).toHaveLength(1)
    const banner = out[0]
    expect(banner.id).toBe('lead')
    expect(banner.character_name).toBe('Cree Hask')
    const dj = banner.damage_json as any
    expect(dj.coordChainSkill).toBe('Tactics*')
    expect(dj.coordChainParticipants).toHaveLength(3)
    expect(dj.coordChainParticipants.map((p: any) => p.name)).toEqual(['Marcus', 'Knox', 'Enya'])
    expect(dj.coordChainParticipants[0].outcome).toBe('Success')
    expect(dj.coordChainParticipants[1].outcome).toBe('Failure')
    expect(dj.coordChainParticipants[2].outcome).toBe('Wild Success')
  })

  it('lead-only chain (no participants yet) passes through as a normal row', () => {
    const lead = mkRow({
      id: 'lead', character_name: 'Cree Hask',
      label: 'Coordinated Effort - Tactics*',
      coord_chain_id: 'chain-2', outcome: 'Success',
    })
    const out = collapseCoordEffortChains([lead])
    expect(out).toHaveLength(1)
    expect(out[0]).toBe(lead) // unchanged reference
    expect((out[0].damage_json as any)?.coordChainParticipants).toBeUndefined()
  })

  it('preserves chronological order across chains and pass-through rows', () => {
    const passEarly = mkRow({ id: 'early', label: 'Early - ACU Check', created_at: '2026-05-18T19:00:00Z' })
    const chainId = 'chain-3'
    const lead = mkRow({ id: 'lead', label: 'Coordinated Effort - Tactics*', coord_chain_id: chainId, character_name: 'Cree' })
    const p1 = mkRow({ id: 'p1', label: 'Marcus - Tactics* (RSN)', coord_chain_id: chainId, character_name: 'Marcus' })
    const passLate = mkRow({ id: 'late', label: 'Late - INF Check', created_at: '2026-05-18T20:30:00Z' })

    const out = collapseCoordEffortChains([passEarly, lead, p1, passLate])

    expect(out.map(r => r.id)).toEqual(['early', 'lead', 'late'])
  })

  it('pathological chain with no lead row passes through every row', () => {
    const chainId = 'chain-orphan'
    // All chain rows but none have the "Coordinated Effort - " prefix
    // (could happen if the lead row got deleted or the data is bad).
    // We should NOT swallow these silently.
    const orphan1 = mkRow({ id: 'o1', label: 'Marcus - Tactics* (RSN)', coord_chain_id: chainId, character_name: 'Marcus' })
    const orphan2 = mkRow({ id: 'o2', label: 'Knox - Tactics* (RSN)', coord_chain_id: chainId, character_name: 'Knox' })
    const out = collapseCoordEffortChains([orphan1, orphan2])
    expect(out).toHaveLength(2)
    expect(out.map(r => r.id).sort()).toEqual(['o1', 'o2'])
  })

  it('handles two concurrent chains independently', () => {
    const a = 'chain-a', b = 'chain-b'
    const leadA = mkRow({ id: 'lA', character_name: 'Cree', label: 'Coordinated Effort - Tactics*', coord_chain_id: a })
    const pA1 = mkRow({ id: 'pA1', character_name: 'Marcus', label: 'Marcus - Tactics* (RSN)', coord_chain_id: a })
    const leadB = mkRow({ id: 'lB', character_name: 'Enya', label: 'Coordinated Effort - Inspiration*', coord_chain_id: b })
    const pB1 = mkRow({ id: 'pB1', character_name: 'Knox', label: 'Knox - Inspiration* (INF)', coord_chain_id: b })

    const out = collapseCoordEffortChains([leadA, pA1, leadB, pB1])

    expect(out).toHaveLength(2)
    const banners = out.map(r => ({ id: r.id, skill: (r.damage_json as any)?.coordChainSkill, parts: (r.damage_json as any)?.coordChainParticipants?.map((p: any) => p.name) }))
    expect(banners).toEqual([
      { id: 'lA', skill: 'Tactics*', parts: ['Marcus'] },
      { id: 'lB', skill: 'Inspiration*', parts: ['Knox'] },
    ])
  })
})
