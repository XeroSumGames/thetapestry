import { describe, it, expect } from 'vitest'
import {
  classifyRoll,
  outcomeToMoraleCmod,
  outcomeToDeparturePct,
  isMoraleFailure,
  computeEnoughHandsCmod,
  computeClearVoiceCmod,
  computeSafetyCmod,
  pickDeparturesWeighted,
  formatCmod,
  type CommunityMemberLite,
} from '../../lib/community-logic'

// Helper: build a CommunityMemberLite with sensible defaults.
// Uses `in` checks (not ??) so callers can explicitly override a field
// to null (e.g. npc_id: null for PC-only members).
function member(overrides: Partial<CommunityMemberLite> = {}): CommunityMemberLite {
  const defaults: CommunityMemberLite = {
    id: `m-${Math.random().toString(36).slice(2, 8)}`,
    npc_id: 'npc-1',
    character_id: null,
    role: 'unassigned',
    recruitment_type: 'cohort',
    apprentice_of_character_id: null,
  }
  return { ...defaults, ...overrides }
}

describe('classifyRoll', () => {
  // Mirrors getOutcome from roll-helpers - tested separately there too.
  // Listed here to lock the shared behavior in case the two ever drift.
  it('matches getOutcome thresholds', () => {
    expect(classifyRoll(2, 1, 1)).toBe('Low Insight')
    expect(classifyRoll(12, 6, 6)).toBe('High Insight')
    expect(classifyRoll(3, 1, 2)).toBe('Dire Failure')
    expect(classifyRoll(8, 3, 5)).toBe('Failure')
    expect(classifyRoll(13, 6, 7)).toBe('Success')
    expect(classifyRoll(14, 6, 8)).toBe('Wild Success')
  })
})

describe('outcomeToMoraleCmod', () => {
  it('maps roll outcomes to canon CMod values', () => {
    expect(outcomeToMoraleCmod('High Insight')).toBe(2)
    expect(outcomeToMoraleCmod('Wild Success')).toBe(1)
    expect(outcomeToMoraleCmod('Success')).toBe(0)
    expect(outcomeToMoraleCmod('Failure')).toBe(-1)
    expect(outcomeToMoraleCmod('Dire Failure')).toBe(-2)
    expect(outcomeToMoraleCmod('Low Insight')).toBe(-3)
  })

  it('returns 0 for unknown outcomes', () => {
    expect(outcomeToMoraleCmod('something_weird')).toBe(0)
    expect(outcomeToMoraleCmod('')).toBe(0)
  })
})

describe('outcomeToDeparturePct', () => {
  it('returns canon percentages for failure tiers', () => {
    expect(outcomeToDeparturePct('Failure')).toBe(0.25)
    expect(outcomeToDeparturePct('Dire Failure')).toBe(0.50)
    expect(outcomeToDeparturePct('Low Insight')).toBe(0.75)
  })

  it('returns 0 for success tiers', () => {
    expect(outcomeToDeparturePct('Success')).toBe(0)
    expect(outcomeToDeparturePct('Wild Success')).toBe(0)
    expect(outcomeToDeparturePct('High Insight')).toBe(0)
  })

  it('returns 0 for unknown outcomes', () => {
    expect(outcomeToDeparturePct('weird')).toBe(0)
  })
})

describe('isMoraleFailure', () => {
  it('returns true for the three failure outcomes', () => {
    expect(isMoraleFailure('Failure')).toBe(true)
    expect(isMoraleFailure('Dire Failure')).toBe(true)
    expect(isMoraleFailure('Low Insight')).toBe(true)
  })

  it('returns false for success outcomes', () => {
    expect(isMoraleFailure('Success')).toBe(false)
    expect(isMoraleFailure('Wild Success')).toBe(false)
    expect(isMoraleFailure('High Insight')).toBe(false)
  })
})

describe('computeEnoughHandsCmod', () => {
  it('returns -3 with zero labor pool (no NPCs or all assigned)', () => {
    expect(computeEnoughHandsCmod([])).toBe(-3)
    expect(computeEnoughHandsCmod([member({ role: 'assigned' })])).toBe(-3)
  })

  it('returns +1 when all three categories meet minimums', () => {
    // 10 NPCs: 4 gatherers (40%), 2 maintainers (20%), 1 safety (10%), 3 unassigned.
    // gatherMin = ceil(10*0.33) = 4, maintainMin = ceil(10*0.20) = 2,
    // safetyMin = max(1, ceil(10*0.05)) = 1. All met -> +1.
    const members: CommunityMemberLite[] = [
      ...Array.from({ length: 4 }, () => member({ role: 'gatherer' })),
      ...Array.from({ length: 2 }, () => member({ role: 'maintainer' })),
      member({ role: 'safety' }),
      ...Array.from({ length: 3 }, () => member({ role: 'unassigned' })),
    ]
    expect(computeEnoughHandsCmod(members)).toBe(1)
  })

  it('returns -1 when one category is short', () => {
    // Same as above but short on gatherers (3 instead of 4).
    const members: CommunityMemberLite[] = [
      ...Array.from({ length: 3 }, () => member({ role: 'gatherer' })),
      ...Array.from({ length: 2 }, () => member({ role: 'maintainer' })),
      member({ role: 'safety' }),
      ...Array.from({ length: 4 }, () => member({ role: 'unassigned' })),
    ]
    expect(computeEnoughHandsCmod(members)).toBe(-1)
  })

  it('caps the negative penalty at -3 even if all three are short', () => {
    // 10 NPCs all unassigned -> all three categories at 0.
    const members = Array.from({ length: 10 }, () => member({ role: 'unassigned' }))
    expect(computeEnoughHandsCmod(members)).toBe(-3)
  })

  it('excludes assigned NPCs from the labor pool', () => {
    // Same as the +1 case but with 3 assigned-on-task NPCs added.
    // Pool size stays 10; the assigned 3 don't count toward shortages.
    const members: CommunityMemberLite[] = [
      ...Array.from({ length: 4 }, () => member({ role: 'gatherer' })),
      ...Array.from({ length: 2 }, () => member({ role: 'maintainer' })),
      member({ role: 'safety' }),
      ...Array.from({ length: 3 }, () => member({ role: 'unassigned' })),
      ...Array.from({ length: 3 }, () => member({ role: 'assigned' })),
    ]
    expect(computeEnoughHandsCmod(members)).toBe(1)
  })
})

