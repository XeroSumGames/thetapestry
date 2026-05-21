import { describe, it, expect } from 'vitest'
import { computeEncumbrance, BASE_ENC_LIMIT, type EncumbranceItem } from '../../lib/encumbrance'

// XSE rule: ENC limit = 6 + PHY + Pack(2 if Backpack/Military Backpack).
// Current load = sum of held weapon enc + sum of inventory enc * qty.

const NO_WEAPONS = ['', ''] as const  // empty string -> getWeaponByName undefined -> 0 enc

describe('computeEncumbrance', () => {
  it('returns the base limit (6) with no PHY mod, no backpack', () => {
    const result = computeEncumbrance([], NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(result.encLimit).toBe(BASE_ENC_LIMIT)
    expect(result.currentEnc).toBe(0)
    expect(result.overloaded).toBe(false)
    expect(result.hasBackpack).toBe(false)
    expect(result.backpackBonus).toBe(0)
  })

  it('adds PHY mod to the limit', () => {
    const result = computeEncumbrance([], NO_WEAPONS[0], NO_WEAPONS[1], 2)
    expect(result.encLimit).toBe(8) // 6 + 2 PHY
  })

  it('subtracts negative PHY mod (Diminished/Weak characters carry less)', () => {
    const result = computeEncumbrance([], NO_WEAPONS[0], NO_WEAPONS[1], -2)
    expect(result.encLimit).toBe(4) // 6 - 2
  })

  it('adds +2 backpack bonus when a Backpack is in inventory', () => {
    const inv: EncumbranceItem[] = [{ name: 'Backpack', enc: 0, qty: 1 }]
    const result = computeEncumbrance(inv, NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(result.hasBackpack).toBe(true)
    expect(result.backpackBonus).toBe(2)
    expect(result.encLimit).toBe(8) // 6 + 2 backpack
  })

  it('recognizes Military Backpack as backpack-equivalent', () => {
    const inv: EncumbranceItem[] = [{ name: 'Military Backpack', enc: 0, qty: 1 }]
    const result = computeEncumbrance(inv, NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(result.hasBackpack).toBe(true)
  })

  it('multiplies inventory enc by qty', () => {
    const inv: EncumbranceItem[] = [{ name: 'Canned Food', enc: 1, qty: 5 }]
    const result = computeEncumbrance(inv, NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(result.invEnc).toBe(5)
    expect(result.currentEnc).toBe(5)
  })

  it('treats missing qty as 1', () => {
    const inv: EncumbranceItem[] = [{ name: 'Mystery Item', enc: 3, qty: undefined as unknown as number }]
    const result = computeEncumbrance(inv, NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(result.invEnc).toBe(3)
  })

  it('sets overloaded=true when currentEnc exceeds encLimit', () => {
    const inv: EncumbranceItem[] = [{ name: 'Heavy Crate', enc: 10, qty: 1 }]
    const result = computeEncumbrance(inv, NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(result.currentEnc).toBe(10)
    expect(result.encLimit).toBe(6)
    expect(result.overloaded).toBe(true)
  })

  it('sets overloaded=false when current equals limit (exactly at cap)', () => {
    const inv: EncumbranceItem[] = [{ name: 'Stuff', enc: 6, qty: 1 }]
    const result = computeEncumbrance(inv, NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(result.currentEnc).toBe(6)
    expect(result.encLimit).toBe(6)
    expect(result.overloaded).toBe(false) // strict greater-than for overload
  })

  // overBy: points over the limit. Canon (restored 2026-05-20) - the
  // RP-drain-per-hour is 1 PER POINT over, so overBy is the multiplier
  // the Advance Time tick uses.
  it('overBy = 0 when at or under the limit', () => {
    const under = computeEncumbrance([{ name: 'Stuff', enc: 4, qty: 1 }], NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(under.overBy).toBe(0)
    const exact = computeEncumbrance([{ name: 'Stuff', enc: 6, qty: 1 }], NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(exact.overBy).toBe(0) // at cap = not over
  })

  it('overBy = points over the limit when overloaded', () => {
    const result = computeEncumbrance([{ name: 'Heavy Crate', enc: 10, qty: 1 }], NO_WEAPONS[0], NO_WEAPONS[1], 0)
    expect(result.currentEnc).toBe(10)
    expect(result.encLimit).toBe(6)
    expect(result.overBy).toBe(4) // 10 - 6
  })

  it('overBy tracks the limit (PHY + backpack raise it, shrinking overBy)', () => {
    // Same 10-enc load, but PHY 2 + backpack push the limit to 10 -> not over.
    const inv: EncumbranceItem[] = [{ name: 'Backpack', enc: 0, qty: 1 }, { name: 'Load', enc: 10, qty: 1 }]
    const result = computeEncumbrance(inv, NO_WEAPONS[0], NO_WEAPONS[1], 2)
    expect(result.encLimit).toBe(10) // 6 + 2 PHY + 2 backpack
    expect(result.currentEnc).toBe(10)
    expect(result.overloaded).toBe(false)
    expect(result.overBy).toBe(0)
  })

  it('combines all sources: PHY mod + backpack + weapons + qty inventory', () => {
    const inv: EncumbranceItem[] = [
      { name: 'Backpack', enc: 0, qty: 1 },
      { name: 'Rations', enc: 1, qty: 3 },
      { name: 'Rope', enc: 2, qty: 1 },
    ]
    const result = computeEncumbrance(inv, NO_WEAPONS[0], NO_WEAPONS[1], 1)
    expect(result.encLimit).toBe(9)  // 6 + 1 PHY + 2 backpack
    expect(result.invEnc).toBe(5)    // 0 + 3 + 2
    expect(result.currentEnc).toBe(5)
    expect(result.overloaded).toBe(false)
  })
})
