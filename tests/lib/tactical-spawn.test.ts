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
})
