import { describe, it, expect } from 'vitest'
import { shouldFollowSharedTactical, shouldRenderTactical, tokenCentroidCell, centerScrollOnCell, fitZoom, effectiveScale } from '../../lib/tactical-view'

// Invariant (Xero 2026-05-22): sharing drives what PLAYERS see, not the GM's
// own pane. The GM can preview the campaign map while players see the shared
// tactical scene. Players follow; the GM toggles freely.
describe('shouldFollowSharedTactical', () => {
  it('players follow the shared view', () => {
    expect(shouldFollowSharedTactical(false)).toBe(true)
  })
  it('the GM (gmLike) never auto-follows', () => {
    expect(shouldFollowSharedTactical(true)).toBe(false)
  })
})

describe('shouldRenderTactical', () => {
  const base = { combatActive: false, showTacticalMap: false, tacticalShared: false, gmLike: false }

  it('THE FIX: GM is NOT pinned to tactical by the shared flag alone', () => {
    // GM toggled their view to campaign (showTacticalMap:false) while sharing.
    expect(shouldRenderTactical({ ...base, gmLike: true, tacticalShared: true })).toBe(false)
  })

  it('player IS pinned to tactical when the GM shares', () => {
    expect(shouldRenderTactical({ ...base, gmLike: false, tacticalShared: true })).toBe(true)
  })

  it('combat forces tactical for everyone (GM and player)', () => {
    expect(shouldRenderTactical({ ...base, combatActive: true, gmLike: true })).toBe(true)
    expect(shouldRenderTactical({ ...base, combatActive: true, gmLike: false })).toBe(true)
  })

  it("the client's own toggle still shows tactical regardless of role", () => {
    expect(shouldRenderTactical({ ...base, showTacticalMap: true, gmLike: true })).toBe(true)
    expect(shouldRenderTactical({ ...base, showTacticalMap: true, gmLike: false })).toBe(true)
  })

  it('GM viewing tactical while sharing stays tactical (showTacticalMap drives it)', () => {
    expect(shouldRenderTactical({ ...base, gmLike: true, showTacticalMap: true, tacticalShared: true })).toBe(true)
  })

  it('nobody sharing, nobody in combat, toggle off = campaign for all', () => {
    expect(shouldRenderTactical({ ...base, gmLike: true })).toBe(false)
    expect(shouldRenderTactical({ ...base, gmLike: false })).toBe(false)
  })
})

// Viewport framing (2026-05-25 "tokens won't appear on the map" P1): tokens
// spawn at the locked top-left (1,1); the canvas can dwarf the viewport, so a
// just-placed token must be scrolled into view or it's lost off-screen.
describe('tokenCentroidCell', () => {
  it('returns null for no tokens', () => {
    expect(tokenCentroidCell([])).toBeNull()
  })
  it('gives the cell-center of a single token', () => {
    expect(tokenCentroidCell([{ grid_x: 1, grid_y: 1 }])).toEqual({ cellX: 1.5, cellY: 1.5 })
  })
  it('averages cell-centers of multiple tokens', () => {
    // top-row PC cluster (1,1)(3,1)(5,1) -> centroid x = (1.5+3.5+5.5)/3 = 3.5
    expect(tokenCentroidCell([
      { grid_x: 1, grid_y: 1 }, { grid_x: 3, grid_y: 1 }, { grid_x: 5, grid_y: 1 },
    ])).toEqual({ cellX: 3.5, cellY: 1.5 })
  })
})

describe('centerScrollOnCell', () => {
  const geo = { cellPx: 25, zoom: 1, canvasW: 1425, canvasH: 1075, viewW: 900, viewH: 600 }

  it('clamps a top-left token to scroll origin (it would center past 0)', () => {
    // token (1,1): cellX 1.5 -> px 37.5; 37.5 - 450 < 0 -> clamp to 0
    expect(centerScrollOnCell({ ...geo, cellX: 1.5, cellY: 1.5 })).toEqual({ left: 0, top: 0 })
  })

  it('centers a mid-map token in the viewport', () => {
    // cell (32,22) center (32.5,22.5) -> px (812.5,562.5); minus half-view
    expect(centerScrollOnCell({ ...geo, cellX: 32.5, cellY: 22.5 }))
      .toEqual({ left: 812.5 - 450, top: 562.5 - 300 })
  })

  it('clamps to the far scroll bound for a bottom-right token', () => {
    // huge cell coords -> px beyond canvas; clamp to canvasW-viewW / canvasH-viewH
    expect(centerScrollOnCell({ ...geo, cellX: 999, cellY: 999 }))
      .toEqual({ left: 1425 - 900, top: 1075 - 600 })
  })

  it('accounts for zoom (canvas pixels scale with zoom)', () => {
    // zoom 2 doubles the pixel position of the same cell
    expect(centerScrollOnCell({ ...geo, zoom: 2, canvasW: 2850, canvasH: 2150, cellX: 32.5, cellY: 22.5 }))
      .toEqual({ left: 32.5 * 25 * 2 - 450, top: 22.5 * 25 * 2 - 300 })
  })
})

describe('fitZoom', () => {
  it('returns the ratio that fits content width into the viewport', () => {
    expect(fitZoom(900, 1800)).toBe(0.5)
    expect(fitZoom(1800, 900)).toBe(2)
  })

  it('clamps to the [0.1, 5] zoom range', () => {
    expect(fitZoom(100, 5000)).toBe(0.1) // would be 0.02
    expect(fitZoom(5000, 100)).toBe(5)   // would be 50
  })

  it('falls back to 1 on degenerate inputs (no divide-by-zero / negatives)', () => {
    expect(fitZoom(0, 1000)).toBe(1)
    expect(fitZoom(1000, 0)).toBe(1)
    expect(fitZoom(-5, 1000)).toBe(1)
  })
})

describe('effectiveScale', () => {
  it('fills the panel width at zoom=1 (composite width == container width)', () => {
    // gridW 1000 in a 500px panel -> 0.5 so the 1000px map renders at 500px.
    expect(effectiveScale(500, 1000, 1)).toBe(0.5)
    // square map already == panel -> 1:1.
    expect(effectiveScale(800, 800, 1)).toBe(1)
  })

  it('multiplies the fill-width baseline by the local zoom', () => {
    // 500/1000 = 0.5 baseline; zoom 2 -> 1.0 (zoomed in 2x).
    expect(effectiveScale(500, 1000, 2)).toBe(1)
    // zoom 0.5 -> 0.25 (zoomed out).
    expect(effectiveScale(500, 1000, 0.5)).toBe(0.25)
  })

  it('is independent per client: same map, different panel widths -> different scale', () => {
    expect(effectiveScale(600, 1200, 1)).toBe(0.5)
    expect(effectiveScale(1200, 1200, 1)).toBe(1)
  })

  it('falls back to the zoom (or 1) on degenerate inputs', () => {
    expect(effectiveScale(0, 1000, 1.5)).toBe(1.5)
    expect(effectiveScale(500, 0, 2)).toBe(2)
    expect(effectiveScale(0, 0, 0)).toBe(1)
  })
})
