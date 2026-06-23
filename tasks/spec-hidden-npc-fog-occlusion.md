# Spec: Hidden-NPC Fog Occlusion

**Status:** SPEC LOCKED 2026-06-23, ready for Hunt & Peck  
**Todo ref:** PLAYTEST NOTES 2026-06-23 - third item in build order (after loot-bullets, DISARM)  
**Primary file:** `components/TacticalMap.tsx`

---

## What it does

When a GM sets an NPC token to **SHOW** (`is_visible = true`), that token currently renders for ALL players who can see the cell in the union fog (any PC's LoS clears the cell). The feature gates SHOW-token visibility individually: Player A sees the SHOW NPC only if Player A's **own** character's LoS reaches the token's cell.

---

## Current system (how fog works today)

**`pcVisionTokens`** (`TacticalMap.tsx:1397`): filtered to non-object tokens with a `character_id` (for players) or all non-objects (for GM). This is the union of all PCs on the scene.

**`visible` set** (`TacticalMap.tsx:1526`): set of all cells reachable from any PC in `pcVisionTokens`. Used to compute effective fog (cells outside union LoS get fogged).

**Fog filter** (`TacticalMap.tsx:1676`): for each token, if ALL its cells are in `fogMap` (effective fog), it's dropped from the render list for non-GM players.

**is_visible gate** (`TacticalMap.tsx:1697`): `if (!t.is_visible && !isGM) return` - tokens with `is_visible=false` (HIDE) skip rendering for players.

**The gap:** a SHOW NPC in a cell that's unfogged because any PC's LoS reaches it renders for ALL players - even those whose own PC is around a corner. This is fine for map exploration (cooperative vision is the right design) but wrong for hidden-NPC reveals (seeing an enemy should require your own character's LoS).

---

## Implementation plan

### Step 1 - Compute `myVisible` in the fog section

After the existing `visible` set is computed (around line 1562), add a `myVisible` computation:

```typescript
// Per-player LoS for SHOW-token gating (separate from cooperative-vision
// `visible` which drives painted fog + auto-fog). Only computed when
// there are scene blockers AND the current player has a token on the map.
let myVisible: Set<string> | null = null
if (!isGM && hasBlockers && myCharacterIdRef.current) {
  const myTok = tokensRef.current.find(
    t => t.character_id === myCharacterIdRef.current && t.token_type !== 'object'
  )
  if (myTok) {
    myVisible = new Set<string>()
    const isDay = (s.lighting_mode ?? 'day') === 'day'
    const dayRadius = Math.max(s.grid_cols, s.grid_rows)
    const r = isDay ? dayRadius : (myTok.sight_radius_cells ?? VISION_RADIUS_CELLS)
    const gw = myTok.grid_w ?? 1
    const gh = myTok.grid_h ?? 1
    for (let fx = 0; fx < gw; fx++) {
      for (let fy = 0; fy < gh; fy++) {
        const ox = myTok.grid_x + fx
        const oy = myTok.grid_y + fy
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue
            const tx = ox + dx
            const ty = oy + dy
            if (!losBlocked(ox, oy, tx, ty)) myVisible!.add(`${tx},${ty}`)
          }
        }
      }
    }
  }
}
```

### Step 2 - Add the per-player gate in the fog-filter section

In the token filter at line 1676 (the `fogMap` filter), add a second condition:

```typescript
.filter(t => {
  if (isGM) return true
  // Existing fog-map check
  const gw = t.grid_w ?? 1
  const gh = t.grid_h ?? 1
  let inFog = true
  if (gw === 1 && gh === 1) {
    inFog = !!fogMap[`${t.grid_x},${t.grid_y}`]
  } else {
    for (let dx = 0; dx < gw; dx++) {
      for (let dy = 0; dy < gh; dy++) {
        if (!fogMap[`${t.grid_x + dx},${t.grid_y + dy}`]) { inFog = false; break }
      }
      if (!inFog) break
    }
  }
  if (inFog) return false
  // NEW: SHOW NPC gating - only render if THIS player's PC can see the cell
  if (t.is_visible && t.token_type === 'npc' && myVisible !== null) {
    const gw2 = t.grid_w ?? 1
    const gh2 = t.grid_h ?? 1
    let anyVisible = false
    for (let dx = 0; dx < gw2 && !anyVisible; dx++) {
      for (let dy = 0; dy < gh2 && !anyVisible; dy++) {
        if (myVisible.has(`${t.grid_x + dx},${t.grid_y + dy}`)) anyVisible = true
      }
    }
    if (!anyVisible) return false
  }
  return true
})
```

### Step 3 - Cache key for `myVisible`

`myVisible` is recomputed on every drawFrame call along with `visible`. It's gated on the same `hasBlockers` condition. Performance cost: one extra LoS sweep per player per frame (same algorithm, same cell count, same O(r^2) work), but only when blockers exist. Add it to the cache key so the result is memoized alongside the union-LoS cache:

Introduce a `myVisibleCacheRef` analogous to `fogVisibleCacheRef`. Key: `${myTok.grid_x},${myTok.grid_y},${isDay},${r},${segKey},${blockerKey}`.

---

## Scope / non-scope

**In scope:**
- Canvas rendering: token doesn't draw for players who can't individually see it
- Works for single-cell and multi-cell NPC tokens (any unfogged cell in footprint = visible)

**Out of scope (future):**
- Click hit detection for hidden SHOW tokens (they're still in `toks` after the render filter; hit detection would need a parallel filter or the same myVisible check)
- Initiative bar: if a SHOW NPC is in initiative order, it still shows on the init bar for all players. Separate decision.
- Object tokens (`token_type === 'object'`): not gated - objects aren't player-concealed the same way
- Per-player fog exploration (cooperative vision for painted fog / auto-fog stays unchanged)

---

## Edge cases

| Situation | Behavior |
|---|---|
| Player has no token on the scene | `myTok` is null → `myVisible` stays null → guard is skipped → SHOW NPCs visible via union fog only (existing behavior) |
| No scene blockers | `myVisible` is null → guard skipped → SHOW NPCs visible via fogMap only (existing behavior) |
| NPC cell is NOT in fogMap but IS beyond player's LoS | Filter removes it (myVisible miss) |
| NPC cell IS in fogMap (auto-fogged outside union LoS) | Already removed by the fog check before reaching the myVisible check |
| GM view | `isGM` early-return, unaffected |
| Multi-cell NPC straddling a wall | Same ANY-cell logic as current: if any cell of the NPC is in myVisible, the token is visible |
| Night mode | Same as day mode - uses `sight_radius_cells` column per token, respects the scene's lighting_mode |

---

## UX/lighting question this settles

This is the **Individual** answer to the Group/Individual lighting debate:
- Painted fog + auto-fog remains **Group** (cooperative vision, any PC's LoS clears fog for everyone)
- SHOW NPCs are **Individual** (each player sees them only if their own PC has LoS)

The design intent: players share exploration (seeing the map together) but can't meta-game off a teammate's NPC sighting. If Player A spots a hidden enemy, Player B's HUD doesn't reveal it.

---

## Files to touch

- `components/TacticalMap.tsx` - only file changed. Add `myVisible` computation + cache + gate in the fog filter.
- No DB changes needed (uses existing `is_visible`, `token_type`, `grid_x/y`, `sight_radius_cells` columns).
- No new RPC.

---

## Testing

1. Scene with walls authored + 2 players + GM
2. Place NPC hidden around corner from Player A but visible to Player B
3. GM sets NPC to SHOW
4. Player A's screen: NPC not visible (LoS blocked)
5. Player B's screen: NPC visible
6. GM moves NPC into Player A's LoS: now visible to both
7. Remove all walls: `hasBlockers = false` → `myVisible = null` → both players see the SHOW NPC (fallback to union fog, which is the old behavior - acceptable on no-blocker maps)
8. Player A has no token: NPC visible via union fog only (pre-feature behavior preserved)
