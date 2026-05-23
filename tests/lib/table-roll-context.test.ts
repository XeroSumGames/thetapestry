import { describe, it, expect } from 'vitest'
import {
  cellDistance,
  computeBlastSplash,
  mortalWoundCountdown,
  buildCmodBreakdown,
} from '../../lib/table-roll-context'

describe('cellDistance - Chebyshev grid distance', () => {
  it('is 0 for the same cell', () => {
    expect(cellDistance(3, 3, 3, 3)).toBe(0)
  })
  it('orthogonal distance is the axis delta', () => {
    expect(cellDistance(0, 0, 4, 0)).toBe(4)
    expect(cellDistance(0, 0, 0, 7)).toBe(7)
  })
  it('diagonal distance is the MAX of the two deltas (king move)', () => {
    expect(cellDistance(0, 0, 3, 3)).toBe(3)
    expect(cellDistance(0, 0, 5, 2)).toBe(5)
  })
  it('is symmetric and handles negative coords', () => {
    expect(cellDistance(5, 5, 1, 2)).toBe(cellDistance(1, 2, 5, 5))
    expect(cellDistance(-2, -2, 1, 1)).toBe(3)
  })
})

describe('computeBlastSplash - radius bands + scaled damage', () => {
  // cellFeet = 5 (the canonical map scale); rawWP 10 / rawRP 4.
  it('full damage at the center cell (Engaged)', () => {
    const s = computeBlastSplash(0, 0, 0, 0, 5, 10, 4)
    expect(s).not.toBeNull()
    expect(s!.band).toBe('Engaged')
    expect(s!.scale).toBe(1.0)
    expect(s!.splashWP).toBe(10)
    expect(s!.splashRP).toBe(4)
  })

  it('5 ft is still Engaged (full)', () => {
    const s = computeBlastSplash(1, 0, 0, 0, 5, 10, 4)
    expect(s!.feet).toBe(5)
    expect(s!.band).toBe('Engaged')
    expect(s!.splashWP).toBe(10)
  })

  it('past Engaged but within 30 ft is Close (half, floored)', () => {
    const s = computeBlastSplash(2, 0, 0, 0, 5, 10, 4) // 10 ft
    expect(s!.band).toBe('Close')
    expect(s!.scale).toBe(0.5)
    expect(s!.splashWP).toBe(5) // floor(10 * 0.5)
    expect(s!.splashRP).toBe(2) // floor(4 * 0.5)
  })

  it('30 ft is the Close boundary (still in radius)', () => {
    const s = computeBlastSplash(6, 0, 0, 0, 5, 10, 4) // 30 ft
    expect(s).not.toBeNull()
    expect(s!.band).toBe('Close')
  })

  it('beyond 30 ft is out of radius (null)', () => {
    expect(computeBlastSplash(7, 0, 0, 0, 5, 10, 4)).toBeNull() // 35 ft
  })

  it('diagonal distance uses Chebyshev (2,2 = 10 ft at scale 5)', () => {
    const s = computeBlastSplash(2, 2, 0, 0, 5, 10, 4)
    expect(s!.feet).toBe(10)
    expect(s!.band).toBe('Close')
  })

  it('WP floors at 1 for anyone caught in radius; RP floors at 0', () => {
    const s = computeBlastSplash(2, 0, 0, 0, 5, 1, 1) // close, raw 1/1
    expect(s!.splashWP).toBe(1) // max(1, floor(0.5))
    expect(s!.splashRP).toBe(0) // max(0, floor(0.5))
  })
})

describe('mortalWoundCountdown - 4 + PHY, floored at 1', () => {
  it('baseline PHY 0 = 4 rounds', () => {
    expect(mortalWoundCountdown(0)).toBe(4)
  })
  it('positive PHY raises the countdown', () => {
    expect(mortalWoundCountdown(2)).toBe(6)
  })
  it('negative PHY never drops below 1 round', () => {
    expect(mortalWoundCountdown(-3)).toBe(1)
    expect(mortalWoundCountdown(-5)).toBe(1)
  })
})

describe('buildCmodBreakdown - source-labeled CMod terms', () => {
  it('empty input yields no terms and a 0 total', () => {
    const b = buildCmodBreakdown({})
    expect(b.terms).toEqual([])
    expect(b.total).toBe(0)
  })

  it('drops zero-valued sources', () => {
    const b = buildCmodBreakdown({ aim: 0, range: 0, sameTarget: 0 })
    expect(b.terms).toEqual([])
    expect(b.total).toBe(0)
  })

  it('keeps each non-zero source as its own signed term', () => {
    const b = buildCmodBreakdown({ aim: 2, range: -4, sameTarget: 1 })
    expect(b.terms).toEqual([
      { label: 'Aim', value: 2 },
      { label: 'Same target CMod', value: 1 },
      { label: 'Range CMod', value: -4 },
    ])
    expect(b.total).toBe(-1)
  })

  it('Aim stays a positive term even when target defense pushes the net negative (Xero ruling)', () => {
    // The whole point: Aim must never be silently netted away by defense.
    const b = buildCmodBreakdown({ aim: 2, targetDefense: -4, targetDefenseLabel: 'Target RDM' })
    expect(b.terms).toContainEqual({ label: 'Aim', value: 2 })
    expect(b.terms).toContainEqual({ label: 'Target RDM', value: -4 })
    expect(b.total).toBe(-2)
  })

  it('uses the supplied target-defense label (MDM melee / RDM ranged), defaulting when absent', () => {
    expect(buildCmodBreakdown({ targetDefense: -2, targetDefenseLabel: 'Target MDM' }).terms)
      .toEqual([{ label: 'Target MDM', value: -2 }])
    expect(buildCmodBreakdown({ targetDefense: -2 }).terms)
      .toEqual([{ label: 'Target defense', value: -2 }])
  })

  it('preserves a fixed display order regardless of input key order', () => {
    const b = buildCmodBreakdown({ insight: 3, weaponCondition: -1, aim: 2 })
    expect(b.terms.map(t => t.label)).toEqual(['Weapon CMod', 'Aim', 'Insight CMod'])
  })

  it('total always equals the sum of kept terms', () => {
    const b = buildCmodBreakdown({
      weaponCondition: -1, aim: 2, coordinate: 2, coordinatedEffort: 1,
      sameTarget: 1, targetDefense: -2, range: -4, sick: -2, insight: 3, manual: 1,
    })
    expect(b.total).toBe(b.terms.reduce((s, t) => s + t.value, 0))
    expect(b.total).toBe(1)
  })

  it('keeps a manual GM adjustment as its own CMod term', () => {
    const b = buildCmodBreakdown({ aim: 2, manual: -1 })
    expect(b.terms).toContainEqual({ label: 'CMod', value: -1 })
    expect(b.total).toBe(1)
  })
})
