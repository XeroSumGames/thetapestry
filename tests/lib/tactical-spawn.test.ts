import { describe, it, expect } from 'vitest'
import { defaultSpawnCell, centeredToolbarX } from '../../lib/tactical-spawn'

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
  // lay out on a 2-cell-spaced grid so token circles + labels don't clump.
  it('returns the (1,1) anchor when it is free even if occupancy is passed', () => {
    expect(defaultSpawnCell(20, 15, [{ grid_x: 5, grid_y: 5 }])).toEqual({ grid_x: 1, grid_y: 1 })
    expect(defaultSpawnCell(20, 15, [])).toEqual({ grid_x: 1, grid_y: 1 })
  })

  it('spaces by 2 cells when the anchor is taken (never into row 0 / col 0)', () => {
    // (1,1) taken -> next spaced cell is (3,1), not (2,1) (avoids overlap)
    // and never (0,0) (under the day/fog toolbar).
    expect(defaultSpawnCell(20, 15, [{ grid_x: 1, grid_y: 1 }])).toEqual({ grid_x: 3, grid_y: 1 })
  })

  it('lays successive tokens out 2 cells apart, distinct and clear of row 0 / col 0', () => {
    const taken: { grid_x: number; grid_y: number }[] = []
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) {
      const cell = defaultSpawnCell(20, 15, taken)
      const k = `${cell.grid_x},${cell.grid_y}`
      expect(seen.has(k)).toBe(false) // each placement is a distinct cell
      expect(cell.grid_x % 2).toBe(1) // odd col => 2-cell spacing from anchor (1)
      expect(cell.grid_y % 2).toBe(1) // odd row => 2-cell spacing from anchor (1)
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

// Fog toolbar default X (2026-05-25): the toolbar used to default to the
// top-left corner and hide the (1,1) spawn tokens behind it. We now
// center the collapsed bar across the canvas instead of moving the
// locked spawn.
describe('centeredToolbarX', () => {
  it('centers the bar on a normal-width canvas', () => {
    // (1300 - 200) / 2 = 550, well clear of the right reserve
    expect(centeredToolbarX(1300, 200, 290)).toBe(550)
  })

  it('truly centers regardless of bar width', () => {
    expect(centeredToolbarX(1920, 200, 290)).toBe(860) // (1920-200)/2
    expect(centeredToolbarX(1920, 480, 290)).toBe(720) // (1920-480)/2
  })

  it('never sits on the top-left spawn (always >= 8)', () => {
    // Tiny canvas: true center would be <= 8, so it floors at 8.
    expect(centeredToolbarX(200, 200, 290)).toBe(8)
    expect(centeredToolbarX(40, 200, 290)).toBe(8)
  })

  it('shifts left of center on a narrow canvas to clear the right cluster', () => {
    // contW=800, barW=200: true center 300, but safeMax = 800-200-290 = 310.
    // 300 < 310, so it stays centered (no shift needed here).
    expect(centeredToolbarX(800, 200, 290)).toBe(300)
    // contW=700: true center 250, safeMax = 700-200-290 = 210 -> clamp to 210.
    expect(centeredToolbarX(700, 200, 290)).toBe(210)
  })
})
