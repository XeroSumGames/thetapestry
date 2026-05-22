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

export function defaultSpawnCell(
  gridCols: number,
  gridRows: number,
): { grid_x: number; grid_y: number } {
  return {
    grid_x: Math.min(1, Math.max(0, gridCols - 1)),
    grid_y: Math.min(1, Math.max(0, gridRows - 1)),
  }
}
