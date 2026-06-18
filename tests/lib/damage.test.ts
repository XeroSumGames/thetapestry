import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateDamage, rollDamage } from '../../lib/damage'

// calculateDamage embeds a console.warn([playtest-trace]) for diagnostic
// purposes. Silence it for the test run so the suite output stays clean.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('calculateDamage', () => {
  it('subtracts defensive modifier from raw WP, floors at 0', () => {
    expect(calculateDamage(5, 50, 2)).toEqual({ finalWP: 3, finalRP: 1, mitigated: 2 })
  })

  it('clamps finalWP at 0 when defensive modifier exceeds raw WP', () => {
    expect(calculateDamage(2, 50, 10).finalWP).toBe(0)
  })

  it('treats negative defensive modifier as 0 (cannot heal damage via DM)', () => {
    const result = calculateDamage(5, 50, -3)
    expect(result.mitigated).toBe(0)
    expect(result.finalWP).toBe(5)
  })

  it('RP is rpPercent of finalWP by default', () => {
    // 10 WP * 50% = 5 RP
    expect(calculateDamage(10, 50, 0).finalRP).toBe(5)
    // 10 WP * 25% = 2.5 → floors to 2
    expect(calculateDamage(10, 25, 0).finalRP).toBe(2)
  })

  it('honors rpFromRaw=true to compute RP from RAW WP (Stun-tagged weapons)', () => {
    // Canon: Taser deals 1 WP / 6 RP from raw. Even when armor mitigates
    // the WP, the stun impact still rocks the body. rpFromRaw bypasses
    // mitigation for the RP calc.
    // Raw 1 WP * 600% = 6 RP (mitigation should NOT reduce this).
    const result = calculateDamage(1, 600, 2, { rpFromRaw: true })
    expect(result.finalWP).toBe(0)  // mitigated below zero
    expect(result.finalRP).toBe(6)  // computed from raw 1, not from final 0
  })

  it('cattle prod deals fixed 2 RP regardless of defensive modifier', () => {
    // Canon: Cattle Prod 1 WP base, rpPercent 200, always zeroed to 0 WP by isStun.
    // rpFromRaw=true ensures armor does not reduce the RP.
    // Raw 1 WP * 200% = 2 RP.
    const result = calculateDamage(1, 200, 3, { rpFromRaw: true })
    expect(result.finalWP).toBe(0)  // fully mitigated
    expect(result.finalRP).toBe(2)  // from raw WP, not mitigated
  })

  it('stun gun deals fixed 4 RP regardless of defensive modifier', () => {
    // Canon: Stun Gun 1 WP base, rpPercent 400, always zeroed to 0 WP by isStun.
    const result = calculateDamage(1, 400, 3, { rpFromRaw: true })
    expect(result.finalWP).toBe(0)
    expect(result.finalRP).toBe(4)
  })

  it('stacks armor DM additively with defensive modifier', () => {
    const armor = [{ dm: 2 }, { dm: 1 }]
    const result = calculateDamage(10, 50, 2, { armor })
    expect(result.mitigated).toBe(5)  // 2 + 2 + 1
    expect(result.finalWP).toBe(5)
  })

  it('ignores reactive_melee_only armor against ranged attacks (Riot Shield vs gun)', () => {
    const armor = [{ dm: 3, reactive_melee_only: true }]
    const result = calculateDamage(10, 50, 0, { armor, attackerCategory: 'ranged' })
    expect(result.mitigated).toBe(0)  // shield doesn't apply
    expect(result.finalWP).toBe(10)
  })

  it('applies reactive_melee_only armor against melee attacks', () => {
    const armor = [{ dm: 3, reactive_melee_only: true }]
    const result = calculateDamage(10, 50, 0, { armor, attackerCategory: 'melee' })
    expect(result.mitigated).toBe(3)
    expect(result.finalWP).toBe(7)
  })

  it('applies reactive_melee_only armor against unarmed attacks too', () => {
    const armor = [{ dm: 3, reactive_melee_only: true }]
    const result = calculateDamage(10, 50, 0, { armor, attackerCategory: 'unarmed' })
    expect(result.mitigated).toBe(3)
  })

  it('treats negative armor DM as 0 (no negative armor protection)', () => {
    const armor = [{ dm: -2 }]
    const result = calculateDamage(10, 50, 0, { armor })
    expect(result.mitigated).toBe(0)
  })

  // wpPercent (Subdue non-lethal) - canon: full RP, 50% WP. Default 100
  // is lethal and matches every existing call site.
  it('wpPercent halves finalWP for non-lethal Subdue', () => {
    // raw 10, DM 2 -> woundedWP 8. wpPercent 50 -> finalWP 4. RP is still
    // 100% of woundedWP (not finalWP), so finalRP 8.
    const result = calculateDamage(10, 100, 2, { wpPercent: 50 })
    expect(result.finalWP).toBe(4)
    expect(result.finalRP).toBe(8)
    expect(result.mitigated).toBe(2)
  })

  it('wpPercent default of 100 (or undefined) preserves lethal canon', () => {
    expect(calculateDamage(10, 100, 2).finalWP).toBe(8)
    expect(calculateDamage(10, 100, 2, {}).finalWP).toBe(8)
    expect(calculateDamage(10, 100, 2, { wpPercent: 100 }).finalWP).toBe(8)
  })

  it('wpPercent floors odd-WP cases (5 -> floor(5*0.5) = 2)', () => {
    // raw 7, DM 2 -> woundedWP 5. wpPercent 50 -> floor(2.5) = 2.
    expect(calculateDamage(7, 100, 2, { wpPercent: 50 }).finalWP).toBe(2)
  })

  it('wpPercent does NOT reduce RP - canon says full RP, 50% WP', () => {
    // Subdue against a target with 0 DM: raw 6, woundedWP 6.
    // wpPercent 50 -> finalWP 3. rpPercent 100 -> finalRP 6.
    const result = calculateDamage(6, 100, 0, { wpPercent: 50 })
    expect(result.finalWP).toBe(3)
    expect(result.finalRP).toBe(6)
  })

  it('wpPercent + rpFromRaw (Stun-flavored Subdue, hypothetical)', () => {
    // raw 8, DM 2 -> woundedWP 6. wpPercent 50 -> finalWP 3.
    // rpFromRaw + rpPercent 100 -> finalRP = floor(8 * 1.0) = 8.
    const result = calculateDamage(8, 100, 2, { wpPercent: 50, rpFromRaw: true })
    expect(result.finalWP).toBe(3)
    expect(result.finalRP).toBe(8)
  })

  it('wpPercent stacks with armor mitigation', () => {
    // raw 12, DM 2 + armor 3 = mitigated 5 -> woundedWP 7.
    // wpPercent 50 -> finalWP 3. RP = floor(7 * 1.0) = 7.
    const result = calculateDamage(12, 100, 2, { wpPercent: 50, armor: [{ dm: 3 }] })
    expect(result.finalWP).toBe(3)
    expect(result.finalRP).toBe(7)
    expect(result.mitigated).toBe(5)
  })
})

