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
