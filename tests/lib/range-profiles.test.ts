import { describe, it, expect } from 'vitest'
import {
  getRangeBand,
  getWeaponRangeCMod,
  canHitAtRange,
  RANGE_BAND_MAX_FEET,
  RANGE_BAND_COLOR,
  type RangeBand,
} from '../../lib/range-profiles'

// Safety net for the roll engine's range math (table re-arch Step 1).
// These are the exact pure functions executeRoll + the auto-target picker
// rely on; locking them down before the useRollResolution extraction.

describe('getRangeBand - feet -> band thresholds', () => {
  it('maps boundary feet to the inclusive upper-bound band', () => {
    expect(getRangeBand(0)).toBe('engaged')
    expect(getRangeBand(5)).toBe('engaged')
    expect(getRangeBand(6)).toBe('close')
    expect(getRangeBand(30)).toBe('close')
    expect(getRangeBand(31)).toBe('medium')
    expect(getRangeBand(100)).toBe('medium')
    expect(getRangeBand(101)).toBe('long')
    expect(getRangeBand(300)).toBe('long')
    expect(getRangeBand(301)).toBe('distant')
    expect(getRangeBand(Infinity)).toBe('distant')
  })

  it('agrees with the RANGE_BAND_MAX_FEET table at each upper bound', () => {
    expect(getRangeBand(RANGE_BAND_MAX_FEET.engaged)).toBe('engaged')
    expect(getRangeBand(RANGE_BAND_MAX_FEET.close)).toBe('close')
    expect(getRangeBand(RANGE_BAND_MAX_FEET.medium)).toBe('medium')
    expect(getRangeBand(RANGE_BAND_MAX_FEET.long)).toBe('long')
  })
})

describe('getWeaponRangeCMod - per-profile CMod', () => {
  it('returns 0 (no penalty) for an unknown weapon at any band', () => {
    expect(getWeaponRangeCMod('Banana', 'engaged')).toBe(0)
    expect(getWeaponRangeCMod('Banana', 'distant')).toBe(0)
    expect(getWeaponRangeCMod('', 'medium')).toBe(0)
  })

  it('melee weapons hit only at engaged (null elsewhere)', () => {
    expect(getWeaponRangeCMod('Machete', 'engaged')).toBe(0)
    expect(getWeaponRangeCMod('Machete', 'close')).toBeNull()
    expect(getWeaponRangeCMod('Machete', 'medium')).toBeNull()
  })

  it('reach melee (Spear) hits engaged + close, null beyond', () => {
    expect(getWeaponRangeCMod('Spear', 'engaged')).toBe(0)
    expect(getWeaponRangeCMod('Spear', 'close')).toBe(0)
    expect(getWeaponRangeCMod('Spear', 'medium')).toBeNull()
  })

  it('light pistol degrades with range and is null at distant', () => {
    expect(getWeaponRangeCMod('Light Pistol', 'engaged')).toBe(-1)
    expect(getWeaponRangeCMod('Light Pistol', 'close')).toBe(0)
    expect(getWeaponRangeCMod('Light Pistol', 'medium')).toBe(-2)
    expect(getWeaponRangeCMod('Light Pistol', 'long')).toBe(-4)
    expect(getWeaponRangeCMod('Light Pistol', 'distant')).toBeNull()
  })

  it("sniper's rifle penalizes up close, rewards far", () => {
    expect(getWeaponRangeCMod("Sniper's Rifle", 'engaged')).toBe(-4)
    expect(getWeaponRangeCMod("Sniper's Rifle", 'long')).toBe(1)
    expect(getWeaponRangeCMod("Sniper's Rifle", 'distant')).toBe(1)
  })

  it('grenade cannot reach long range (null)', () => {
    expect(getWeaponRangeCMod('Grenade', 'engaged')).toBe(-1)
    expect(getWeaponRangeCMod('Grenade', 'close')).toBe(0)
    expect(getWeaponRangeCMod('Grenade', 'medium')).toBe(-2)
    expect(getWeaponRangeCMod('Grenade', 'long')).toBeNull()
  })

  it('rpg-class (Rocket Launcher) cannot fire at engaged (own feet)', () => {
    expect(getWeaponRangeCMod('Rocket Launcher', 'engaged')).toBeNull()
    expect(getWeaponRangeCMod('Rocket Launcher', 'close')).toBe(0)
    expect(getWeaponRangeCMod('Rocket Launcher', 'distant')).toBe(-2)
  })
})

describe('canHitAtRange - null band means cannot hit', () => {
  it('true where the profile has a number, false where null', () => {
    expect(canHitAtRange('Machete', 'engaged')).toBe(true)
    expect(canHitAtRange('Machete', 'close')).toBe(false)
    expect(canHitAtRange('Grenade', 'long')).toBe(false)
    expect(canHitAtRange('Rocket Launcher', 'engaged')).toBe(false)
    expect(canHitAtRange('Light Pistol', 'long')).toBe(true)
  })

  it('unknown weapon can hit anywhere (0 CMod, not null)', () => {
    expect(canHitAtRange('Banana', 'engaged')).toBe(true)
    expect(canHitAtRange('Banana', 'distant')).toBe(true)
  })
})

describe('lookup tables are complete', () => {
  const bands: RangeBand[] = ['engaged', 'close', 'medium', 'long', 'distant']
  it('every band has a max-feet threshold and a color', () => {
    for (const b of bands) {
      expect(RANGE_BAND_MAX_FEET[b]).toBeDefined()
      expect(typeof RANGE_BAND_COLOR[b]).toBe('string')
    }
  })
})
