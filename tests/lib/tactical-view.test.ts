import { describe, it, expect } from 'vitest'
import { shouldFollowSharedTactical, shouldRenderTactical, tokenCentroidCell, centerScrollOnCell, fitZoom, effectiveScale, fitWholeMapZoom, isCellInView, findMoveFollowToken, findCenterTargets, computeAboard } from '../../lib/tactical-view'

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
  it('returns zoom directly (shared cell_px is the absolute base)', () => {
    expect(effectiveScale(0.5)).toBe(0.5)
    expect(effectiveScale(1)).toBe(1)
    expect(effectiveScale(2)).toBe(2)
  })

  it('falls back to 1 on degenerate inputs', () => {
    expect(effectiveScale(0)).toBe(1)
    expect(effectiveScale(-1)).toBe(1)
  })
})

describe('fitWholeMapZoom', () => {
  it('uses width when width is the tighter constraint', () => {
    // 1000x500 grid in a 500x400 viewport: fitW=0.5, fitH=0.8 -> min=0.5
    expect(fitWholeMapZoom(500, 400, 1000, 500)).toBe(0.5)
  })

  it('uses height when height is the tighter constraint', () => {
    // 500x1000 grid in a 400x500 viewport: fitW=0.8, fitH=0.5 -> min=0.5
    expect(fitWholeMapZoom(400, 500, 500, 1000)).toBe(0.5)
  })

  it('clamps to 0.25 on tiny viewport / huge grid', () => {
    expect(fitWholeMapZoom(50, 50, 5000, 5000)).toBe(0.25)
  })

  it('clamps to 3 on huge viewport / tiny grid', () => {
    expect(fitWholeMapZoom(5000, 5000, 500, 500)).toBe(3)
  })

  it('falls back to 1 on degenerate inputs', () => {
    expect(fitWholeMapZoom(0, 500, 1000, 500)).toBe(1)
    expect(fitWholeMapZoom(500, 0, 1000, 500)).toBe(1)
    expect(fitWholeMapZoom(500, 500, 0, 500)).toBe(1)
    expect(fitWholeMapZoom(500, 500, 500, 0)).toBe(1)
  })
})

describe('isCellInView', () => {
  const base = { cellPx: 35, zoom: 1, scrollLeft: 0, scrollTop: 0, viewW: 700, viewH: 525 }

  it('a cell at the origin is in view', () => {
    expect(isCellInView({ ...base, cellX: 0, cellY: 0 })).toBe(true)
  })

  it('a cell fully within the viewport is in view', () => {
    // cell (5,5): px=175, size=35 -> fits in 700x525
    expect(isCellInView({ ...base, cellX: 5, cellY: 5 })).toBe(true)
  })

  it('a cell whose left edge is at viewW is NOT in view', () => {
    // cell (20,0): px=700, size=35; px NOT < 0+700 -> false
    expect(isCellInView({ ...base, cellX: 20, cellY: 0 })).toBe(false)
  })

  it('a cell whose top edge is at viewH is NOT in view', () => {
    // cell (0,15): py=525, size=35; py NOT < 0+525 -> false
    expect(isCellInView({ ...base, cellX: 0, cellY: 15 })).toBe(false)
  })

  it('a cell scrolled into view is visible', () => {
    // cell (25,20): px=875, py=700; scrolled to (200,200), view 700x525 -> (875<900, 700<925)
    expect(isCellInView({ ...base, cellX: 25, cellY: 20, scrollLeft: 200, scrollTop: 200 })).toBe(true)
  })

  it('zoom scales both position and cell size', () => {
    // cell (5,5) at zoom=2: px=350, size=70 -> in 700x525
    expect(isCellInView({ ...base, zoom: 2, cellX: 5, cellY: 5 })).toBe(true)
    // cell (10,0) at zoom=2: px=700, NOT < viewW 700 -> false
    expect(isCellInView({ ...base, zoom: 2, cellX: 10, cellY: 0 })).toBe(false)
  })
})

const tok = (id: string, cid: string | null, nid: string | null, name: string, type = 'pc', x = 1, y = 1) =>
  ({ id, character_id: cid, npc_id: nid, name, token_type: type, grid_x: x, grid_y: y })

