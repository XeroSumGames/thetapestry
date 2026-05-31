import { describe, it, expect } from 'vitest'
import {
  OUTCOME,
  outcomeKind,
  isRollResult,
  isGrappleResult,
  isEventTag,
  type RollOutcome,
} from '../../lib/roll-outcomes'

// These tests look tautological but they lock the literal string values
// that the DB and the roll_log readers depend on. Changing 'Wild Success'
// to 'Wild  Success' (double space), 'wild_success' (snake_case), or
// anything else would silently break the column without these guards.
// They're cheap insurance.

describe('OUTCOME - roll result labels (capital-case)', () => {
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

describe('OUTCOME - grapple-specific results', () => {
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

describe('OUTCOME - event tags (lowercase, key matches value)', () => {
  // Spot-check: if any of these drift, the renderer falls through to
  // the default branch and the row renders generically. Lock the set.
  const lowercaseTags = [
    'action', 'barter', 'cdp', 'clothed_check', 'combat_end', 'combat_start',
    'coordinate', 'death', 'defer', 'drop', 'encumbrance', 'evolution',
    'fed_check', 'incap', 'initiative', 'loot', 'morale_check', 'pending_heal',
    'rest', 'falling', 'drowning', 'rations', 'recruit', 'retention_check', 'revive', 'sprint', 'stress',
    'subsistence',
  ] as const

  for (const tag of lowercaseTags) {
    it(`${tag} = "${tag}"`, () => {
      // OUTCOME[tag] is typed as the literal string by `as const`.
      expect((OUTCOME as Record<string, string>)[tag]).toBe(tag)
    })
  }
})

// ── Phase O1: kind discrimination + type guards (added 2026-05-20) ──
// Spec: tasks/spec-outcome-column-split.md. Pure additive - the new
// helpers exist so future readers (Phase O2) can switch on kind first,
// then narrow within the kind. Tests below lock the (a) named
// per-kind mappings and (b) exhaustiveness invariant: every OUTCOME
// value maps to EXACTLY ONE kind. Adding a value to OUTCOME without
// extending the corresponding sub-union would surface here.

describe('outcomeKind discriminator', () => {
  it('returns "roll" on Wild Success', () => {
    expect(outcomeKind(OUTCOME.WildSuccess)).toBe('roll')
  })
  it('returns "roll" on all 6 dice-result labels', () => {
    expect(outcomeKind(OUTCOME.Success)).toBe('roll')
    expect(outcomeKind(OUTCOME.Failure)).toBe('roll')
    expect(outcomeKind(OUTCOME.WildSuccess)).toBe('roll')
    expect(outcomeKind(OUTCOME.DireFailure)).toBe('roll')
    expect(outcomeKind(OUTCOME.HighInsight)).toBe('roll')
    expect(outcomeKind(OUTCOME.LowInsight)).toBe('roll')
  })

  it('returns "grapple" on Grappled!', () => {
    expect(outcomeKind(OUTCOME.Grappled)).toBe('grapple')
  })
  it('returns "grapple" on all 3 grapple labels', () => {
    expect(outcomeKind(OUTCOME.Grappled)).toBe('grapple')
    expect(outcomeKind(OUTCOME.GrappleFailed)).toBe('grapple')
    expect(outcomeKind(OUTCOME.GrappleNoVictor)).toBe('grapple')
  })

  it('returns "event" on death', () => {
    expect(outcomeKind(OUTCOME.death)).toBe('event')
  })
  it('returns "event" on a sampling of event tags', () => {
    expect(outcomeKind(OUTCOME.combat_start)).toBe('event')
    expect(outcomeKind(OUTCOME.loot)).toBe('event')
    expect(outcomeKind(OUTCOME.morale_check)).toBe('event')
    expect(outcomeKind(OUTCOME.wound_infection_warning)).toBe('event')
    expect(outcomeKind(OUTCOME.advantage_used)).toBe('event')
    expect(outcomeKind(OUTCOME.gather_materials)).toBe('event')
  })

  // Exhaustiveness invariant: every OUTCOME value maps to exactly
  // one kind. If a new value is added to OUTCOME but the EventTag
  // union (or the matching type guard) is forgotten, isEventTag's
  // "everything not roll, not grapple" implementation makes the
  // helpers still classify it correctly at runtime - but the EventTag
  // union would lose its type-level exhaustiveness. This test catches
  // the former; tsc -noEmit + the type-narrowing in O2 readers will
  // catch the latter.
  it('every OUTCOME value classifies as exactly one of roll / grapple / event', () => {
    const values = Object.values(OUTCOME)
    expect(values.length).toBeGreaterThan(0)
    for (const v of values) {
      const k = outcomeKind(v as RollOutcome)
      expect(['roll', 'grapple', 'event']).toContain(k)
      // Exactly-one assertion: count how many type guards return true.
      const matches = [
        isRollResult(v as RollOutcome),
        isGrappleResult(v as RollOutcome),
        isEventTag(v as RollOutcome),
      ].filter(Boolean).length
      expect(matches).toBe(1)
    }
  })

  it('counts: 6 roll + 3 grapple + 33 event = 42 total', () => {
    const values = Object.values(OUTCOME)
    const rollCount = values.filter(v => isRollResult(v as RollOutcome)).length
    const grappleCount = values.filter(v => isGrappleResult(v as RollOutcome)).length
    const eventCount = values.filter(v => isEventTag(v as RollOutcome)).length
    expect(rollCount).toBe(6)
    expect(grappleCount).toBe(3)
    expect(eventCount).toBe(33)
    expect(rollCount + grappleCount + eventCount).toBe(values.length)
  })
})

describe('isRollResult type guard', () => {
  it('returns true for all 6 RollResult values', () => {
    expect(isRollResult(OUTCOME.Success)).toBe(true)
    expect(isRollResult(OUTCOME.Failure)).toBe(true)
    expect(isRollResult(OUTCOME.WildSuccess)).toBe(true)
    expect(isRollResult(OUTCOME.DireFailure)).toBe(true)
    expect(isRollResult(OUTCOME.HighInsight)).toBe(true)
    expect(isRollResult(OUTCOME.LowInsight)).toBe(true)
  })
  it('returns false for grapple + event tags', () => {
    expect(isRollResult(OUTCOME.Grappled)).toBe(false)
    expect(isRollResult(OUTCOME.death)).toBe(false)
    expect(isRollResult(OUTCOME.combat_start)).toBe(false)
  })
})

describe('isGrappleResult type guard', () => {
  it('returns true for all 3 GrappleResult values', () => {
    expect(isGrappleResult(OUTCOME.Grappled)).toBe(true)
    expect(isGrappleResult(OUTCOME.GrappleFailed)).toBe(true)
    expect(isGrappleResult(OUTCOME.GrappleNoVictor)).toBe(true)
  })
  it('returns false for roll + event tags', () => {
    expect(isGrappleResult(OUTCOME.WildSuccess)).toBe(false)
    expect(isGrappleResult(OUTCOME.death)).toBe(false)
    expect(isGrappleResult(OUTCOME.loot)).toBe(false)
  })
})

describe('isEventTag type guard', () => {
  it('returns true for a sampling of event tags', () => {
    expect(isEventTag(OUTCOME.death)).toBe(true)
    expect(isEventTag(OUTCOME.combat_start)).toBe(true)
    expect(isEventTag(OUTCOME.wound_infection_warning)).toBe(true)
    expect(isEventTag(OUTCOME.gather_materials)).toBe(true)
  })
  it('returns false for roll + grapple values', () => {
    expect(isEventTag(OUTCOME.Success)).toBe(false)
    expect(isEventTag(OUTCOME.WildSuccess)).toBe(false)
    expect(isEventTag(OUTCOME.Grappled)).toBe(false)
  })
})
