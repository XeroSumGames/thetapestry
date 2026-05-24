import { describe, it, expect } from 'vitest'
import {
  STRESS_CAP,
  incapRounds,
  nextStress,
  clearedInfectionFields,
  clearedConditionFields,
  mortalWoundCountdown,
} from '../../lib/conditions'

describe('conditions - incapRounds (mirror of Math.max(1, 4 - PHY))', () => {
  it('is 4 at PHY 0', () => expect(incapRounds(0)).toBe(4))
  it('decreases with PHY', () => {
    expect(incapRounds(1)).toBe(3)
    expect(incapRounds(3)).toBe(1)
  })
  it('floors at 1 for high PHY', () => {
    expect(incapRounds(4)).toBe(1)
    expect(incapRounds(9)).toBe(1)
  })
  it('treats null/undefined PHY as 0', () => {
    expect(incapRounds(null)).toBe(4)
    expect(incapRounds(undefined)).toBe(4)
  })
})

describe('conditions - nextStress (mirror of Math.min(5, (cur ?? 0) + 1))', () => {
  it('increments by 1', () => {
    expect(nextStress(0)).toBe(1)
    expect(nextStress(3)).toBe(4)
  })
  it('caps at STRESS_CAP (5)', () => {
    expect(nextStress(4)).toBe(5)
    expect(nextStress(5)).toBe(5)
    expect(nextStress(99)).toBe(5)
  })
  it('treats null/undefined as 0 -> 1', () => {
    expect(nextStress(null)).toBe(1)
    expect(nextStress(undefined)).toBe(1)
  })
  it('STRESS_CAP is 5', () => expect(STRESS_CAP).toBe(5))
})

describe('conditions - clearedInfectionFields', () => {
  it('returns the canonical clean infection block', () => {
    expect(clearedInfectionFields()).toEqual({
      infection_state: null,
      infection_days_left: 0,
      infection_lasting_risk: false,
      infection_severity: null,
      infection_started_at: null,
      infection_infected_by: null,
      infection_pending_lasting_check: false,
    })
  })
})

describe('conditions - clearedConditionFields (Restore reset, mirror of RestorePickerModal)', () => {
  it('PC variant zeroes stress + nulls MW/incap + clears infection', () => {
    const f = clearedConditionFields({ includeStress: true })
    expect(f.death_countdown).toBeNull()
    expect(f.incap_rounds).toBeNull()
    expect(f.stress).toBe(0)
    expect(f.infection_state).toBeNull()
    expect(f.infection_lasting_risk).toBe(false)
    expect(f.infection_pending_lasting_check).toBe(false)
  })
  it('NPC variant omits stress entirely (no NPC stress column, by canon)', () => {
    const f = clearedConditionFields({ includeStress: false })
    expect('stress' in f).toBe(false)
    expect(f.death_countdown).toBeNull()
    expect(f.incap_rounds).toBeNull()
    expect(f.infection_state).toBeNull()
  })
  it('does NOT touch lasting wounds (separate table; Phase-2 writer owns that)', () => {
    const f = clearedConditionFields({ includeStress: true })
    expect('lasting_wounds' in f).toBe(false)
    expect('lastingWounds' in f).toBe(false)
  })
})

describe('conditions - mortalWoundCountdown (re-exported from table-roll-context)', () => {
  it('is callable through the conditions module', () => {
    expect(typeof mortalWoundCountdown).toBe('function')
    expect(typeof mortalWoundCountdown(0)).toBe('number')
  })
})
