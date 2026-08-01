import { describe, it, expect } from 'vitest'
import {
  getCumulativeAttributes,
  getCumulativeSkills,
  skillStepUp,
  skillStepDown,
  mergeWizardEdit,
  type StepData,
} from '../../lib/xse-engine'
import { createBlankCharacter } from '../../lib/xse-schema'

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

// 2026-08-01 audit: the classic character editor wrote buildCharacter()'s
// output straight to the `data` column. buildCharacter() starts from
// createBlankCharacter(), so any editable-in-play field it doesn't itself
// set (inventory, progression_log, lasting wounds, CDP, ...) silently
// reset to blank on every save. mergeWizardEdit() is the fix: only the
// wizard-owned fields move, everything else in the existing blob survives.
describe('mergeWizardEdit', () => {
  it('preserves untyped/runtime keys not known to the wizard', () => {
    const base = {
      name: 'Old Name',
      inventory: [{ name: 'Rusty Knife', qty: 1 }],
      progression_log: [{ note: 'Survived the Ashford raid' }],
      session_notes: 'GM owes me a favor',
      lastingWounds: ['Bad Knee'],
      relationships: [{ npc: 'Marta', cmod: 2 }],
      cdp: 7,
      insightDice: 1,
      stressLevel: 3,
      breakingPoint: 2,
    }
    const wizardChar = { ...createBlankCharacter(), name: 'New Name' }
    const merged = mergeWizardEdit(base, wizardChar)

    expect(merged.inventory).toEqual(base.inventory)
    expect(merged.progression_log).toEqual(base.progression_log)
    expect(merged.session_notes).toBe(base.session_notes)
    expect(merged.lastingWounds).toEqual(base.lastingWounds)
    expect(merged.relationships).toEqual(base.relationships)
    expect(merged.cdp).toBe(7)
    expect(merged.insightDice).toBe(1)
    expect(merged.stressLevel).toBe(3)
    expect(merged.breakingPoint).toBe(2)
  })

  it('overwrites wizard-owned fields with the freshly built character', () => {
    const base = { name: 'Old Name', age: '30', notes: 'old concept' }
    const wizardChar = { ...createBlankCharacter(), name: 'New Name', age: '31', notes: 'new concept' }
    const merged = mergeWizardEdit(base, wizardChar)

    expect(merged.name).toBe('New Name')
    expect(merged.age).toBe('31')
    expect(merged.notes).toBe('new concept')
  })

  it('starting from an empty base still produces a full wizard-owned field set', () => {
    const wizardChar = { ...createBlankCharacter(), name: 'Fresh Save' }
    const merged = mergeWizardEdit({}, wizardChar)

    expect(merged.name).toBe('Fresh Save')
    expect(merged.rapid).toEqual(wizardChar.rapid)
    expect(merged.skills).toEqual(wizardChar.skills)
  })
})
