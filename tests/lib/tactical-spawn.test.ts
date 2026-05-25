import { describe, it, expect } from 'vitest'
import { defaultSpawnCell } from '../../lib/tactical-spawn'

// Canonical spawn position: TOP-LEFT (1,1), 0-indexed, one cell in from the
// corner. Locked by Xero 2026-05-22 (resolves the code-vs-memory conflict
// where the code had drifted to top-center). See lib/tactical-spawn.ts header.
describe('defaultSpawnCell', () => {
  it('spawns top-left (1,1) on a normal grid', () => {
    expect(defaultSpawnCell(20, 15)).toEqual({ grid_x: 1, grid_y: 1 })
  })

  it('is independent of grid size for any grid >= 2x2', () => {
    expect(defaultSpawnCell(40, 30)).toEqual({ grid_x: 1, grid_y: 1 })
    expect(defaultSpawnCell(2, 2)).toEqual({ grid_x: 1, grid_y: 1 })
  })

  it('clamps so spawn never falls outside a tiny grid', () => {
    expect(defaultSpawnCell(1, 1)).toEqual({ grid_x: 0, grid_y: 0 })
    expect(defaultSpawnCell(1, 15)).toEqual({ grid_x: 0, grid_y: 1 })
    expect(defaultSpawnCell(20, 1)).toEqual({ grid_x: 1, grid_y: 0 })
  })

  // Occupancy-aware spawning (2026-05-25): when the anchor (1,1) is taken,
  // step to the nearest free cell instead of stacking.
  it('returns the (1,1) anchor when it is free even if occupancy is passed', () => {
    expect(defaultSpawnCell(20, 15, [{ grid_x: 5, grid_y: 5 }])).toEqual({ grid_x: 1, grid_y: 1 })
    expect(defaultSpawnCell(20, 15, [])).toEqual({ grid_x: 1, grid_y: 1 })
  })

  it('steps to a free cell down-right of the anchor when (1,1) is taken (never into row 0 / col 0)', () => {
    // (1,1) taken -> nearest free cell staying at x>=1,y>=1 is (2,1).
    // Must NOT be (0,0): that sits under the day/fog toolbar (hidden token).
    expect(defaultSpawnCell(20, 15, [{ grid_x: 1, grid_y: 1 }])).toEqual({ grid_x: 2, grid_y: 1 })
  })

  it('keeps stepping outward as cells fill, never stacking and never into row 0 / col 0', () => {
    const taken: { grid_x: number; grid_y: number }[] = []
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) {
      const cell = defaultSpawnCell(20, 15, taken)
      const k = `${cell.grid_x},${cell.grid_y}`
      expect(seen.has(k)).toBe(false) // each placement is a distinct cell
      expect(cell.grid_x).toBeGreaterThanOrEqual(1) // clear of the toolbar col
      expect(cell.grid_y).toBeGreaterThanOrEqual(1) // clear of the toolbar row
      seen.add(k)
      taken.push(cell)
    }
  })

  it('falls back to the anchor when the whole grid is full', () => {
    const full: { grid_x: number; grid_y: number }[] = []
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) full.push({ grid_x: x, grid_y: y })
    expect(defaultSpawnCell(3, 3, full)).toEqual({ grid_x: 1, grid_y: 1 })
  })
})
