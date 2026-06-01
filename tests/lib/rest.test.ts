import { describe, it, expect } from 'vitest'
import { computeRestRecovery, type RestState } from '../../lib/rest'

// Canon: tasks/canon-extract-rest-2026-05-31.md
// WP 1/day (1/2day if mortal) | RP 1/hour (half-max cap while sick) |
// Stress -1 per 8 uninterrupted+enjoyable hours.

const base: RestState = {
  wp_current: 5, wp_max: 10,
  rp_current: 2, rp_max: 6,
  stress: 4,
  death_countdown: null,
  infection_state: null,
}

describe('computeRestRecovery', () => {
  describe('WP track', () => {
    it('heals 1 WP per day for a healthy character', () => {
      const r = computeRestRecovery({ ...base }, 24, false)
      expect(r.wasMortal).toBe(false)
      expect(r.wpHeal).toBe(1)
      expect(r.newWP).toBe(6)
    })

    it('heals 1 WP per 2 days while in the death countdown (mortal)', () => {
      const r = computeRestRecovery({ ...base, wp_current: 0, death_countdown: 3 }, 96, false) // 4 days
      expect(r.wasMortal).toBe(true)
      expect(r.wpHeal).toBe(2) // floor(4/2)
      expect(r.newWP).toBe(2)
    })

    it('treats wp_current=0 as mortal even without a countdown', () => {
      const r = computeRestRecovery({ ...base, wp_current: 0 }, 48, false)
      expect(r.wasMortal).toBe(true)
      expect(r.wpHeal).toBe(1) // floor(2/2)
    })

    it('clamps WP to wp_max', () => {
      const r = computeRestRecovery({ ...base, wp_current: 9 }, 240, false) // 10 days -> +10
      expect(r.newWP).toBe(10)
    })

    it('heals 0 WP for a sub-day rest', () => {
      const r = computeRestRecovery({ ...base }, 12, false)
      expect(r.wpHeal).toBe(0)
    })
  })

  describe('RP track', () => {
    it('recovers 1 RP per hour for a healthy character', () => {
      const r = computeRestRecovery({ ...base }, 3, false)
      expect(r.rpGain).toBe(3)
      expect(r.newRP).toBe(5)
    })

    it('clamps RP to rp_max', () => {
      const r = computeRestRecovery({ ...base, rp_current: 5 }, 10, false)
      expect(r.newRP).toBe(6)
      expect(r.rpGain).toBe(1)
    })

    it('caps RP at half-max (floor) while Sick', () => {
      const r = computeRestRecovery({ ...base, rp_current: 1, infection_state: 'sickness' }, 24, false)
      expect(r.isSick).toBe(true)
      expect(r.newRP).toBe(3) // floor(6/2)
      expect(r.rpGain).toBe(2)
    })

    it('does not push RP below its current value when already over the sick cap', () => {
      const r = computeRestRecovery({ ...base, rp_current: 5, infection_state: 'sickness' }, 24, false)
      expect(r.newRP).toBe(5) // already above floor(6/2)=3; rest does not lower it
      expect(r.rpGain).toBe(0)
    })

    it('a wound infection (not sickness) does NOT cap RP', () => {
      const r = computeRestRecovery({ ...base, rp_current: 1, infection_state: 'wound' }, 24, false)
      expect(r.isSick).toBe(false)
      expect(r.newRP).toBe(6) // full max
    })
  })

  describe('Stress cooling off', () => {
    it('drops 1 pip per 8 uninterrupted+enjoyable hours', () => {
      const r = computeRestRecovery({ ...base }, 8, true)
      expect(r.stressDrop).toBe(1)
      expect(r.newStress).toBe(3)
    })

    it('stacks pips: 24h restful = -3 stress', () => {
      const r = computeRestRecovery({ ...base, stress: 5 }, 24, true)
      expect(r.stressDrop).toBe(3)
      expect(r.newStress).toBe(2)
    })

    it('drops nothing when the rest was not restful (GM toggle off)', () => {
      const r = computeRestRecovery({ ...base }, 24, false)
      expect(r.stressDrop).toBe(0)
      expect(r.newStress).toBe(4)
    })

    it('drops nothing below the 8h canon minimum even if restful', () => {
      const r = computeRestRecovery({ ...base }, 7, true)
      expect(r.stressDrop).toBe(0)
    })

    it('floors stress at 0', () => {
      const r = computeRestRecovery({ ...base, stress: 2 }, 40, true) // floor(40/8)=5 pips
      expect(r.stressDrop).toBe(5)
      expect(r.newStress).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('zero / negative hours recover nothing', () => {
      const r = computeRestRecovery({ ...base }, 0, true)
      expect(r.wpHeal).toBe(0)
      expect(r.rpGain).toBe(0)
      expect(r.stressDrop).toBe(0)
    })

    it('does not touch wp_max / rp_max / stress fields beyond the computed deltas', () => {
      // Negative assertion: lasting wounds / breaking-point penalties live
      // elsewhere; this helper only ever returns WP/RP/Stress deltas.
      const r = computeRestRecovery({ ...base }, 24, true)
      expect(Object.keys(r).sort()).toEqual(
        ['isSick', 'newRP', 'newStress', 'newWP', 'rpGain', 'stressDrop', 'totalHours', 'wasMortal', 'wpHeal'].sort()
      )
    })
  })
})
