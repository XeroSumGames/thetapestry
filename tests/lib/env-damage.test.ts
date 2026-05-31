import { describe, it, expect } from 'vitest'
import {
  fallingDamage,
  holdBreathRounds,
  drowningDamage,
  drowningResistCmod,
  subsistenceRecovery,
} from '../../lib/env-damage'

describe('fallingDamage - 3 WP + 3 RP per 10 ft', () => {
  it('0 ft = no damage', () => {
    expect(fallingDamage(0)).toEqual({ wp: 0, rp: 0 })
  })
  it('9 ft = no damage (under the 10 ft threshold)', () => {
    expect(fallingDamage(9)).toEqual({ wp: 0, rp: 0 })
  })
  it('10 ft = 3 WP + 3 RP', () => {
    expect(fallingDamage(10)).toEqual({ wp: 3, rp: 3 })
  })
  it('25 ft = 2 segments = 6 WP + 6 RP (floor)', () => {
    expect(fallingDamage(25)).toEqual({ wp: 6, rp: 6 })
  })
  it('50 ft = 15 WP + 15 RP', () => {
    expect(fallingDamage(50)).toEqual({ wp: 15, rp: 15 })
  })
  it('handles negative + NaN gracefully (0 damage)', () => {
    expect(fallingDamage(-5)).toEqual({ wp: 0, rp: 0 })
    expect(fallingDamage(NaN)).toEqual({ wp: 0, rp: 0 })
    expect(fallingDamage(Infinity)).toEqual({ wp: 0, rp: 0 })
  })
})

describe('holdBreathRounds - 6 + PHY AMod', () => {
  it('PHY 0 = 6 rounds', () => {
    expect(holdBreathRounds(0)).toBe(6)
  })
  it('PHY +2 = 8 rounds', () => {
    expect(holdBreathRounds(2)).toBe(8)
  })
  it('PHY -2 = 4 rounds', () => {
    expect(holdBreathRounds(-2)).toBe(4)
  })
  it('a PHY mod low enough to drive the window below 0 floors at 0', () => {
    expect(holdBreathRounds(-10)).toBe(0)
  })
})

describe('drowningDamage - 3 WP + 3 RP per round past the hold-breath window', () => {
  it('within the hold-breath window = 0 damage', () => {
    expect(drowningDamage(0, 6)).toEqual({ wp: 0, rp: 0 })
    expect(drowningDamage(2, 8)).toEqual({ wp: 0, rp: 0 })
  })
  it('1 round past the window = 3 WP + 3 RP', () => {
    expect(drowningDamage(0, 7)).toEqual({ wp: 3, rp: 3 })
  })
  it('3 rounds past the window = 9 WP + 9 RP', () => {
    expect(drowningDamage(0, 9)).toEqual({ wp: 9, rp: 9 })
  })
  it('PHY boost extends the safe window', () => {
    expect(drowningDamage(4, 10)).toEqual({ wp: 0, rp: 0 }) // window 10, exactly hit
    expect(drowningDamage(4, 11)).toEqual({ wp: 3, rp: 3 })
  })
  it('handles negative + NaN submergedRounds (0 damage)', () => {
    expect(drowningDamage(0, -3)).toEqual({ wp: 0, rp: 0 })
    expect(drowningDamage(0, NaN)).toEqual({ wp: 0, rp: 0 })
  })
})

describe('drowningResistCmod - cumulative -1 per round past the window', () => {
  it('within the window = 0', () => {
    expect(drowningResistCmod(0, 5)).toBe(0)
    expect(drowningResistCmod(2, 8)).toBe(0)
  })
  it('1 round past = -1', () => {
    expect(drowningResistCmod(0, 7)).toBe(-1)
  })
  it('5 rounds past = -5', () => {
    expect(drowningResistCmod(0, 11)).toBe(-5)
  })
})

describe('subsistenceRecovery - 1 WP + 1 RP per fed day, capped at max', () => {
  it('1 day fed restores 1/1 when below max', () => {
    expect(subsistenceRecovery(1, { wp: 5, rp: 5 }, { wp: 10, rp: 10 })).toEqual({ wp: 1, rp: 1 })
  })
  it('3 days fed restores 3/3 when room exists', () => {
    expect(subsistenceRecovery(3, { wp: 5, rp: 5 }, { wp: 10, rp: 10 })).toEqual({ wp: 3, rp: 3 })
  })
  it('caps at max - current (no overflow past cap)', () => {
    expect(subsistenceRecovery(10, { wp: 8, rp: 9 }, { wp: 10, rp: 10 })).toEqual({ wp: 2, rp: 1 })
  })
  it('0 fed days = no healing', () => {
    expect(subsistenceRecovery(0, { wp: 5, rp: 5 }, { wp: 10, rp: 10 })).toEqual({ wp: 0, rp: 0 })
  })
  it('already at max = no healing', () => {
    expect(subsistenceRecovery(5, { wp: 10, rp: 10 }, { wp: 10, rp: 10 })).toEqual({ wp: 0, rp: 0 })
  })
  it('handles negative fedDays (clamped to 0)', () => {
    expect(subsistenceRecovery(-2, { wp: 5, rp: 5 }, { wp: 10, rp: 10 })).toEqual({ wp: 0, rp: 0 })
  })
  it('handles current > max edge (no negative heal)', () => {
    expect(subsistenceRecovery(3, { wp: 12, rp: 12 }, { wp: 10, rp: 10 })).toEqual({ wp: 0, rp: 0 })
  })
})