describe('computeClearVoiceCmod', () => {
  it('returns 0 when an NPC leader is set', () => {
    expect(computeClearVoiceCmod({ leader_npc_id: 'n-1', leader_user_id: null })).toBe(0)
  })

  it('returns 0 when a player leader is set', () => {
    expect(computeClearVoiceCmod({ leader_npc_id: null, leader_user_id: 'u-1' })).toBe(0)
  })

  it('returns -1 when leaderless', () => {
    expect(computeClearVoiceCmod({ leader_npc_id: null, leader_user_id: null })).toBe(-1)
  })
})

describe('computeSafetyCmod', () => {
  it('returns -1 on empty pool', () => {
    expect(computeSafetyCmod([])).toBe(-1)
  })

  it('returns +1 when safety >= 10% of labor pool', () => {
    // 10 NPCs, 1 safety -> 10% exactly.
    const members: CommunityMemberLite[] = [
      member({ role: 'safety' }),
      ...Array.from({ length: 9 }, () => member({ role: 'unassigned' })),
    ]
    expect(computeSafetyCmod(members)).toBe(1)
  })

  it('returns -1 when safety < 5% of labor pool', () => {
    // 30 NPCs, 1 safety -> ~3.3%.
    const members: CommunityMemberLite[] = [
      member({ role: 'safety' }),
      ...Array.from({ length: 29 }, () => member({ role: 'unassigned' })),
    ]
    expect(computeSafetyCmod(members)).toBe(-1)
  })

  it('returns 0 in the 5-9% band', () => {
    // 20 NPCs, 1 safety -> 5%.
    const members: CommunityMemberLite[] = [
      member({ role: 'safety' }),
      ...Array.from({ length: 19 }, () => member({ role: 'unassigned' })),
    ]
    expect(computeSafetyCmod(members)).toBe(0)
  })
})

describe('pickDeparturesWeighted', () => {
  it('returns empty array for count <= 0', () => {
    expect(pickDeparturesWeighted([member()], 0)).toEqual([])
    expect(pickDeparturesWeighted([member()], -5)).toEqual([])
  })

  it('returns empty array when no NPC members exist', () => {
    const pcsOnly = [member({ npc_id: null, character_id: 'c-1' })]
    expect(pickDeparturesWeighted(pcsOnly, 5)).toEqual([])
  })

  it('picks from lowest-priority bucket first (unassigned before cohort)', () => {
    const members: CommunityMemberLite[] = [
      member({ id: 'apprentice-1', recruitment_type: 'apprentice', role: 'gatherer' }),
      member({ id: 'founder-1', recruitment_type: 'founder', role: 'gatherer' }),
      member({ id: 'cohort-1', recruitment_type: 'cohort', role: 'gatherer' }),
      member({ id: 'unassigned-1', recruitment_type: 'member', role: 'unassigned' }),
    ]
    // Should pick the unassigned one first (priority 0).
    expect(pickDeparturesWeighted(members, 1)).toEqual(['unassigned-1'])
  })

  it('returns at most `count` ids', () => {
    const members = Array.from({ length: 5 }, (_, i) =>
      member({ id: `m-${i}`, recruitment_type: 'cohort' })
    )
    const picked = pickDeparturesWeighted(members, 3)
    expect(picked.length).toBe(3)
  })

  it('returns all available when count exceeds pool', () => {
    const members = [
      member({ id: 'a', recruitment_type: 'cohort' }),
      member({ id: 'b', recruitment_type: 'cohort' }),
    ]
    const picked = pickDeparturesWeighted(members, 10)
    expect(picked.length).toBe(2)
  })

  it('picks apprentices last (highest priority = leaves last)', () => {
    const members: CommunityMemberLite[] = [
      member({ id: 'apprentice-1', recruitment_type: 'apprentice', role: 'gatherer' }),
      member({ id: 'cohort-1', recruitment_type: 'cohort', role: 'gatherer' }),
    ]
    // First pick is cohort; apprentice only goes if count covers both.
    expect(pickDeparturesWeighted(members, 1)).toEqual(['cohort-1'])
    expect(pickDeparturesWeighted(members, 2)).toEqual(['cohort-1', 'apprentice-1'])
  })
})

describe('formatCmod', () => {
  it('renders positive values with leading plus', () => {
    expect(formatCmod(2)).toBe('+2')
    expect(formatCmod(1)).toBe('+1')
  })

  it('renders zero as plain "0"', () => {
    expect(formatCmod(0)).toBe('0')
  })

  it('renders negative values with typographic minus (U+2212), not ASCII hyphen', () => {
    // The minus sign in the assertion below is U+2212, not a hyphen.
    // If this test fails after a "fix", suspect the function reverted
    // to ASCII hyphen and the log feed will display inconsistently.
    expect(formatCmod(-2)).toBe('−2')
    expect(formatCmod(-3)).toBe('−3')
  })
})
