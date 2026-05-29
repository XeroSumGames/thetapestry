// tactical-view.ts
// Pure decisions for the table's map view (tactical vs campaign).
//
// The invariant (locked by Xero 2026-05-22): "sharing" the tactical map drives
// what PLAYERS see, NOT the GM's own pane. The GM can preview the Campaign map
// while players still see the shared tactical scene. Before this, the GM's
// local view (showTacticalMap) was entangled with the shared flag
// (tacticalShared) on every client, so a GM who shared was pinned to tactical.
//
// "gmLike" = the GM or a Thriver co-GM (the same dividing line the view toggle
// uses); everyone else is a player who follows the shared view.

export function shouldFollowSharedTactical(gmLike: boolean): boolean {
  // Players follow the GM's shared tactical view; the GM's own pane is never
  // force-switched by share / scene-activation events - they toggle freely.
  return !gmLike
}

export function shouldRenderTactical(args: {
  combatActive: boolean
  showTacticalMap: boolean
  tacticalShared: boolean
  gmLike: boolean
}): boolean {
  const { combatActive, showTacticalMap, tacticalShared, gmLike } = args
  // Combat forces tactical for everyone. Otherwise this client's own toggle
  // decides. The shared flag pins ONLY non-GM clients - the GM can preview the
  // campaign map while players see the shared tactical scene.
  return combatActive || showTacticalMap || (tacticalShared && !gmLike)
}

// --- viewport framing -------------------------------------------------------
//
// Tokens spawn at the LOCKED top-left anchor (1,1) (see lib/tactical-spawn).
// The canvas, though, can be far larger than the viewport, and the default
// scene framing centers on the map middle - so a freshly placed token (or the
// whole PC cluster) sits off-screen top-left and looks like "nothing
// happened" (the 2026-05-25 "tokens won't appear on the map" P1). These pure
// helpers compute where to scroll so a cell / a set of tokens is in view; the
// component just applies the result to the scroll container.

/** Centroid of a set of tokens in CELL-CENTER units (grid_x + 0.5). null if empty. */
export function tokenCentroidCell(
  tokens: ReadonlyArray<{ grid_x: number; grid_y: number }>,
): { cellX: number; cellY: number } | null {
  if (tokens.length === 0) return null
  let sx = 0, sy = 0
  for (const t of tokens) { sx += t.grid_x + 0.5; sy += t.grid_y + 0.5 }
  return { cellX: sx / tokens.length, cellY: sy / tokens.length }
}

/**
 * Scroll offset that centers a cell-center point in the viewport, clamped to
 * the scrollable bounds. `cellX`/`cellY` are in CELL-CENTER units (e.g. a
 * token at grid (1,1) is cellX=1.5). Canvas pixels = cell * cellPx * zoom -
 * the same scale the renderer draws at (grid origin = canvas 0,0).
 */
export function centerScrollOnCell(args: {
  cellX: number; cellY: number
  cellPx: number; zoom: number
  canvasW: number; canvasH: number
  viewW: number; viewH: number
}): { left: number; top: number } {
  const { cellX, cellY, cellPx, zoom, canvasW, canvasH, viewW, viewH } = args
  const px = cellX * cellPx * zoom
  const py = cellY * cellPx * zoom
  const maxX = Math.max(0, canvasW - viewW)
  const maxY = Math.max(0, canvasH - viewH)
  return {
    left: Math.max(0, Math.min(maxX, px - viewW / 2)),
    top: Math.max(0, Math.min(maxY, py - viewH / 2)),
  }
}

// Imperative appliers (the only DOM-touching pieces). Kept here next to the
// math so TacticalMap (a LOC-ratcheted god-component) holds only thin calls.

/** Scene-open framing: center on the tokens' centroid if any, else map middle. */
export function frameViewportOnTokens(
  container: HTMLElement, canvas: HTMLCanvasElement,
  tokens: ReadonlyArray<{ grid_x: number; grid_y: number }>,
  cellPx: number, zoom: number,
): void {
  const c = tokenCentroidCell(tokens)
  if (c) {
    const { left, top } = centerScrollOnCell({
      cellX: c.cellX, cellY: c.cellY, cellPx, zoom,
      canvasW: canvas.width, canvasH: canvas.height,
      viewW: container.clientWidth, viewH: container.clientHeight,
    })
    container.scrollLeft = left; container.scrollTop = top
    return
  }
  container.scrollLeft = Math.max(0, (canvas.width - container.clientWidth) / 2)
  container.scrollTop = Math.max(0, (canvas.height - container.clientHeight) / 2)
}

