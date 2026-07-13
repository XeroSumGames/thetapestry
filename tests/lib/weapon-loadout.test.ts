import { describe, it, expect } from 'vitest'
import { rangedLoadout } from '../../lib/weapon-loadout'

// Pin the Xero 2026-07-13 canon (retuned same day: "36 bullets is wrong"):
// PC = full clip + 1d3 reloads (6-round revolver = 12..24 total, never 36);
// NPC = 1d6-1 loaded (scarce) + 1d3 reloads; melee/no-clip = nothing.
describe('rangedLoadout', () => {
  it('PC: full clip + 1d3 reloads', () => {
    // rng=0 -> d3 = floor(0*3)+1 = 1
    expect(rangedLoadout(6, 'pc', () => 0)).toEqual({ ammoCurrent: 6, ammoMax: 6, reloads: 1 })
    // rng just under 1 -> d3 = 3
    expect(rangedLoadout(6, 'pc', () => 0.999)).toEqual({ ammoCurrent: 6, ammoMax: 6, reloads: 3 })
  })

  it('PC reloads span exactly 1..3 (revolver totals 12..24, never 36)', () => {
    const rolls = [0, 0.34, 0.67, 0.99].map(r => rangedLoadout(6, 'pc', () => r).reloads)
    expect(Math.min(...rolls)).toBe(1) // never 0
    expect(Math.max(...rolls)).toBe(3) // never more than 3 spare clips
    const maxTotal = 6 + Math.max(...rolls) * 6
    expect(maxTotal).toBe(24)
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
