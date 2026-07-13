import { describe, it, expect } from 'vitest'
import { rangedLoadout } from '../../lib/weapon-loadout'

// Pin the Xero 2026-07-13 canon: PC = full clip + 1d6 reloads; NPC = 1d6-1
// loaded (scarce) + 1d3 reloads; melee/no-clip = nothing.
describe('rangedLoadout', () => {
  it('PC: full clip + 1d6 reloads', () => {
    // rng=0 -> d6 = floor(0*6)+1 = 1
    expect(rangedLoadout(6, 'pc', () => 0)).toEqual({ ammoCurrent: 6, ammoMax: 6, reloads: 1 })
    // rng just under 1 -> d6 = 6
    expect(rangedLoadout(6, 'pc', () => 0.999)).toEqual({ ammoCurrent: 6, ammoMax: 6, reloads: 6 })
  })

  it('PC reloads span exactly 1..6 across the rng range', () => {
    const rolls = [0, 0.2, 0.34, 0.5, 0.7, 0.99].map(r => rangedLoadout(6, 'pc', () => r).reloads)
    expect(rolls).toEqual([1, 2, 3, 4, 5, 6])
    expect(Math.min(...rolls)).toBe(1) // never 0
  })

  it('NPC: 1d6-1 loaded (can be empty) + 1d3 reloads', () => {
    // rng=0 -> d6=1 -> loaded = max(0, 1-1) = 0 (empty); d3 = 1
    expect(rangedLoadout(6, 'npc', () => 0)).toEqual({ ammoCurrent: 0, ammoMax: 6, reloads: 1 })
    // rng=0.999 -> d6=6 -> loaded 5; d3 = 3
    expect(rangedLoadout(6, 'npc', () => 0.999)).toEqual({ ammoCurrent: 5, ammoMax: 6, reloads: 3 })
  })

  it('NPC loaded rounds stay in 0..(clip-1) and never negative', () => {
    for (const r of [0, 0.1, 0.5, 0.83, 0.99]) {
      const lo = rangedLoadout(6, 'npc', () => r)
      expect(lo.ammoCurrent).toBeGreaterThanOrEqual(0)
      expect(lo.ammoCurrent).toBeLessThanOrEqual(5)
    }
  })

  it('NPC reloads are 1..3, never 0 (the old ceil(random*3) could roll 0)', () => {
    const rolls = [0, 0.34, 0.67, 0.99].map(r => rangedLoadout(6, 'npc', () => r).reloads)
    expect(Math.min(...rolls)).toBe(1)
    expect(Math.max(...rolls)).toBe(3)
  })

  it('melee / no clip => all zeros for both roles', () => {
    expect(rangedLoadout(0, 'pc')).toEqual({ ammoCurrent: 0, ammoMax: 0, reloads: 0 })
    expect(rangedLoadout(undefined, 'npc')).toEqual({ ammoCurrent: 0, ammoMax: 0, reloads: 0 })
    expect(rangedLoadout(null, 'pc')).toEqual({ ammoCurrent: 0, ammoMax: 0, reloads: 0 })
  })
})
