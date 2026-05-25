// tactical-spawn.ts
// Default spawn position for new tokens on a tactical scene.
//
// History (chasing a moving target):
//
//   v1: (0, 0) - top-left corner. Hidden by the day/night/fog
//       toolbar that also lives top-left.
//   v2: (gridCols-1, 1) - top-right under the zoom slider. Now
//       hidden by the NPCs sidebar / Assets panel that overlaps
//       the top-right of the canvas in the /table layout.
//   v3: TOP-CENTER. Avoided both edges' furniture but drifted from
//       the locked decision below.
//   v4 (current, locked by Xero 2026-05-22): TOP-LEFT (1, 1) - one
//       cell in from the corner. (0,0) was hidden by the fog toolbar,
//       so spawn one cell in; the toolbar is also draggable now
//       (commit db7d5b0), so the GM can clear it if needed. Top-left
//       is the canonical spawn position.
//
// Coordinates are 0-indexed to match the renderer's
// `tok.grid_x * cellSize` math in components/TacticalMap.tsx.
// Clamps for tiny grids: spawn never falls outside the scene.
//
// Occupancy (added 2026-05-25): pass the cells already taken on the
// scene and the spawn steps to the NEAREST free cell, spiralling out
// from the (1,1) anchor. Without this every token landed on (1,1) and
// stacked - placing 3 PCs looked like only one appeared (playtest
// 2026-05-25). Omitting `occupied` keeps the original (1,1) behaviour.

export function defaultSpawnCell(
  gridCols: number,
  gridRows: number,
  occupied?: Iterable<{ grid_x: number; grid_y: number }>,
): { grid_x: number; grid_y: number } {
  const baseX = Math.min(1, Math.max(0, gridCols - 1))
  const baseY = Math.min(1, Math.max(0, gridRows - 1))
  if (!occupied) return { grid_x: baseX, grid_y: baseY }

  const key = (x: number, y: number) => `${x},${y}`
  const taken = new Set<string>()
  for (const t of occupied) taken.add(key(t.grid_x, t.grid_y))
  if (!taken.has(key(baseX, baseY))) return { grid_x: baseX, grid_y: baseY }

  // Lay tokens out on a SPACED grid (every STEP cells) down-right of the
  // anchor, row by row. Spacing matters: a token circle is ~0.8 cells and
  // its name label is ~1 cell wide, so packing into ADJACENT cells clumps
  // everything into an unreadable pile in the top-left where new tokens
  // hide behind old ones (playtest 2026-05-25). 2-cell spacing keeps each
  // token's circle clearly separate and grabbable. Stay at x>=baseX,
  // y>=baseY: row 0 / col 0 sit under the draggable day/fog toolbar.
  const STEP = 2
  for (let y = baseY; y < gridRows; y += STEP) {
    for (let x = baseX; x < gridCols; x += STEP) {
      if (!taken.has(key(x, y))) return { grid_x: x, grid_y: y }
    }
  }
  // Spaced grid full - fall back to ANY free cell, then the anchor.
  for (let y = baseY; y < gridRows; y++) {
    for (let x = baseX; x < gridCols; x++) {
      if (!taken.has(key(x, y))) return { grid_x: x, grid_y: y }
    }
  }
  return { grid_x: baseX, grid_y: baseY }
}

// Default LEFT (x) for the GM fog/lighting toolbar - the other half of
// the spawn-vs-chrome problem above. The toolbar is a left-anchored
// absolute element that used to default to the top-left corner (8,8),
// where it sat on top of the locked (1,1) spawn and hid the PCs' tokens
// behind it (playtest 2026-05-25). Rather than move the locked spawn
// AGAIN, we move the chrome: center the (collapsed) bar across the
// canvas. A hardcoded "center" pixel only looks centered on one screen
// width, so the caller measures the live container + bar and passes
// them here.
//
//   containerWidth - canvas wrapper width (px)
//   barWidth       - the collapsed toolbar's own width (px)
//   rightReserve   - keep this much clear on the right for the pinned
//                    zoom + Share-View cluster; the centered bar only
//                    shifts left of true-center on a narrow canvas.
//
// Floored at 8 so the bar never leaves the left edge. The fog-edit
// controls expand the bar rightward beyond this and can overflow toward
// the right cluster on a narrow canvas, but that is a transient edit
// state and the bar stays draggable.
export function centeredToolbarX(
  containerWidth: number,
  barWidth: number,
  rightReserve: number,
): number {
  let x = (containerWidth - barWidth) / 2
  const safeMax = containerWidth - barWidth - rightReserve
  if (x > safeMax) x = safeMax
  return Math.max(8, Math.round(x))
}
