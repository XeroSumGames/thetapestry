# Multi-Cell Token LoS — Test Plan

**Shipped:** 2026-05-10 (`8ac4ae2`)
**Surface:** `components/TacticalMap.tsx:1447`
**Change:** Token-visibility filter now scans the full `grid_w × grid_h`
footprint instead of only the anchor cell. A token is visible to a
non-GM viewer iff ANY of its cells is unfogged.

## Pre-flight

- Load any campaign with a tactical scene that has at least one wall.
- Have a PC token on the map.
- Open the scene as a **non-GM** viewer (a player account, or GM view
  toggled to player-perspective if you have that wired). LoS gating
  does not apply to the GM — everything draws regardless.

## Scenarios

### 1. Anchor hidden, body exposed (the headline fix)

- Drop a 2×2 vehicle (or any object with `grid_w=2, grid_h=2`).
- Position it so the **top-left cell is behind a wall** and the other
  three cells are in the PC's line of sight.
- **Expected (post-fix):** vehicle renders. Before the fix it would
  have vanished entirely because anchor was fogged.

### 2. Anchor exposed, body hidden

- Same vehicle, flipped: top-left cell in PC view, the other three
  cells behind the wall.
- **Expected:** vehicle renders. (This case worked before the fix too
  — it's a regression check, not a new behavior.)
- Note: parts of the sprite behind the wall will be dimmed by the
  35% fog overlay. Pixel-perfect occlusion is a separate cosmetic
  task (polygon vision mask).

### 3. Fully hidden

- Move the vehicle so all four cells are behind walls / outside any
  PC's vision.
- **Expected:** vehicle disappears entirely for the non-GM viewer.

### 4. 1×1 regression check

- Drop a regular NPC token (1×1 footprint).
- Walk it across a wall boundary.
- **Expected:** appears/disappears at the wall edge exactly as it
  did before this commit. The 1×1 fast path in the filter is wired
  to behave identically.

### 5. Mixed-size scene sanity

- Scene with PCs, 1×1 NPCs, 1×1 objects, and at least one 2×2 object,
  all near walls.
- **Expected:** every token's visibility matches "is any of my cells
  in the unfogged set?" No flickering during PC movement other than
  the natural reveal/hide as walls clear or block.

## Performance sanity (optional)

- Open a scene with many tokens (20+) and at least one wall.
- The filter cost is at most `gw × gh` lookups per token, which is
  trivial. No perceptible render lag should appear vs. main.

## If something breaks

- A token that should be visible isn't → check whether any cell in
  its footprint is actually unfogged in `fogMap`. The auto-fog pass
  earlier in the render is the source of truth; the filter is just
  reading from it.
- A token that should be hidden is rendering → check `grid_w`,
  `grid_h` on the token row. If they're null/undefined the fallback
  is 1×1; if they're set wrong (e.g. `grid_w: 5` for a normal NPC)
  the scan reaches into cells the token doesn't actually occupy.