// Minimal token render used as a fallback when a token's full draw throws -
// guarantees the token still SHOWS (circle + initials) rather than vanishing
// (and, worse, aborting the whole token loop and blanking the ones after it).
export function drawFallbackToken(
  ctx: CanvasRenderingContext2D,
  t: { grid_x: number; grid_y: number; grid_w?: number | null; grid_h?: number | null; name?: string; color?: string | null },
  cellSize: number, offsetX: number, offsetY: number,
): void {
  try {
    const fr = cellSize * 0.4
    const cx = offsetX + (t.grid_x + (t.grid_w ?? 1) / 2) * cellSize
    const cy = offsetY + (t.grid_y + (t.grid_h ?? 1) / 2) * cellSize
    ctx.beginPath(); ctx.arc(cx, cy, fr, 0, Math.PI * 2)
    ctx.fillStyle = t.color || '#7ab3d4'; ctx.fill()
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = '#f5f2ee'; ctx.font = `bold ${Math.max(10, fr * 0.8)}px Carlito`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText((t.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2), cx, cy)
  } catch { /* even the fallback failing must not break the loop */ }
}

/** Smooth-scroll a single grid cell to viewport center (live placement). */
export function scrollCellIntoView(
  container: HTMLElement, canvas: HTMLCanvasElement,
  gx: number, gy: number, cellPx: number, zoom: number,
): void {
  if (canvas.width === 0) return
  const { left, top } = centerScrollOnCell({
    cellX: gx + 0.5, cellY: gy + 0.5, cellPx, zoom,
    canvasW: canvas.width, canvasH: canvas.height,
    viewW: container.clientWidth, viewH: container.clientHeight,
  })
  container.scrollTo({ left, top, behavior: 'smooth' })
}

// Per-client "fit to screen" zoom: how much to zoom so content of width
// `contentW` fits the viewport of width `viewW`. This is a VIEWPORT op
// (each client picks its own), distinct from the background's shared
// `img_scale` - fitting must never rescale the shared map per client, or
// the GM and players diverge. Clamped to the same [0.1, 5] zoom range the
// resize/zoom controls use. Degenerate inputs fall back to 1 (100%).
export function fitZoom(viewW: number, contentW: number): number {
  if (!(viewW > 0) || !(contentW > 0)) return 1
  return Math.max(0.1, Math.min(5, viewW / contentW))
}

// Fill-to-width scale: at zoom=1 the grid fills containerWidth exactly (cell_px * scale == containerWidth/grid_cols).
// One scale drives BOTH the draw transform and the pointer<->cell math; purely per-client.
// Degenerate inputs fall back to zoom (or 1).
export function effectiveScale(containerWidth: number, gridW: number, zoom: number): number {
  const z = zoom > 0 ? zoom : 1
  if (!(containerWidth > 0) || !(gridW > 0)) return z
  return (containerWidth / gridW) * z
}

/** Raw zoom that COVERS the viewport with the grid (fill-to-width model).
 * ratio = (viewH * gridW) / (gridH * viewW).
 * ratio <= 1 (wide container): zoom = ratio, grid fills height, width gap on sides.
 * ratio > 1 (tall container): zoom = ratio > 1, grid fills height, overflows width (scrollable).
 * No upper clamp so the grid always covers the full panel without a gap below.
 * Clamps to 0.1 so extreme shapes don't produce a near-zero zoom. */
export function fitWholeMapZoom(viewW: number, viewH: number, gridW: number, gridH: number): number {
  if (!(viewW > 0) || !(viewH > 0) || !(gridW > 0) || !(gridH > 0)) return 1
  return Math.max(0.1, (viewH * gridW) / (gridH * viewW))
}

/** True when a grid cell is at least partially visible in the current scroll position. */
export function isCellInView(args: {
  cellX: number; cellY: number
  cellPx: number; zoom: number
  scrollLeft: number; scrollTop: number
  viewW: number; viewH: number
}): boolean {
  const { cellX, cellY, cellPx, zoom, scrollLeft, scrollTop, viewW, viewH } = args
  const px = cellX * cellPx * zoom
  const py = cellY * cellPx * zoom
  const s = cellPx * zoom
  return px + s > scrollLeft && px < scrollLeft + viewW && py + s > scrollTop && py < scrollTop + viewH
}

type ActiveEntry = { character_id?: string | null; npc_id?: string | null; character_name?: string | null } | null | undefined

