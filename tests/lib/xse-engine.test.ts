import { describe, it, expect } from 'vitest'
import {
  getCumulativeAttributes,
  getCumulativeSkills,
  skillStepUp,
  skillStepDown,
  type StepData,
} from '../../lib/xse-engine'

// Backstory wizard math: each step accumulates attribute and skill
// deltas. Caps locked: attributes max at 4 (Human Peak), skills max at
// 4 (Life's Work). Vocational skills baseline -3 (Inept).

describe('getCumulativeAttributes', () => {
  it('returns all zeros for empty stepData', () => {
    expect(getCumulativeAttributes([])).toEqual({ RSN: 0, ACU: 0, PHY: 0, INF: 0, DEX: 0 })
  })

  it('adds +1 per attrKey across steps', () => {
    const steps: StepData[] = [{ attrKey: 'PHY' }, { attrKey: 'PHY' }, { attrKey: 'DEX' }]
    expect(getCumulativeAttributes(steps)).toEqual({ RSN: 0, ACU: 0, PHY: 2, INF: 0, DEX: 1 })
  })

  it('adds attrSpent values on top of attrKey bumps', () => {
    const steps: StepData[] = [{ attrKey: 'RSN', attrSpent: { ACU: 1, DEX: 1 } }]
    expect(getCumulativeAttributes(steps)).toEqual({ RSN: 1, ACU: 1, PHY: 0, INF: 0, DEX: 1 })
  })

  it('caps any attribute at 4 (Human Peak) even with excess buys', () => {
    const steps: StepData[] = [
      { attrKey: 'PHY' }, { attrKey: 'PHY' }, { attrKey: 'PHY' }, { attrKey: 'PHY' }, { attrKey: 'PHY' },
    ]
    expect(getCumulativeAttributes(steps).PHY).toBe(4)
  })

  it('caps attrSpent overflow at 4 too', () => {
    const steps: StepData[] = [{ attrSpent: { INF: 10 } }]
    expect(getCumulativeAttributes(steps).INF).toBe(4)
  })
})

describe('getCumulativeSkills', () => {
  it('returns baseline values for empty stepData (0 for non-vocational, -3 for vocational)', () => {
    const result = getCumulativeSkills([])
    // Non-vocational sample
    expect(result['Athletics']).toBe(0)
    expect(result['Manipulation']).toBe(0)
    // Vocational sample (* skills)
    expect(result['Medicine*']).toBe(-3)
    expect(result['Mechanic*']).toBe(-3)
    expect(result['Demolitions*']).toBe(-3)
  })

  it('applies skill deltas on top of baselines', () => {
    const steps: StepData[] = [
      { skillDeltas: { 'Athletics': 2, 'Medicine*': 4 } },  // raises Medicine from -3
    ]
    const result = getCumulativeSkills(steps)
    expect(result['Athletics']).toBe(2)
    expect(result['Medicine*']).toBe(1) // -3 + 4 = 1
  })

  it('caps skills at 4 (Life\'s Work) even with excess deltas', () => {
    const steps: StepData[] = [{ skillDeltas: { 'Athletics': 10 } }]
    expect(getCumulativeSkills(steps)['Athletics']).toBe(4)
  })

  it('sums deltas across multiple steps', () => {
    const steps: StepData[] = [
      { skillDeltas: { 'Stealth': 1 } },
      { skillDeltas: { 'Stealth': 2 } },
    ]
    expect(getCumulativeSkills(steps)['Stealth']).toBe(3)
  })
})

describe('skillStepUp', () => {
  it('jumps vocational -3 directly to 1 (skips 0)', () => {
    expect(skillStepUp(-3, true)).toBe(1)
  })

  it('non-vocational -3 → 0 (no skip)', () => {
    expect(skillStepUp(-3, false)).toBe(0)
  })

  it('normal increments through the ladder', () => {
    expect(skillStepUp(0, false)).toBe(1)
    expect(skillStepUp(1, false)).toBe(2)
    expect(skillStepUp(2, false)).toBe(3)
    expect(skillStepUp(3, false)).toBe(4)
  })

  it('stays at 4 (cap)', () => {
    expect(skillStepUp(4, false)).toBe(4)
    expect(skillStepUp(4, true)).toBe(4)
  })
})

describe('skillStepDown', () => {
  it('mirrors the vocational jump: 1 → -3 when base is -3', () => {
    expect(skillStepDown(1, -3, true)).toBe(-3)
  })

  it('non-vocational 1 → 0 (normal decrement)', () => {
    expect(skillStepDown(1, 0, false)).toBe(0)
  })

  it('decrements through the ladder', () => {
    expect(skillStepDown(4, 0, false)).toBe(3)
    expect(skillStepDown(3, 0, false)).toBe(2)
    expect(skillStepDown(2, 0, false)).toBe(1)
  })

  it('floors at the base value (cannot un-step below where you started)', () => {
    expect(skillStepDown(0, 0, false)).toBe(0)
    expect(skillStepDown(-3, -3, true)).toBe(-3)
  })

  it('respects base even when current would otherwise go lower', () => {
    // If base is 2 (Profession-floored skill), can't drop below 2.
    expect(skillStepDown(2, 2, false)).toBe(2)
  })
})
