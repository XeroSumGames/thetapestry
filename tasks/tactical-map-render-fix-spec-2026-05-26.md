# Tactical-Map Render Fix - Spec (P0)

**Author:** Puffer Fish (architecture). **Date:** 2026-05-26. **For:** Hunt & Peck (owns `components/TacticalMap.tsx`).
**Status:** spec / design - HP implements. Doc-first so the fix lands once, correctly.
**Why P0:** the Minnie S7 playtest (2026-05-26) was effectively unplayable on the tactical map. This one render-model bug is the root of ~4 of the 12 GM notes ("Enya can't see herself" x2 incl. after re-entry, "map not the same for all players", "Juno on the edge but thinks she's in the middle"). A prior partial fix ("Stansfield's Gas Station" img_scale auto-fit) traded one divergence for another - this spec is to avoid a third round of whack-a-mole.

> All line numbers are `components/TacticalMap.tsx` as of HEAD 2026-05-26; verify before editing.

---

## 1. Symptoms observed (playtest)
- Players (esp. small viewport / Opera) see their PC tokens floating in BLACK to the right of where the map image ends, and the GM saw the same on his screen (screenshot).
- The map renders at a DIFFERENT scale for each viewer - a token at grid cell (56,30) sits at the right edge for the GM but mid-screen for the player.
- Map was LOCKED, so players couldn't pan to find off-screen tokens; even a hard refresh + exit/re-enter did not recover the view.
- Setting a "correct" shared `img_scale` in the DB (0.6958 for Spring Valley) + hard refresh did NOT stick - the client re-auto-fit and tokens stayed in the black.

## 2. Current render model (verified)
- **Viewport** = a scrollable container (`containerRef`) holding an oversized `<canvas>`. Pan = `container.scrollLeft/scrollTop` (973-974). Zoom = `zoom` state applied via `ctx.scale(zoom)` (1086). Canvas sized `max(baseW, baseW*zoom, imgW)` (1072-1073).
- **Grid + tokens** draw at `cellPx`: `getCellSize()` returns `cellPx` only (1045-1046), NO img_scale. `gridW = grid_cols * cellSize` (1060). Tokens at `grid_x * cellSize`.
- **Background image** draws at `naturalWidth * imgScale` x `naturalHeight * imgScale` (1069-1070, 1091-1093), from origin (0,0), same zoom transform.
- **So bg and grid only align when** `naturalWidth * imgScale == grid_cols * cellPx`, i.e. `imgScale == grid_cols*cellPx / naturalWidth`. For Spring Valley: 57*25 / 2048 = **0.6958**.
- **img_scale is NEVER persisted from the normal UI:** `fitToScreen()` (3597-3610) sets `imgScale` LOCAL only (`setImgScale`, no DB write); `fitToMap()` (3587-3595) writes only grid dims. The only writer is the `/tools/rescale-tactical-scenes` maintenance tool. So DB `img_scale` stays `1`.
- **`img_scale == 1` triggers per-client auto-fit** on image load (870): `if (scene.img_scale == null || scene.img_scale === 1) ... setImgScale(containerW / naturalWidth)`. Runs for GM AND players. Each fits the bg to its OWN container width -> bg renders narrower than the grid -> high-column tokens fall off the bg into black.
- **The auto-fit clobbers any DB value:** the bg-image effect deps are `[scene?.background_url]` only (878); `loadScenes` applies `active.img_scale` when `!== 1` (682), but the stale-closure onload re-runs the `=== 1` auto-fit branch and overrides it. This is why the DB stopgap didn't stick.
- **Center-on-open** `centerViewport()` (818-830): `setTimeout(0)` then `frameViewportOnTokens(...)`; runs once per scene (`centeredSceneIdRef`, 837/872). Races the `setImgScale` resize, lands wrong, never retries.
- **Lock:** `mapLocked` (261/265). `willStartPan: !mapLocked` (3142); pan gated on `!mapLocked` (3151) and GM pan also `isGM && !mapLocked` (1089). So a locked map blocks scroll/pan for EVERYONE including the GM -> a mis-centered viewer is stranded.
- **Existing viewport primitives (reusable):** `scrollCellIntoView(container, canvas, gx, gy, cellSize, zoom)` (727); GM `tactical_zoom` broadcast snaps players (782-787); Share View pushes scroll+zoom+imgScale one-shot (791-802).

## 3. Root cause (one sentence)
`img_scale` is doing **two unrelated jobs** - the SHARED image-to-grid relationship (must be identical for everyone) AND the PER-CLIENT viewport fit (must adapt to each window) - it is never persisted, and the value `1` is overloaded to mean both "unset/default" and "100%", so every client silently re-fits the background to its own window and decouples the map from the grid differently for each person.

## 4. Corrected model (separate the two concerns)
- **(A) Image-to-grid scale = SHARED + authoritative + persisted.** The relationship between the background image and the grid is a property of the SCENE, identical for all viewers. Render the bg at this scale for everyone; NEVER per-client auto-fit it.
- **(B) Per-client viewport fit = ZOOM + scroll (already local).** Each viewer fits the whole composite (bg+grid+tokens, locked together) into their own window via `zoom` + container scroll. This is inherently per-client, preserves alignment, and already has GM-broadcast + Share View plumbing.
- **Result:** a token at cell (56,30) is at the right edge of the map for EVERYONE; small windows just see it zoomed out or scroll to it - they never see it in dead black space.