describe('findMoveFollowToken', () => {
  const t1 = tok('t1', 'char1', null, 'Mikey')
  const t2 = tok('t2', null, 'npc1', 'Benny', 'npc', 3, 3)
  const active = { character_id: null, npc_id: 'npc1', character_name: 'Benny' }

  it('returns null when no token moved', () => {
    const pos = new Map([['t1', { x: 1, y: 1 }], ['t2', { x: 3, y: 3 }]])
    expect(findMoveFollowToken([t1, t2], pos, 'char1', active)).toBeNull()
  })

  it('returns a token that moved AND matches own PC', () => {
    const pos = new Map([['t1', { x: 0, y: 0 }]])
    expect(findMoveFollowToken([t1, t2], pos, 'char1', null)).toBe(t1)
  })

  it('returns a token that moved AND matches active combatant', () => {
    const pos = new Map([['t2', { x: 1, y: 1 }]])
    const moved = { ...t2, grid_x: 3, grid_y: 3 }
    expect(findMoveFollowToken([t1, moved], pos, null, active)).toBe(moved)
  })

  it('ignores tokens that moved but are neither own PC nor active', () => {
    const other = tok('t3', 'char3', null, 'Randy', 'pc', 5, 5)
    const pos = new Map([['t3', { x: 2, y: 2 }]])
    expect(findMoveFollowToken([other], pos, 'char1', active)).toBeNull()
  })

  it('returns null for a newly appeared token (no prev entry)', () => {
    expect(findMoveFollowToken([t1], new Map(), 'char1', null)).toBeNull()
  })
})

describe('findCenterTargets', () => {
  const pc1 = tok('p1', 'char1', null, 'Mikey', 'pc')
  const pc2 = tok('p2', 'char2', null, 'Juno', 'pc')
  const npc = tok('n1', null, 'npc1', 'Benny', 'npc')

  it('returns the own PC when present', () => {
    expect(findCenterTargets([pc1, pc2, npc], 'char1', null)).toEqual([pc1])
  })

  it('falls back to active combatant when own PC not visible', () => {
    const active = { character_id: null, npc_id: 'npc1', character_name: 'Benny' }
    expect(findCenterTargets([pc2, npc], 'char1', active)).toEqual([npc])
  })

  it('falls back to all PCs when no own/active', () => {
    expect(findCenterTargets([pc1, pc2, npc], null, null)).toEqual([pc1, pc2])
  })

  it('falls back to all visible when no PCs', () => {
    expect(findCenterTargets([npc], null, null)).toEqual([npc])
  })

  it('returns empty array for empty visible', () => {
    expect(findCenterTargets([], 'char1', null)).toEqual([])
  })
})

describe('computeAboard (scene-scoped vehicle occupancy)', () => {
  const minnie = {
    name: 'Minnie',
    driver_character_id: 'shimmy', driver_kind: 'pc',
    navigator_character_id: 'goon', navigator_kind: 'npc',
    passenger_seats: [null, { character_id: 'juno', kind: 'pc' }],
    mounted_weapons: [{ shooter_character_id: 'mikey', shooter_kind: 'pc' }],
  }

  it('treats crew as aboard when the vehicle has a token on the scene', () => {
    const r = computeAboard([minnie], new Set(['Minnie', 'Enya']))
    expect(r.aboardCharIds).toEqual(new Set(['shimmy', 'juno', 'mikey']))
    expect(r.aboardNpcIds).toEqual(new Set(['goon']))
    expect(r.passengerCountByVehicleName.get('Minnie')).toBe(4)
  })

  it('does NOT treat crew as aboard when the vehicle is NOT on the scene (the bug)', () => {
    // Minnie isn't on this map -> nobody is driving her here -> crew render.
    const r = computeAboard([minnie], new Set(['Enya', 'Juno Lask']))
    expect(r.aboardCharIds.size).toBe(0)
    expect(r.aboardNpcIds.size).toBe(0)
    expect(r.passengerCountByVehicleName.size).toBe(0)
  })

  it('scopes per vehicle: only the on-scene vehicle hides its crew', () => {
    const truck = { name: 'Truck', driver_character_id: 'dash', driver_kind: 'pc' }
    const r = computeAboard([minnie, truck], new Set(['Truck']))
    expect(r.aboardCharIds).toEqual(new Set(['dash']))
    expect(r.passengerCountByVehicleName.has('Minnie')).toBe(false)
    expect(r.passengerCountByVehicleName.get('Truck')).toBe(1)
  })

  it('ignores empty seats and unfilled roles', () => {
    const empty = { name: 'Empty', passenger_seats: [null, null], mounted_weapons: [null] }
    const r = computeAboard([empty], new Set(['Empty']))
    expect(r.aboardCharIds.size).toBe(0)
    expect(r.passengerCountByVehicleName.size).toBe(0)
  })
})
