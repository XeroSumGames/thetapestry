// tactical-spawn.ts
// Default spawn position for new tokens on a tactical scene.
//
// History: tokens used to spawn at (0,0) — top-left corner. The
// 2026-05-04 day/night work added a 🌞/🌙 + 🌫️ Edit Fog toolbar that
// also lives top-left, which started covering the freshly-placed
// token visually. The GM couldn't see what they'd just placed.
//
// New rule (Xero, 2026-05-04 playtest): spawn under the TOP-RIGHT
// zoom slider instead. The zoom slider takes a thin sliver of the
// top-right corner only, so the second row down + last column is
// always visible.
//
// Coordinates are 0-indexed to match the renderer's
// `tok.grid_x * cellSize` math in components/TacticalMap.tsx.
// Clamps for tiny grids: spawn never falls outside the scene.

export function defaultSpawnCell(
  gridCols: number,
  gridRows: number,
): { grid_x: number; grid_y: number } {
  return {
    grid_x: Math.max(0, gridCols - 1),
    grid_y: Math.min(1, Math.max(0, gridRows - 1)),
  }
}
