import { describe, it, expect } from 'vitest'
import { weaponCausesWoundInfection } from '../../lib/weapons'

describe('weaponCausesWoundInfection', () => {
  it('returns false for unarmed strikes', () => {
    expect(weaponCausesWoundInfection('Unarmed')).toBe(false)
  })

  it('returns false for blunt melee (no open wound)', () => {
    expect(weaponCausesWoundInfection('Baseball Bat')).toBe(false)
    expect(weaponCausesWoundInfection('Club')).toBe(false)
    expect(weaponCausesWoundInfection('Brass Knuckles')).toBe(false)
    expect(weaponCausesWoundInfection('Sledgehammer')).toBe(false)
    expect(weaponCausesWoundInfection('Tactical Baton')).toBe(false)
  })

  it('returns true for bladed melee (cut)', () => {
    expect(weaponCausesWoundInfection('Hunting Knife')).toBe(true)
    expect(weaponCausesWoundInfection('Machete')).toBe(true)
    expect(weaponCausesWoundInfection('Sword')).toBe(true)
    expect(weaponCausesWoundInfection('Fire Axe')).toBe(true)
  })

  it('returns true for ranged / explosive / heavy (shot, shrapnel, burn)', () => {
    expect(weaponCausesWoundInfection('Light Pistol')).toBe(true)
    expect(weaponCausesWoundInfection('Bow')).toBe(true)
    expect(weaponCausesWoundInfection('Grenade')).toBe(true)
    expect(weaponCausesWoundInfection('Flame-Thrower')).toBe(true)
  })

  it('returns false for null / undefined / empty', () => {
    expect(weaponCausesWoundInfection(null)).toBe(false)
    expect(weaponCausesWoundInfection(undefined)).toBe(false)
    expect(weaponCausesWoundInfection('')).toBe(false)
  })

  it('defaults unknown / custom weapons to true (assume open wound)', () => {
    expect(weaponCausesWoundInfection('Homebrew Vorpal Blade')).toBe(true)
  })
})
