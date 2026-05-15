# A4 TacticalMap perf audit — 2026-05-14

## Finding 1: 29-dep `draw()` useEffect

**Verdict: SKIPPED-AS-WRONG**

Every dependency in the 29-dep array was verified to drive draw output:

- `dragging` — line 1480: `const isBeingDragged = dragging?.tokenId === t.id && dragPosRef.current`. Controls whether a token is rendered at cursor position or grid position. Without this dep, drag-start and drag-end would not trigger redraws that switch the token between ghost and snapped positions.
- `fogEditMode` — lines 1250, 1406, 1418: gates the vision punch-through computation; changes fog fill opacity (editing = 0.35, playing = 1.0); shows/hides cell-boundary outlines in edit mode.
- `fogRectStart`/`fogRectEnd` — lines 2235–2242: draws the rectangle marquee preview while the GM is dragging the rect-fog tool.
- `wallDrawStart`/`wallDrawHover` — lines 2166–2198: draws the live dashed preview segment and endpoint dots while the GM is placing a wall/door/window.
- `wallRectStart`/`wallRectEnd` — lines 2210–2228: draws the rect-wall marquee preview.

The audit's "non-visual" premise is incorrect for this component. No win available without changing visuals.

---

## Finding 2: O(n²) cell-iteration loops

**Verdict: SHIPPED**  
**Commit:** `c5041e5` (branch `perf/tactical-map-canvas`)  
**Post-edit lines:** refs ~387–394, move-zone ~1082–1100, throw-zone ~1117–1138, blast ~1154–1175

**Cache invalidation strategy:**

| Cache | Ref | Key inputs |
|---|---|---|
| Move-zone | `moveZoneCacheRef` | mover grid pos, moveCells, grid dims, occupied cell set |
| Throw-zone | `throwZoneCacheRef` | thrower grid pos, rangeCells, grid dims |
| Blast preview | `blastZoneCacheRef` | hover cell, engagedCells, closeCells, grid dims |

All three: key computed inline at draw time, stored alongside cached array. Miss → full iteration + store. Hit → skip iteration, draw cached cells only. Blast preview additionally batches both fill colors (all red cells → all amber cells) instead of per-cell `fillStyle` changes.

---

## Finding 3: Fog visibility bitmap

**Verdict: SHIPPED**  
**Commit:** `ab7e0c9` (branch `perf/tactical-map-canvas`)  
**Post-edit lines:** ref ~392–393, fog sweep ~1356–1404

**Cache invalidation strategy:**

`fogVisibleCacheRef` holds `{ key: string; visible: Set<string> }`. Key encodes: `isDay`, `dayRadius`, all PC token `(grid_x, grid_y, sight_radius_cells, grid_w, grid_h)`, all vision-blocking segment coordinates `(x1,y1,x2,y2)`, and sorted cell-blocker strings from wall/door object tokens.

Key changes only when: a PC token moves, a door/window opens or closes, a wall segment is added/removed, or scene lighting mode flips (`day`/`night`). All other `draw()` triggers (animation rAF loop at 60fps, ping pulse, zoom, fog paint, token selection) are cache hits and skip the LoS sweep entirely.

On a 20×20 scene with 4 PCs in day mode: ~6700 LoS computations/frame eliminated on cache hit. Each check previously scanned up to ~20 wall segments + a Bresenham walk.

---

## New findings (flag for follow-up — do NOT fix here)

1. ~~**`effective` fog map also O(n²)**~~ — **SHIPPED 2026-05-15** (`e83514b`). Cached behind `visKey + painted-fog hash + grid dims + hasPCs/hasBlockers`. Same shape as `fogVisibleCacheRef`.

2. **`getWeaponByName` called in draw()** — lines 1177/1184: weapon lookup on every draw that has `showRangeOverlay && selectedToken`. Cheap but could be memoized to a ref, invalidated on `selectedToken` or `entries`/`campaignNpcs` change.

3. **ResizeObserver calls `draw()` directly** — line 956: `ro.observe` callback fires `draw()` synchronously, bypassing the rAF coalescing. Low priority.

---

## Smoke-test plan

1. **Token move mode** — click Move on a PC, verify green highlight renders on the map. Move the token; confirm highlight clears and updates correctly on new position.
2. **Throw mode** — trigger grenade throw; confirm orange range highlight appears. Hover over cells; confirm Engaged (red) and Close (amber) blast rings follow the cursor. Commit the throw; confirm rings disappear.
3. **Fog reveal** — GM paints fog over several cells. Players see solid black. Open a door; confirm LoS through the opening clears fog along the revealed path. Switch scene to Night mode; confirm each PC's visible radius shrinks to their `sight_radius_cells` value.
4. **Drag ghost** — drag a PC token; confirm it follows the cursor smoothly and snaps to the destination cell on mouseup. Drag with no movement on a door; confirm toggle (not a move).
5. **In-flight rect previews** — in fog edit mode, drag a rect-fog marquee; confirm dashed rectangle outline renders during drag and disappears on mouseup. Same for wall-rect mode.
6. **Animation loop** — trigger a token move animation; confirm the token slides smoothly and other overlays (fog, move zone if active) remain stable during the rAF frames.
