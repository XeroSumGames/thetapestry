import { describe, it, expect } from 'vitest'
import { applyDamageTransition } from '../../lib/combat-damage'

// Mirrors the inline rules in useRollResolution.ts (PC + NPC damage branches):
// mortal on WP->0, incap on RP->0 (not also mortal), one Stress pip per entry,
// mortal preempts incap. Countdowns: death = max(1, 4+PHY), incap = max(1, 4-PHY).

const base = { wp_current: 10, rp_current: 6, stress: 1, phyMod: 1 }

describe('applyDamageTransition', () => {
  it('plain damage, no transition', () => {
    const t = applyDamageTransition(base, { wp: 3, rp: 2 })
    expect(t.newWP).toBe(7)
    expect(t.newRP).toBe(4)
    expect(t.becameMortal).toBe(false)
    expect(t.becameIncap).toBe(false)
    expect(t.newStress).toBe(1)
    expect(t.stressReason).toBeNull()
  })

  it('mortal wound when WP hits 0: +1 stress, death countdown = 4+PHY', () => {
    const t = applyDamageTransition(base, { wp: 10, rp: 0 })
    expect(t.newWP).toBe(0)
    expect(t.becameMortal).toBe(true)
    expect(t.deathCountdown).toBe(5) // 4 + 1
    expect(t.incapRounds).toBeNull()
    expect(t.newStress).toBe(2)
    expect(t.stressReason).toBe('Mortally Wounded')
  })

  it('death countdown floors at 1 for very negative PHY', () => {
    const t = applyDamageTransition({ ...base, phyMod: -10 }, { wp: 10, rp: 0 })
    expect(t.deathCountdown).toBe(1)
  })

  it('incap when RP hits 0 with WP remaining: +1 stress, incap rounds = 4-PHY', () => {
    const t = applyDamageTransition(base, { wp: 1, rp: 6 })
    expect(t.newWP).toBe(9)
    expect(t.newRP).toBe(0)
    expect(t.becameIncap).toBe(true)
    expect(t.incapRounds).toBe(3) // 4 - 1
    expect(t.deathCountdown).toBeNull()
    expect(t.newStress).toBe(2)
    expect(t.stressReason).toBe('Incapacitated')
  })

  it('incap rounds floor at 1 for high PHY', () => {
    const t = applyDamageTransition({ ...base, phyMod: 6 }, { wp: 1, rp: 6 })
    expect(t.incapRounds).toBe(1) // max(1, 4-6)
  })

  it('mortal preempts incap when both WP and RP hit 0 - only one pip', () => {
    const t = applyDamageTransition(base, { wp: 10, rp: 6 })
    expect(t.becameMortal).toBe(true)
    expect(t.becameIncap).toBe(false)
    expect(t.newStress).toBe(2) // single pip, not two
    expect(t.stressReason).toBe('Mortally Wounded')
  })

  it('no second pip / no re-trigger when already at 0', () => {
    const t = applyDamageTransition({ ...base, wp_current: 0, rp_current: 0 }, { wp: 5, rp: 5 })
    expect(t.becameMortal).toBe(false) // was already 0, not crossing now
    expect(t.becameIncap).toBe(false)
    expect(t.newStress).toBe(1)
  })

  it('caps Stress at 5', () => {
    const t = applyDamageTransition({ ...base, stress: 5 }, { wp: 10, rp: 0 })
    expect(t.newStress).toBe(5)
  })

  it('negative incoming damage never heals', () => {
    const t = applyDamageTransition(base, { wp: -3, rp: -2 })
    expect(t.newWP).toBe(10)
    expect(t.newRP).toBe(6)
  })

  it('Subdue shape: 1 WP + heavy RP drops a low-RP target to incap', () => {
    // Subdue = 1 WP + (1d3 + PHY + Unarmed) RP; here 5 RP onto a target at 4 RP.
    const t = applyDamageTransition({ wp_current: 8, rp_current: 4, stress: 0, phyMod: 2 }, { wp: 1, rp: 5 })
    expect(t.newWP).toBe(7)
    expect(t.newRP).toBe(0)
    expect(t.becameIncap).toBe(true)
    expect(t.incapRounds).toBe(2) // 4 - 2
    expect(t.stressReason).toBe('Incapacitated')
  })
})