describe('rollDamage', () => {
  it('parses a plain integer "2" as base damage with no dice', () => {
    const result = rollDamage('2')
    expect(result.base).toBe(2)
    expect(result.diceRoll).toBe(0)
    expect(result.diceDesc).toBe('')
    expect(result.totalWP).toBe(2)
  })

  it('parses "+1" as base 1 (Brass Knuckles shape)', () => {
    const result = rollDamage('+1')
    expect(result.base).toBe(1)
    expect(result.diceRoll).toBe(0)
    expect(result.totalWP).toBe(1)
  })

  it('parses "5+2d6" and rolls 2d6 (verifies parse, not the random value)', () => {
    const result = rollDamage('5+2d6')
    expect(result.base).toBe(5)
    expect(result.diceDesc).toBe('2d6')
    // diceRoll is 2-12 inclusive; verify it landed in range
    expect(result.diceRoll).toBeGreaterThanOrEqual(2)
    expect(result.diceRoll).toBeLessThanOrEqual(12)
    expect(result.totalWP).toBe(5 + result.diceRoll)
  })

  it('adds PHY AMod only when isMelee=true', () => {
    const ranged = rollDamage('3', 2, false)
    expect(ranged.phyBonus).toBe(0)
    expect(ranged.totalWP).toBe(3)

    const melee = rollDamage('3', 2, true)
    expect(melee.phyBonus).toBe(2)
    expect(melee.totalWP).toBe(5)
  })

  it('parses dice-only format "1d3" without a base', () => {
    const result = rollDamage('1d3')
    expect(result.base).toBe(0)
    expect(result.diceDesc).toBe('1d3')
    expect(result.diceRoll).toBeGreaterThanOrEqual(1)
    expect(result.diceRoll).toBeLessThanOrEqual(3)
  })
})
