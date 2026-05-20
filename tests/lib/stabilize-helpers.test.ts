import { describe, it, expect } from 'vitest'
import { isStabilizeSuccess, rollIncapRounds, stabilizeNarrative } from '../../lib/stabilize-helpers'

describe('isStabilizeSuccess', () => {
  it('returns true on Success / Wild Success / High Insight', () => {
    expect(isStabilizeSuccess('Success')).toBe(true)
    expect(isStabilizeSuccess('Wild Success')).toBe(true)
    expect(isStabilizeSuccess('High Insight')).toBe(true)
  })

  it('returns false on Failure / Dire Failure / Low Insight', () => {
    expect(isStabilizeSuccess('Failure')).toBe(false)
    expect(isStabilizeSuccess('Dire Failure')).toBe(false)
    expect(isStabilizeSuccess('Low Insight')).toBe(false)
  })

  it('returns false on garbage / unknown outcome strings', () => {
    expect(isStabilizeSuccess('')).toBe(false)
    expect(isStabilizeSuccess('Grappled!')).toBe(false)
    expect(isStabilizeSuccess('combat_start')).toBe(false)
  })
})

describe('rollIncapRounds', () => {
  // Deterministic RNG helper: rng() => k/6 gives Math.floor(rng()*6)+1 = k+1
  const fixedD6 = (n: number) => () => (n - 1) / 6 + 0.0001
  // (the +0.0001 nudges past the boundary - rng=1/6 → floor(0.166*6)+1 = 1+1 = 2; we want n)

  it('returns 1d6 - PHY AMod, floored at 1', () => {
    expect(rollIncapRounds(0, fixedD6(3))).toBe(3) // 3 - 0 = 3
    expect(rollIncapRounds(2, fixedD6(5))).toBe(3) // 5 - 2 = 3
    expect(rollIncapRounds(4, fixedD6(2))).toBe(1) // 2 - 4 = -2, floored to 1
  })

  it('frail characters (negative PHY AMod) stay unconscious longer', () => {
    expect(rollIncapRounds(-2, fixedD6(3))).toBe(5) // 3 - (-2) = 5
  })

  it('best case (high PHY + low roll) always returns >= 1', () => {
    expect(rollIncapRounds(6, fixedD6(1))).toBe(1) // 1 - 6 = -5, floored to 1
  })

  it('default rng is Math.random and produces values in [1, 6+phyAmod ceiling]', () => {
    // Smoke test - no fixed RNG, just check the range over many calls
    for (let i = 0; i < 100; i++) {
      const result = rollIncapRounds(0)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(6)
    }
  })
})

describe('stabilizeNarrative', () => {
  it('returns success narrative with correct round pluralization', () => {
    expect(stabilizeNarrative(true, 'Bob', 1)).toBe('Bob stabilized! Incapacitated for 1 round, then regains 1 WP + 1 RP.')
    expect(stabilizeNarrative(true, 'Bob', 3)).toBe('Bob stabilized! Incapacitated for 3 rounds, then regains 1 WP + 1 RP.')
  })

  it('returns terse failure narrative on failed stabilize', () => {
    expect(stabilizeNarrative(false, 'Bob', 0)).toBe('Failed to stabilize Bob.')
    // incapRounds is ignored on failure (caller passes 0 by convention)
    expect(stabilizeNarrative(false, 'Alice', 99)).toBe('Failed to stabilize Alice.')
  })

  it('preserves the target name verbatim (no escaping / casing changes)', () => {
    expect(stabilizeNarrative(true, "O'Malley", 2)).toContain("O'Malley stabilized!")
    expect(stabilizeNarrative(false, 'GOON 1', 0)).toBe('Failed to stabilize GOON 1.')
  })
})
