import { describe, it, expect } from 'vitest'
import { chooseUnjamSkill } from '../../lib/combat/unjam-skill'

describe('chooseUnjamSkill', () => {
  it('falls back to the ranged combat skill for a PC with no repair skills', () => {
    const r = chooseUnjamSkill(false, [], { DEX: 2 }, null)
    expect(r).toEqual({ skill: 'Ranged Combat', amod: 2, level: 0 })
  })

  it('falls back to melee combat for a melee weapon', () => {
    const r = chooseUnjamSkill(true, [], { PHY: 1 }, null)
    expect(r).toEqual({ skill: 'Melee Combat', amod: 1, level: 0 })
  })

  it('prefers Tinkerer when the PC has it at a higher level', () => {
    const skills = [
      { skillName: 'Ranged Combat', level: 2 },
      { skillName: 'Tinkerer', level: 3 },
    ]
    const r = chooseUnjamSkill(false, skills, { DEX: 1, PHY: 0 }, null)
    expect(r.skill).toBe('Tinkerer')
    expect(r.amod).toBe(1) // Tinkerer uses DEX
    expect(r.level).toBe(3)
  })

  it('does not switch off combat skill when Tinkerer/Weaponsmith are lower', () => {
    const skills = [
      { skillName: 'Ranged Combat', level: 4 },
      { skillName: 'Tinkerer', level: 1 },
    ]
    const r = chooseUnjamSkill(false, skills, { DEX: 2 }, null)
    expect(r.skill).toBe('Ranged Combat')
    expect(r.level).toBe(4)
  })

  it('reads NPC skills from skills.entries and RAPID from top-level attrs', () => {
    const npc = {
      skills: { entries: [{ name: 'Weaponsmith', level: 2 }] },
      reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 3,
    }
    const r = chooseUnjamSkill(false, null, null, npc)
    expect(r.skill).toBe('Weaponsmith')
    expect(r.amod).toBe(3) // Weaponsmith uses DEX -> npc.dexterity
    expect(r.level).toBe(2)
  })

  it('handles an NPC with no matching skills (combat skill, level 0)', () => {
    const npc = { skills: {}, physicality: 1 }
    const r = chooseUnjamSkill(true, null, null, npc)
    expect(r).toEqual({ skill: 'Melee Combat', amod: 1, level: 0 })
  })
})
