import { describe, it, expect } from 'vitest'
import { OUTCOME } from '../../lib/roll-outcomes'

// These tests look tautological but they lock the literal string values
// that the DB and the roll_log readers depend on. Changing 'Wild Success'
// to 'Wild  Success' (double space), 'wild_success' (snake_case), or
// anything else would silently break the column without these guards.
// They're cheap insurance.

describe('OUTCOME — roll result labels (capital-case)', () => {
  it('Success = "Success"', () => {
    expect(OUTCOME.Success).toBe('Success')
  })
  it('Failure = "Failure"', () => {
    expect(OUTCOME.Failure).toBe('Failure')
  })
  it('WildSuccess = "Wild Success" (single space)', () => {
    expect(OUTCOME.WildSuccess).toBe('Wild Success')
  })
  it('DireFailure = "Dire Failure" (single space)', () => {
    expect(OUTCOME.DireFailure).toBe('Dire Failure')
  })
  it('HighInsight = "High Insight" (single space)', () => {
    expect(OUTCOME.HighInsight).toBe('High Insight')
  })
  it('LowInsight = "Low Insight" (single space)', () => {
    expect(OUTCOME.LowInsight).toBe('Low Insight')
  })
})

describe('OUTCOME — grapple-specific results', () => {
  it('Grappled = "Grappled!" (includes the bang)', () => {
    expect(OUTCOME.Grappled).toBe('Grappled!')
  })
  it('GrappleFailed = "Failed - 1 RP"', () => {
    expect(OUTCOME.GrappleFailed).toBe('Failed - 1 RP')
  })
  it('GrappleNoVictor = "No clear victor"', () => {
    expect(OUTCOME.GrappleNoVictor).toBe('No clear victor')
  })
})

describe('OUTCOME — event tags (lowercase, key matches value)', () => {
  // Spot-check: if any of these drift, the renderer falls through to
  // the default branch and the row renders generically. Lock the set.
  const lowercaseTags = [
    'action', 'barter', 'cdp', 'clothed_check', 'combat_end', 'combat_start',
    'coordinate', 'death', 'defer', 'drop', 'encumbrance', 'evolution',
    'fed_check', 'incap', 'initiative', 'loot', 'morale_check', 'pending_heal',
    'rations', 'recruit', 'retention_check', 'revive', 'sprint', 'stress',
    'subsistence',
  ] as const

  for (const tag of lowercaseTags) {
    it(`${tag} = "${tag}"`, () => {
      // OUTCOME[tag] is typed as the literal string by `as const`.
      expect((OUTCOME as Record<string, string>)[tag]).toBe(tag)
    })
  }
})
