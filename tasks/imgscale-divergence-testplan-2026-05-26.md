# Testplan: tactical-map img_scale divergence fix (shared authoritative scale)

Campaign `cc766e7f` (Minnie), scene `0c2ddae8` (Spring Valley RV & Storage). Live = thetapestry.distemperverse.com.

## What changed
- Removed the per-client background auto-fit (each client used to scale the bg to its own window width, never saved -> every screen saw a different map).
- The GM's corner-drag resize of the background now PERSISTS (`img_scale` -> DB), so it is shared with all clients.
- "Fit to Screen" now fits via per-client ZOOM (viewport), not by rescaling the shared background.
- `img_scale` is read from the DB on scene load for everyone (default 1 = 100% raw); no client silently rescales it.

## Why it fixes the report
- "Map not the same for all players" / "Juno on the edge but thinks she's in the middle": all clients now render the bg at the one DB `img_scale`, so the bg sits in the same place relative to the grid for everyone.
- "Tokens floating in black": with no per-client shrink, the bg renders at >= the grid extent at the default scale, so grid cells (and the tokens on them) sit on the art.
- Player center-on-open strand: the canvas no longer resizes asynchronously after the image loads, so the open-frame lands on the token centroid instead of racing the resize.

## Manual 2-client check (the real proof - render is canvas, not unit-testable)
1. GM opens the table on a WIDE window; a player opens the same scene on a NARROW window (or phone-ish width).
2. CONFIRM: both see the background in the same position relative to the grid (pick a landmark cell, e.g. the building corner at a known grid cell - it's the same cell for both).
3. CONFIRM: no token sits in black void; every PC token is on the art.
4. GM drags a background corner handle to resize the art; reload the GM tab -> the resize PERSISTS (was lost before). Player reloads -> player sees the SAME resized scale.
5. GM clicks "Fit to Screen" -> the GM's view zooms to fit; the PLAYER's view is unchanged (no shared rescale imposed).
6. Open a scene fresh as a player -> the view frames on the player's token (not the empty middle, not off in black).
7. Add a grid column/row (popout) -> the grid grows, the background does NOT jump/rescale (decoupling preserved).

## Regression watch
- FIT TO MAP (grid snaps to cover the art) still works.
- Grid auto-cover (grow-only) still works.
- Share View still pushes the GM's view to players.
- Zoom in/out + pan still work for GM and players.

## Follow-up (separate, needs Xero confirm - bulk user-data op)
- Spring Valley tokens were band-aid-shifted left 38 cols (`tasks/_work/shift-sv-tokens-onmap.sql`) so they'd be reachable under the BROKEN render. With this fix the full grid is on the art, so those tokens are now 38 cols left of their real spots. Reversal SQL ready; apply only on Xero's OK.