/** Find the first token that moved AND is the active combatant or the viewer's own PC. */
export function findMoveFollowToken<T extends { id: string; grid_x: number; grid_y: number; character_id: string | null; npc_id: string | null; name: string }>(
  toks: ReadonlyArray<T>,
  prevPos: ReadonlyMap<string, { x: number; y: number }>,
  myId: string | null | undefined,
  activeEntry: ActiveEntry,
): T | null {
  for (const tok of toks) {
    const prev = prevPos.get(tok.id)
    if (!prev || (prev.x === tok.grid_x && prev.y === tok.grid_y)) continue
    const isOwn = !!myId && tok.character_id === myId
    const isActive = !!activeEntry && (
      (activeEntry.character_id && tok.character_id === activeEntry.character_id)
      || (activeEntry.npc_id && tok.npc_id === activeEntry.npc_id)
      || (activeEntry.character_name && tok.name === activeEntry.character_name)
    )
    if (isOwn || isActive) return tok
  }
  return null
}

/** Priority-ordered targets for centering: own PC > active combatant > all PCs > all visible. */
export function findCenterTargets<T extends { character_id: string | null; npc_id: string | null; name: string; token_type: string }>(
  visible: ReadonlyArray<T>,
  myId: string | null | undefined,
  activeEntry: ActiveEntry,
): ReadonlyArray<T> {
  const ownPc = myId ? visible.find(t => t.character_id === myId) : undefined
  if (ownPc) return [ownPc]
  const activeTok = activeEntry
    ? visible.find(t =>
        (activeEntry.character_id && t.character_id === activeEntry.character_id)
        || (activeEntry.npc_id && t.npc_id === activeEntry.npc_id)
        || (activeEntry.character_name && t.name === activeEntry.character_name))
    : undefined
  if (activeTok) return [activeTok]
  const pcs = visible.filter(t => t.token_type === 'pc')
  return pcs.length ? pcs : visible
}

// --- vehicle "aboard" suppression (scene-scoped) --------------------------
// A PC/NPC sitting in a vehicle seat is treated as INSIDE the vehicle and
// hidden from the tactical canvas (the vehicle token carries a passenger
// badge instead). This is SCENE-SCOPED: vehicle occupancy lives campaign-
// global (campaigns.vehicles), but each scene is its own moment - a crew
// member only counts as "aboard" on scenes where the vehicle actually has a
// token (matched by name). If the vehicle isn't on this map, nobody's driving
// it here, so its crew render as normal tokens. Pure, so the scene-scope can
// be unit-tested away from the canvas.
export interface AboardVehicle {
  name: string
  driver_character_id?: string | null
  driver_kind?: string | null
  brewer_character_id?: string | null
  brewer_kind?: string | null
  navigator_character_id?: string | null
  navigator_kind?: string | null
  mounted_weapons?: ReadonlyArray<{ shooter_character_id?: string | null; shooter_kind?: string | null } | null> | null
  passenger_seats?: ReadonlyArray<{ character_id?: string | null; kind?: string | null } | null> | null
}

export function computeAboard(
  vehicles: ReadonlyArray<AboardVehicle>,
  tokenNamesOnScene: ReadonlySet<string>,
): { aboardCharIds: Set<string>; aboardNpcIds: Set<string>; passengerCountByVehicleName: Map<string, number> } {
  const aboardCharIds = new Set<string>()
  const aboardNpcIds = new Set<string>()
  const passengerCountByVehicleName = new Map<string, number>()
  for (const v of vehicles) {
    if (!tokenNamesOnScene.has(v.name)) continue // vehicle not on this scene -> crew aren't aboard here
    let count = 0
    const add = (id: string | null | undefined, kind: string | null | undefined) => {
      if (!id) return
      count++
      if (kind === 'pc') aboardCharIds.add(id)
      else if (kind === 'npc') aboardNpcIds.add(id)
    }
    add(v.driver_character_id, v.driver_kind)
    add(v.brewer_character_id, v.brewer_kind)
    add(v.navigator_character_id, v.navigator_kind)
    for (const w of (v.mounted_weapons ?? [])) add(w?.shooter_character_id, w?.shooter_kind)
    for (const s of (v.passenger_seats ?? [])) if (s) add(s.character_id, s.kind)
    if (count > 0) passengerCountByVehicleName.set(v.name, count)
  }
  return { aboardCharIds, aboardNpcIds, passengerCountByVehicleName }
}
