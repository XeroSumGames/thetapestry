# Test plan - grid auto-covers the map (2026-05-25)

**Change:** the tactical grid now grows to cover the whole background map at
the current cell size, instead of staying at the small default while the map
fills the canvas. Logic in `lib/tactical-grid.ts` (`gridToCoverMap` /
`coverGrowGrid`, unit-tested); wired in `components/TacticalMap.tsx`.

- **Auto (grow-only):** on map upload/load, on Cell (px) change, and on map
  resize (img_scale), the grid grows so `cols x cell_px >= image width` and
  `rows x cell_px >= image height`. It NEVER shrinks below the current grid, so
  a manually-enlarged off-map grid is preserved. Capped at 250x250 so a tiny
  cell on a huge map can't freeze the render.
- **FIT TO MAP button:** now an exact snap to the same coverage (can also
  shrink an over-large grid).

## Steps (GM, on the deployed build)

1. Open a story table -> Map Setup. Upload a wide map (or open Spring Valley RV
   & Storage / Canyon Lake Marina).
   - Expect: the grid spans the ENTIRE image, not just the top-left corner.
2. In the popout, reduce **Cell (px)** (e.g. 35 -> 20).
   - Expect: COLS/ROWS increase automatically so the grid still covers the whole
     map (smaller cells -> more cells). The grid never leaves part of the map
     ungridded.
3. Increase Cell (px) again.
   - Expect: the grid stays covering the map; it does NOT shrink below what's
     needed, and it does not drop below any size you set manually.
4. Manually bump COLS/ROWS bigger than the map (off-map space), then nudge Cell
   (px).
   - Expect: your larger grid is preserved (grow-only never shrinks it).
5. Click **FIT TO MAP**.
   - Expect: the grid snaps to exactly cover the map at the current cell size
     (this one CAN shrink an over-large grid back to the map).
6. Two-client sanity: a player viewing the scene sees the same grid coverage
   after the GM's changes (grid_cols/rows persist + realtime).

Revert if wrong: `git revert <this commit>`.
