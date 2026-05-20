import { describe, it, expect } from 'vitest'
import { gutInstinctSmod, GUT_INSTINCT_SUB_SKILLS } from '../../lib/gut-instinct-helpers'

describe('GUT_INSTINCT_SUB_SKILLS', () => {
  it('lists the three canon sub-skills (Psychology / Streetwise / Tactics)', () => {
    expect(GUT_INSTINCT_SUB_SKILLS).toEqual(['Psychology', 'Streetwise', 'Tactics'])
  })
})

describe('gutInstinctSmod', () => {
  it('returns the highest level among the three sub-skills', () => {
    expect(gutInstinctSmod([
      { skillName: 'Psychology', level: 1 },
      { skillName: 'Streetwise', level: 3 },
      { skillName: 'Tactics', level: 2 },
    ])).toBe(3)
  })

  it('returns 0 when the character has none of the sub-skills', () => {
    expect(gutInstinctSmod([
      { skillName: 'Medicine', level: 4 },
      { skillName: 'Athletics', level: 2 },
    ])).toBe(0)
  })

  it('returns the single sub-skill level when only one is present', () => {
    expect(gutInstinctSmod([{ skillName: 'Tactics', level: 2 }])).toBe(2)
  })

  it('returns 0 on empty / null / non-array input (defensive)', () => {
    expect(gutInstinctSmod([])).toBe(0)
    expect(gutInstinctSmod(null)).toBe(0)
    expect(gutInstinctSmod(undefined)).toBe(0)
  })

  it('skips entries missing skillName or level fields', () => {
    expect(gutInstinctSmod([
      { skillName: 'Psychology' }, // no level - skip
      { level: 5 },                // no skillName - skip
      { skillName: 'Streetwise', level: 2 },
    ])).toBe(2)
  })

  it('ignores Tactics* (starred variant) - matches legacy literal-string check', () => {
    // Legacy code at page.tsx L3812-3815 used `subSkills.includes(s.skillName)`
    // with the exact strings ['Psychology', 'Streetwise', 'Tactics']. Starred
    // variants don't qualify. Pin that behavior here.
    expect(gutInstinctSmod([
      { skillName: 'Tactics*', level: 5 },
    ])).toBe(0)
  })

  it('treats 0-level sub-skills as 0 (not "absent" - same outcome)', () => {
    expect(gutInstinctSmod([
      { skillName: 'Psychology', level: 0 },
    ])).toBe(0)
  })
})
