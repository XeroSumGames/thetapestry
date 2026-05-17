import { describe, it, expect } from 'vitest'
import { getOutcome, outcomeColor, compactRollSummary } from '../../lib/roll-helpers'

describe('getOutcome', () => {
  it('returns Low Insight on snake-eyes (1+1) regardless of total', () => {
    expect(getOutcome(2, 1, 1)).toBe('Low Insight')
  })

  it('returns High Insight on boxcars (6+6) regardless of total', () => {
    expect(getOutcome(12, 6, 6)).toBe('High Insight')
  })

  it('returns Dire Failure when total <= 3', () => {
    expect(getOutcome(3, 1, 2)).toBe('Dire Failure')
    expect(getOutcome(2, 1, 1)).toBe('Low Insight') // 1+1 wins
  })

  it('returns Failure when 4 <= total <= 8', () => {
    expect(getOutcome(4, 1, 3)).toBe('Failure')
    expect(getOutcome(8, 3, 5)).toBe('Failure')
  })

  it('returns Success when 9 <= total <= 13', () => {
    expect(getOutcome(9, 4, 5)).toBe('Success')
    expect(getOutcome(13, 6, 7)).toBe('Success')
  })

  it('returns Wild Success when total >= 14', () => {
    expect(getOutcome(14, 6, 8)).toBe('Wild Success')
    expect(getOutcome(20, 10, 10)).toBe('Wild Success')
  })

  it('honors skipInsightPair to suppress 1+1 / 6+6 special handling', () => {
    // 1+1 with skipInsightPair=true should fall through to total=2 → Dire Failure
    expect(getOutcome(2, 1, 1, true)).toBe('Dire Failure')
    // 6+6 with skipInsightPair=true at total=12 → Success
    expect(getOutcome(12, 6, 6, true)).toBe('Success')
  })

  it('Insight pair takes precedence over Wild Success/Dire Failure thresholds', () => {
    // High Insight beats Wild Success
    expect(getOutcome(20, 6, 6)).toBe('High Insight')
    // Low Insight beats Dire Failure
    expect(getOutcome(2, 1, 1)).toBe('Low Insight')
  })
})

describe('outcomeColor', () => {
  it('returns green for Wild Success', () => {
    expect(outcomeColor('Wild Success')).toBe('#7fc458')
  })

  it('returns green for High Insight', () => {
    expect(outcomeColor('High Insight')).toBe('#7fc458')
  })

  it('returns blue for Success', () => {
    expect(outcomeColor('Success')).toBe('#7ab3d4')
  })

  it('returns amber for Failure', () => {
    expect(outcomeColor('Failure')).toBe('#EF9F27')
  })

  it('returns red for Dire Failure', () => {
    expect(outcomeColor('Dire Failure')).toBe('#c0392b')
  })

  it('returns red for Low Insight', () => {
    expect(outcomeColor('Low Insight')).toBe('#c0392b')
  })

  it('returns the muted default for unknown outcomes', () => {
    expect(outcomeColor('something_else')).toBe('#d4cfc9')
    expect(outcomeColor('')).toBe('#d4cfc9')
  })
})

describe('compactRollSummary', () => {
  // The function has many regex-driven branches; here we cover only the
  // simple "return label verbatim" early-exit cases. The label-parsing
  // branches are intentionally not unit-tested - they're better verified
  // via the roll-feed-log-preview.html visual reference.

  it('returns label verbatim for wound_infection_warning', () => {
    const label = 'Cree Hask has a wound that may become infected'
    expect(compactRollSummary({ label, character_name: 'Cree Hask', outcome: 'wound_infection_warning' })).toBe(label)
  })

  it('returns label verbatim for weapon_malfunction', () => {
    const label = "Marcus's Carbine jams"
    expect(compactRollSummary({ label, character_name: 'Marcus', outcome: 'weapon_malfunction' })).toBe(label)
  })

  it('returns label verbatim for lasting_wound_acquired', () => {
    const label = 'Cree Hask has picked up a Lasting Wound and is now Skittish (-1 CMod on initiative rolls)'
    expect(compactRollSummary({ label, character_name: 'Cree Hask', outcome: 'lasting_wound_acquired' })).toBe(label)
  })
})
