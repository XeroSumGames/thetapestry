// tactical-grid.ts
// Grid sizing for the tactical map. The grid (cols x rows of cell_px) and
// the background image (naturalWidth/Height x img_scale) are drawn in the
// same scene-pixel space but are otherwise independent. To make the grid
// COVER the map, the cell count must span the rendered image at the
// current cell size. Extracted from components/TacticalMap.tsx (2026-05-25,
// Xero "grid should extend to the map") so the math is unit-testable and
// the LOC-ratcheted map component stays lean.

// Cell counts needed for the grid to span the rendered image. Capped at `cap`
// per axis so a tiny cell_px on a huge image can't spawn a runaway grid that
// freezes the O(cols*rows) render loops - but the cap is applied
// PROPORTIONALLY (both axes scaled by the same factor) so the grid keeps the
// image's ASPECT RATIO. Capping each axis independently (the pre-2026-05-27
// bug) collapsed a wide or tall map toward the cap's square, which then
// squished the background (drawn to fill the grid extent) out of proportion.
// Returns {cols:0,rows:0} for unusable inputs (no image / bad cell size) -
// callers should guard.
export function gridToCoverMap(
  naturalWidth: number,
  naturalHeight: number,
  imgScale: number,
  cellPx: number,
  cap = 250,
): { cols: number; rows: number } {
  if (!naturalWidth || !naturalHeight || cellPx <= 0) return { cols: 0, rows: 0 }
  let cols = Math.max(1, Math.ceil((naturalWidth * imgScale) / cellPx))
  let rows = Math.max(1, Math.ceil((naturalHeight * imgScale) / cellPx))
  const maxDim = Math.max(cols, rows)
  if (maxDim > cap) {
    const k = cap / maxDim
    cols = Math.max(1, Math.round(cols * k))
    rows = Math.max(1, Math.round(rows * k))
  }
  return { cols, rows }
}

// Grow-only variant for the auto-fit effect: returns the DB-shaped grid
// patch ONLY if the grid needs to GROW to cover the map (never shrinks
// below the current grid, so a manually-enlarged off-map grid survives),
// else null (no write needed / unusable inputs).
export function coverGrowGrid(
  curCols: number,
  curRows: number,
  naturalWidth: number,
  naturalHeight: number,
  imgScale: number,
  cellPx: number,
  cap = 250,
): { grid_cols: number; grid_rows: number } | null {
  const { cols, rows } = gridToCoverMap(naturalWidth, naturalHeight, imgScale, cellPx, cap)
  if (!cols) return null
  const grid_cols = Math.max(curCols, cols)
  const grid_rows = Math.max(curRows, rows)
  return grid_cols !== curCols || grid_rows !== curRows ? { grid_cols, grid_rows } : null
}
