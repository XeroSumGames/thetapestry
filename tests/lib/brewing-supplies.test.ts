import { describe, it, expect } from 'vitest'
import {
  effectiveBrewingMax, currentBrewingSupplies,
  canBrew, canGatherMaterials,
  gatherMaterials, consumeBrewingSupplies,
} from '../../lib/brewing-supplies'

type V = {
  brewing_supplies_current?: number
  brewing_supplies_max?: number
}

const minnie = (cur: number, max: number = 2): V => ({
  brewing_supplies_current: cur,
  brewing_supplies_max: max,
})

describe('brewing-supplies helpers', () => {
  describe('effective accessors', () => {
    it('effectiveBrewingMax = 0 when not set', () => {
      expect(effectiveBrewingMax({})).toBe(0)
    })
    it('currentBrewingSupplies = 0 when not set', () => {
      expect(currentBrewingSupplies({})).toBe(0)
    })
    it('returns the set values when present', () => {
      expect(effectiveBrewingMax(minnie(1, 5))).toBe(5)
      expect(currentBrewingSupplies(minnie(3))).toBe(3)
    })
  })

  describe('canBrew', () => {
    it('false when no supplies', () => {
      expect(canBrew(minnie(0))).toBe(false)
    })
    it('true with at least 1 day', () => {
      expect(canBrew(minnie(1))).toBe(true)
      expect(canBrew(minnie(2))).toBe(true)
    })
    it('false when vehicle has no stockpile field at all', () => {
      expect(canBrew({})).toBe(false)
    })
  })

  describe('canGatherMaterials', () => {
    it('false when feature disabled', () => {
      expect(canGatherMaterials({})).toBe(false)
    })
    it('false when at the cap', () => {
      expect(canGatherMaterials(minnie(2, 2))).toBe(false)
    })
    it('true when room remains', () => {
      expect(canGatherMaterials(minnie(0))).toBe(true)
      expect(canGatherMaterials(minnie(1))).toBe(true)
    })
  })

  describe('gatherMaterials', () => {
    it('errors when feature disabled', () => {
      const r = gatherMaterials({})
      expect(r.error).toMatch(/no brewing-materials stockpile/i)
      expect(r.vehicle).toBeNull()
    })

    it('errors at the cap', () => {
      const r = gatherMaterials(minnie(2, 2))
      expect(r.error).toMatch(/cap/i)
    })

    it('bumps current by 1 on success', () => {
      const r = gatherMaterials(minnie(0))
      expect(r.error).toBeNull()
      expect(r.vehicle!.brewing_supplies_current).toBe(1)
    })

    it('fills the stockpile when called repeatedly', () => {
      let v: V = minnie(0)
      v = gatherMaterials(v).vehicle!
      v = gatherMaterials(v).vehicle!
      expect(v.brewing_supplies_current).toBe(2)
      // Next gather should now fail (at cap)
      expect(gatherMaterials(v).error).toMatch(/cap/i)
    })

    it('does not mutate the input', () => {
      const v = minnie(1)
      const before = JSON.stringify(v)
      gatherMaterials(v)
      expect(JSON.stringify(v)).toBe(before)
    })
  })

  describe('consumeBrewingSupplies', () => {
    it('errors when nothing to consume', () => {
      const r = consumeBrewingSupplies(minnie(0))
      expect(r.error).toMatch(/no brewing materials/i)
      expect(r.vehicle).toBeNull()
    })

    it('decrements current by 1 on success', () => {
      const r = consumeBrewingSupplies(minnie(2))
      expect(r.error).toBeNull()
      expect(r.vehicle!.brewing_supplies_current).toBe(1)
    })

    it('takes current to 0 from 1 (and blocks the next brew)', () => {
      const r = consumeBrewingSupplies(minnie(1))
      expect(r.vehicle!.brewing_supplies_current).toBe(0)
      expect(canBrew(r.vehicle!)).toBe(false)
    })

    it('does not mutate the input', () => {
      const v = minnie(2)
      const before = JSON.stringify(v)
      consumeBrewingSupplies(v)
      expect(JSON.stringify(v)).toBe(before)
    })
  })

  describe('full gather/brew cycle (Q4-d scenario)', () => {
    it('gather x2 → brew x2 takes Minnie from 0 → 2 → 1 → 0 (and the 3rd brew is blocked)', () => {
      let v: V = minnie(0)
      v = gatherMaterials(v).vehicle!
      v = gatherMaterials(v).vehicle!
      expect(v.brewing_supplies_current).toBe(2)
      // Brew 1
      expect(canBrew(v)).toBe(true)
      v = consumeBrewingSupplies(v).vehicle!
      expect(v.brewing_supplies_current).toBe(1)
      // Brew 2
      expect(canBrew(v)).toBe(true)
      v = consumeBrewingSupplies(v).vehicle!
      expect(v.brewing_supplies_current).toBe(0)
      // Brew 3 - blocked
      expect(canBrew(v)).toBe(false)
      expect(consumeBrewingSupplies(v).error).toMatch(/no brewing materials/i)
    })
  })
})
