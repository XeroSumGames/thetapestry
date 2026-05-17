import { describe, it, expect } from 'vitest'
import { skillRaiseCost, skillNextLevel, rapidRaiseCost, isLv4Step } from '../../lib/cdp-costs'

// Canon source: SRD §07, mirrored at lib/cdp-costs.ts comments.
// Skill cost ladder: Learn = 1 CDP; raise N -> N+1 = 2N+1 CDP.
// RAPID cost: raise N -> N+1 = 3 * (N+1) CDP.

describe('skillRaiseCost', () => {
  it('returns null when current is already at Lv 4 (Life\'s Work cap)', () => {
    expect(skillRaiseCost(4)).toBeNull()
  })

  it('returns 1 CDP to learn from vocational baseline -3', () => {
    expect(skillRaiseCost(-3)).toBe(1)
  })

  it('returns 1 CDP to learn from non-vocational baseline 0', () => {
    expect(skillRaiseCost(0)).toBe(1)
  })

  it('returns 3 CDP for 1 -> 2 (Beginner to Journeyman)', () => {
    expect(skillRaiseCost(1)).toBe(3)
  })

  it('returns 5 CDP for 2 -> 3 (Journeyman to Professional)', () => {
    expect(skillRaiseCost(2)).toBe(5)
  })

  it('returns 7 CDP for 3 -> 4 (Professional to Life\'s Work)', () => {
    expect(skillRaiseCost(3)).toBe(7)
  })
})

describe('skillNextLevel', () => {
  it('returns null when current is at Lv 4 (cap)', () => {
    expect(skillNextLevel(4)).toBeNull()
  })

  it('jumps from -3 (Inept) directly to 1 (Beginner) on first learn', () => {
    expect(skillNextLevel(-3)).toBe(1)
  })

  it('jumps from 0 (Untrained) to 1 (Beginner) on first learn', () => {
    expect(skillNextLevel(0)).toBe(1)
  })

  it('increments by 1 from positive levels', () => {
    expect(skillNextLevel(1)).toBe(2)
    expect(skillNextLevel(2)).toBe(3)
    expect(skillNextLevel(3)).toBe(4)
  })
})

describe('rapidRaiseCost', () => {
  it('returns null when current is at 4 (Human Peak cap)', () => {
    expect(rapidRaiseCost(4)).toBeNull()
  })

  it('returns 3 CDP for 0 -> 1', () => {
    expect(rapidRaiseCost(0)).toBe(3)
  })

  it('returns 6 CDP for 1 -> 2', () => {
    expect(rapidRaiseCost(1)).toBe(6)
  })

  it('returns 9 CDP for 2 -> 3', () => {
    expect(rapidRaiseCost(2)).toBe(9)
  })

  it('returns 12 CDP for 3 -> 4 (the Lv 4 gate)', () => {
    expect(rapidRaiseCost(3)).toBe(12)
  })
})

describe('isLv4Step', () => {
  it('returns true only when stepping from 3 to 4', () => {
    expect(isLv4Step(3)).toBe(true)
  })

  it('returns false at all other current levels', () => {
    expect(isLv4Step(-3)).toBe(false)
    expect(isLv4Step(0)).toBe(false)
    expect(isLv4Step(1)).toBe(false)
    expect(isLv4Step(2)).toBe(false)
    expect(isLv4Step(4)).toBe(false)
  })
})
