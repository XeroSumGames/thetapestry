import { describe, it, expect } from 'vitest'
import { gridToCoverMap, coverGrowGrid } from '../../lib/tactical-grid'

describe('gridToCoverMap', () => {
  it('returns enough cells to span the rendered image at the cell size', () => {
    // 1400px-wide image at img_scale 1, 35px cells -> 40 cols; 700 tall -> 20 rows.
    expect(gridToCoverMap(1400, 700, 1, 35)).toEqual({ cols: 40, rows: 20 })
  })

  it('rounds UP so a partial cell is still covered', () => {
    // 1410 / 35 = 40.28 -> 41 cols.
    expect(gridToCoverMap(1410, 700, 1, 35)).toEqual({ cols: 41, rows: 20 })
  })

  it('grows the cell count when the cell size shrinks', () => {
    const at35 = gridToCoverMap(1400, 700, 1, 35)
    const at20 = gridToCoverMap(1400, 700, 1, 20)
    expect(at20.cols).toBeGreaterThan(at35.cols) // smaller cells -> more cells to cover
    expect(at20).toEqual({ cols: 70, rows: 35 })
  })

  it('accounts for img_scale (a scaled-down image needs fewer cells)', () => {
    expect(gridToCoverMap(1400, 700, 0.5, 35)).toEqual({ cols: 20, rows: 10 })
  })

  it('caps runaway grids so a tiny cell on a huge map cannot freeze render', () => {
    const r = gridToCoverMap(10000, 10000, 1, 1, 250)
    expect(r).toEqual({ cols: 250, rows: 250 })
  })

  it('caps PROPORTIONALLY so a wide map keeps its aspect (not squished to a square)', () => {
    // 20000x10000 (2:1) at 1px cells would be 20000x10000 cells; capped at 250
    // on the long axis -> 250x125, still 2:1. (The old per-axis cap gave
    // 250x250 = 1:1, which squished the art drawn to fill the grid.)
    expect(gridToCoverMap(20000, 10000, 1, 1, 250)).toEqual({ cols: 250, rows: 125 })
  })

  it('caps PROPORTIONALLY for a tall map too', () => {
    expect(gridToCoverMap(10000, 20000, 1, 1, 250)).toEqual({ cols: 125, rows: 250 })
  })

  it('never returns less than 1 cell for a real image', () => {
    expect(gridToCoverMap(10, 10, 1, 35)).toEqual({ cols: 1, rows: 1 })
  })

  it('returns 0/0 for unusable inputs so callers can guard', () => {
    expect(gridToCoverMap(0, 0, 1, 35)).toEqual({ cols: 0, rows: 0 })
    expect(gridToCoverMap(1400, 700, 1, 0)).toEqual({ cols: 0, rows: 0 })
  })
})

describe('coverGrowGrid', () => {
  it('returns a grow patch when the grid is smaller than the map', () => {
    // map needs 40x20; current 20x15 -> grow to 40x20.
    expect(coverGrowGrid(20, 15, 1400, 700, 1, 35)).toEqual({ grid_cols: 40, grid_rows: 20 })
  })

  it('grows only the axis that is short, keeping the larger current axis', () => {
    // map needs 40x20; current 50 cols (manually enlarged) x 10 rows ->
    // cols stays 50 (grow-only), rows grows to 20.
    expect(coverGrowGrid(50, 10, 1400, 700, 1, 35)).toEqual({ grid_cols: 50, grid_rows: 20 })
  })

  it('returns null when the grid already covers the map (no write)', () => {
    expect(coverGrowGrid(40, 20, 1400, 700, 1, 35)).toBeNull()
    expect(coverGrowGrid(100, 100, 1400, 700, 1, 35)).toBeNull() // manually larger
  })

  it('grows when the cell size shrinks (the reported case)', () => {
    // covered at 35px (40x20); drop to 20px -> needs 70x35 -> grow.
    expect(coverGrowGrid(40, 20, 1400, 700, 1, 20)).toEqual({ grid_cols: 70, grid_rows: 35 })
  })

  it('returns null for unusable inputs', () => {
    expect(coverGrowGrid(20, 15, 0, 0, 1, 35)).toBeNull()
  })
})
