import { describe, it, expect } from 'vitest'
import {
  cellDistance,
  computeBlastSplash,
  mortalWoundCountdown,
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
