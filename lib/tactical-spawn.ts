// tactical-spawn.ts
// Default spawn position for new tokens on a tactical scene.
//
// History (chasing a moving target):
//
//   v1: (0, 0) — top-left corner. Hidden by the day/night/fog
//       toolbar that also lives top-left.
//   v2: (gridCols-1, 1) — top-right under the zoom slider. Now
//       hidden by the NPCs sidebar / Assets panel that overlaps
//       the top-right of the canvas in the /table layout.
//   v3 (current): TOP-CENTER. The middle of the top row is the
//       only column that's never covered by either edge's
//       furniture — fog toolbar (top-left) or NPCs sidebar
//       (top-right). The fog toolbar is now draggable too
//       (commit db7d5b0), so even if a future layout shrinks the
//       middle the GM can move it. But top-center is the safe
//       default that requires no GM intervention.
//
// Coordinates are 0-indexed to match the renderer's
// `tok.grid_x * cellSize` math in components/TacticalMap.tsx.
// Clamps for tiny grids: spawn never falls outside the scene.

export function defaultSpawnCell(
  gridCols: number,
  gridRows: number,
): { grid_x: number; grid_y: number } {
  return {
    grid_x: Math.max(0, Math.floor(gridCols / 2)),
    grid_y: Math.min(1, Math.max(0, gridRows - 1)),
  }
}