### 4.1 Fix the overloaded `1`
Stop treating `img_scale === 1` as "auto-fit me". Options (HP/Xero pick - see Open Questions):
- **Preferred:** make the scale column nullable; `NULL` = "unset, compute once and PERSIST", a number = "this is the shared scale". On first GM load of an unset scene, compute the fit-to-grid scale (`grid_cols*cellPx / naturalWidth`) ONCE and write it back; thereafter all clients read the stored number and nobody auto-fits.
- Alternative: keep `img_scale` numeric but add a `scale_locked`/`scale_set` boolean; auto-fit only when `!scale_set`, and persist + set the flag on first compute.

### 4.2 Kill the per-client auto-fit + stale closure
- Remove the `setImgScale(containerW/naturalWidth)` branch at 862-867 (the thing that makes the bg per-client). Background always renders at the shared stored scale.
- The bg-image effect must read the CURRENT scene scale (fix the `[scene?.background_url]`-only deps / stale closure, 878) - or, once auto-fit is gone, there's nothing left to clobber the DB value.

### 4.3 Per-client fit on scene open (replaces what auto-fit was wrongly doing)
- On scene open, compute an initial `zoom` so the full composite fits the viewer's container: `zoom = min(containerW / gridW, containerH / gridH)` (clamped to a sane min/max), LOCAL only, no DB write, no broadcast. This is what "fit to my screen" should have always been - zoom, not image rescale.
- Then frame on PC tokens (4.4).

### 4.4 Center/frame after layout settles (fix the race)
- With per-client rescale gone, the `setTimeout(0)` race disappears, but make framing robust anyway: frame on the PC-token centroid via `scrollCellIntoView` / `frameViewportOnTokens` AFTER the bg image has loaded and the fit-zoom is applied (a layout effect keyed on bgLoadTick + zoom, not a bare `setTimeout(0)`).
- Don't let `centeredSceneIdRef` permanently block a retry if the first attempt ran before the container had real dimensions.

### 4.5 A locked map must NEVER strand a viewer
- Lock should prevent ACCIDENTAL free-pan, not trap the viewport. Even when `mapLocked`, always allow PROGRAMMATIC recenter: keep a "center on my token" affordance for players (a button, and/or auto-recenter on scene-activate / when the player's PC token appears or moves) that calls `scrollCellIntoView` regardless of lock.
- Acceptance: with the map locked, a player who opens the scene is auto-centered on their PC and can re-center on demand; they are never looking at empty space they can't leave.

## 5. Concrete change checklist (HP)
- [x] Schema: WRITTEN (Puffer) - `sql/tactical-scenes-scale-sentinel-2026-05-26.sql`: `img_scale` made nullable (NULL = unset sentinel), literal-`1` backfilled to NULL, + `natural_w`/`natural_h` columns. Backward-compatible (current client treats NULL == 1), safe to land before the client change. **PENDING live apply - Xero's go (bright line).**
- [ ] `TacticalMap.tsx`: remove per-client bg auto-fit (862-867); render bg at the shared stored scale always.
- [ ] First-load compute+persist of the fit-to-grid scale for unset scenes (GM client writes it once).
- [ ] Scene-open initial fit via `zoom` (4.3), local only.
- [ ] Robust post-load centroid framing (4.4); de-flake `centeredSceneIdRef`.
- [ ] Locked-map "center on my token" + player auto-recenter (4.5).
- [ ] Keep Share View / `tactical_zoom` working (they push zoom+scroll, which is now the correct per-client knob).

## 6. Migration for existing scenes (Puffer owns the SQL)
**Migration is WRITTEN: `sql/tactical-scenes-scale-sentinel-2026-05-26.sql` (nullable approach + natural dims). Pending Xero's apply.** Every existing scene currently has `img_scale = 1` (overloaded "unset"). Migration:
- If going nullable: set scale `= NULL` for scenes that still have the literal default `1` so they recompute-and-persist on next GM load. (Scenes with a deliberate non-1 value from the rescale tool keep it.)
- OR backfill the computed `grid_cols*cellPx / naturalWidth` per scene - requires each background's natural dimensions. Storing `natural_w`/`natural_h` on the scene at upload/first-load makes rendering fully deterministic and is worth considering (avoids fetching the image to know its size).
- Spring Valley (`0c2ddae8`) reference value = 0.6958; do NOT hand-set per scene - the first-load compute should handle all of them once the code lands.

## 7. Two-client test plan (must pass before next playtest)
1. GM + player (different window widths, ideally one narrow/Opera) open the same scene with a background + tokens near the right/bottom grid edges.
2. Both see the bg fill the grid; a token at the far-right column is on the map (right edge), not in black, for BOTH.
3. Both see the SAME composite (token-over-map-feature alignment identical); only zoom/scroll differ.
4. Lock the map: the player is still centered on their PC and can re-center; never stranded.
5. Resize the player's window: bg-to-grid alignment stays correct (no per-client rescale divergence).
6. GM Share View: player's scroll+zoom snaps to GM's; still aligned.
7. Reload both: identical result (no auto-fit clobber).

## 8. Open questions (HP / Xero)
1. Scale column: nullable vs `scale_set` flag? (Puffer leans nullable - cleaner sentinel.)
2. Store `natural_w/h` on the scene for deterministic rendering, or compute from the loaded image each time? (Storing is more robust.)
3. Default fit policy when a scene is unset: fit image-to-grid-width (image fills the grid horizontally) - confirm that's the intended GM setup semantics.
4. Is the `/tools/rescale-tactical-scenes` tool now redundant once first-load-persist lands, or kept as an override?

## 9. Cross-lane notes
- Schema + migration = **Puffer** (this lane). `TacticalMap.tsx` render code = **Hunt & Peck**. Coordinate the schema change before the client change so HP isn't blocked.
- E2E: a tactical-map render regression spec is hard (canvas), but a 2-client REST/DOM assertion that the scene scale is persisted + identical across clients is feasible - route to Playwright after the fix.
