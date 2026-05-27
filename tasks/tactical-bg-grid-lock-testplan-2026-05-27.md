# Testplan - tactical map: lock background to the grid (2026-05-27, Hunt & Peck)

## What changed and why

The background image and the grid+tokens used to be drawn on TWO independent
scales (`naturalWidth x img_scale` for the art, `grid_cols x cell_px` for the
grid/tokens). They only lined up by coincidence, so the GM saw the art as a
small tile in the top-left while tokens scattered across a huge black grid, and
dragging the bg corner handle made the tokens "bounce" (art moved, tokens
didn't).

Now the background is LOCKED to the grid: it always renders to exactly cover
the grid extent (`grid_cols*cell_px x grid_rows*cell_px`), and the grid is
auto-fit to the image's aspect on load. So art + grid + tokens are one rigid
composite - tokens always sit ON the art, it's identical for every viewer
(grid dims + cell_px are shared DB fields), and there's no independent image
scale left to drag out of alignment.

Specifics:
- Background draws at the grid extent (was `naturalWidth*img_scale`).
- On image load (and when the GM changes cell size), the grid auto-fits the
  image via `gridToCoverMap` and persists (GM-only) so all clients share it.
- The image corner-resize handles are GONE (they were the decoupler).
- `img_scale` is retired from the render path entirely (DB column kept, unused).
- Per-screen fitting is ZOOM only (Fit to Screen, Share View) - never rescales
  the shared map.

## EXISTING SCENES - expect a one-time reposition
Opening an existing scene re-fits its grid to the image, which can move where
already-placed tokens land. Any token now off the (smaller) grid still draws
and is grabbable - drag it back onto the art. Fresh scenes are correct from the
first token drop. (The Arena is the repro scene.)

## How to test (LIVE, 2 browsers)

GM + a player member of the same campaign, ideally different window widths.

### A. Art fills the grid (the headline)
1. GM: open a tactical scene that has a background (e.g. The Arena).
2. EXPECT: the art fills the gridded area - no large black margin with the map
   shrunk into a corner. Tokens sit ON the art.
3. Player: open the same scene. EXPECT: the same composite - art fills the grid,
   same tokens in the same spots relative to the art. (Window size differs ->
   only zoom/scroll differ, never the map layout.)

### B. No more bounce
1. GM: confirm there are NO red corner-resize handles on the map image.
2. There's nothing to drag-resize on the image anymore; sizing the map is done
   via the Cell-px control / Fit to Map. Changing cell size scales the whole
   composite uniformly - tokens stay on the same map features, they don't drift
   off the art.

### C. Far-edge tokens are on the art, not in black
1. GM: place a token near the right and bottom edges of the grid.
2. EXPECT: it lands on the art (the art reaches the grid edge), not in black.
3. Player: sees the same.

### D. Fit to Screen is per-client (unchanged contract)
1. GM: click "Fit to Screen" -> the GM's view zooms so the whole map fits the
   GM's window. The PLAYER's view is UNCHANGED (no shared rescale imposed).
2. Player can Fit to Screen independently for their own window.

### E. Share View still works
1. GM: scroll/zoom somewhere, click Share View.
2. Player's view smooth-scrolls + zooms to match. Still aligned (same composite).

### F. Reload stability
1. Reload GM and player tabs. EXPECT: identical result, art still fills the
   grid, no per-client divergence.

### G. Locked-map escape hatch (regression check)
1. GM locks the map. Player still sees a "Center" button and can re-center on
   their token; never stranded.

## Pass criteria
A, C, F show the art filling the grid with tokens on it, identical across the
two clients; B shows no resize handles + no token bounce; D/E/G unchanged.

## ADDENDUM - fit-to-panel-width display model (2nd commit, Xero spec 2026-05-27)
The composite now scales to fill the center panel's WIDTH per machine, with a
local zoom slider on top. Extra checks:

### H. Fills the width on open
1. Open a scene -> the map fills the panel WIDTH (not a small tile, not zoomed
   into a fragment). If the map is taller than the panel, scroll down to see the
   bottom; the grid extends all the way down the map.

### I. Cell PX changes square size, not the fill-width
1. GM changes Cell PX (scene controls). EXPECT: the squares get bigger/smaller
   (fewer/more of them) but the grid still spans the full panel width and still
   covers the whole map. The map doesn't shrink into a corner.

### J. Zoom slider is LOCAL (the key one)
1. Top-right slider: 100% = fill-width; drag up to ~300% to zoom in, down to 25%
   to zoom out. It scrolls, the map stays aligned.
2. CRUCIAL: GM zooms -> the PLAYER's zoom does NOT change (and vice versa). One
   person's slider only moves their own view. (This removed the old GM-zoom
   auto-broadcast.)

### K. Fit to Screen = whole map
1. Click Fit to Screen -> the ENTIRE map fits in your panel (both width and
   height) and is centered. Local only.

## Notes
- Render-model change in `components/TacticalMap.tsx` + one tested helper
  `effectiveScale()` in `lib/tactical-view.ts` (4 unit tests). No schema/data
  migration (grid re-fit happens lazily on GM load). Rollback = revert the
  commits. `img_scale` DB column is retained (now unused by the renderer).
- E2E `e2e/tactical-map-render.spec.ts` still green (locked-map escape hatch +
  shared render state + the source-guard, which passes with zero setImgScale
  calls). The pixel + zoom-independence checks above stay manual (canvas).
