# Spec — Tactical Map Vision System

**Goal:** Bring the tactical map up to "atmospheric exploration" UX — GMs control what players see, doors block movement, and (eventually, after play feedback) full LoS with walls.

**Status:** Phase 1 in progress.

---

## Why this matters

The current tactical map is "all visible, all the time." There's no way to model dungeons or "we don't know what's around the corner" tension. We start cheap (GM-painted fog) and only commit to the heavy LoS engine if real play surfaces the need.

---

## Three phases — staged, real-play-gated

### Phase 1 — GM-painted fog (1-2 days) ← shipping now
- New `tactical_scenes.fog_state` jsonb. Sparse map keyed by `"x,y"` for fogged cells.
- GM toolbar: "Edit Fog" toggle. Two sub-tools — Paint (drag to add fog) + Erase (drag to clear).
- Render: fogged cells are dark over the background; tokens inside fog are hidden from players entirely.
- GM sees fogged cells dimmed but still inspectable (so they know what's hidden).
- Bulk: "Fog all" + "Clear all" buttons.
- No per-token sight, no walls, no LoS math. Pure atmosphere control.
- This unlocks: "the dungeon is dark; I clear cells as you explore" — the dominant TTRPG workflow.

### Phase 2 — Doors as object tokens (1-2 days)
- New object token kind: `door`. Same scene_tokens row but with `object_type='door'` and `is_open: boolean` on its properties.
- Visual: closed door = solid line across two adjacent cells, 🚪 chip; open door = dashed line, no chip.
- Click a door token → toggle is_open.
- Closed doors block movement (Chebyshev pathfinding treats them as wall-edges).
- No automatic LoS impact in v2 — doors are visible-but-blocking. Pairs naturally with painted fog (closed doors stay visible at the edge of cleared regions, telegraphing "there's something past this").
- `locked` flag deferred to v3+.

### Phase 3 — Walls + dynamic LoS + per-token sight (1-2 weeks)
**Punted.** Will only commit to this after Phase 1+2 see real play and a real workflow gap surfaces. Real signals to revisit:
- Players asking "why does fog reveal automatically as I walk?" (sight radius)
- GMs hand-painting around walls every session (build walls + auto-LoS)
- The painted-fog workflow feels like "GM doing tedious bookkeeping" rather than narrative control

When/if we revisit, the design lives in the appendix below for reference.

---

## Phase 1 details — what's actually getting built now

### Schema

```sql
ALTER TABLE tactical_scenes
  ADD COLUMN IF NOT EXISTS fog_state jsonb DEFAULT '{}'::jsonb;
```

`fog_state` is `{ "x,y": true }` — sparse, only fogged cells stored. Empty = no fog (default).

### UI

**Scene control bar (GM only):**
- New "🌫️ Fog" toggle button. Opens fog edit mode.
- When in fog edit mode:
  - "Paint" / "Erase" sub-tool buttons (radio).
  - "Fog All" + "Clear All" bulk buttons.
  - "Done" to exit edit mode.

**TacticalMap interaction:**
- Outside fog edit mode: clicks behave normally (token selection, movement, etc.).
- Inside fog edit mode: pointer-down + drag paints/erases. Existing token interactions disabled until "Done" is clicked.
- Real-time persistence: each cell flip writes the new fog_state to tactical_scenes on a 300ms debounce.

**Player view:**
- Fogged cell renders as a near-opaque dark layer (`rgba(0,0,0,0.92)`) over the background tile.
- Any token whose grid_x/grid_y is in a fogged cell is hidden from the player render.
- Combat initiative entries belonging to hidden tokens stay in the initiative tracker (the GM can still address them by name) but the token visual is suppressed on the map.

**GM view:**
- Fogged cells render dimmed (`rgba(0,0,0,0.35)`) — visible enough to inspect; clearly marked as "hidden from players."
- Tokens inside fog still render at full opacity for the GM with a small `🌫️` marker.

### Persistence

- Single `tactical_scenes.fog_state` jsonb update on every paint/erase (debounced to 300ms).
- Realtime channel that already broadcasts `tactical_scenes` updates picks up fog changes for any other player viewing the scene.

---

## Out of scope for Phase 1

- Per-cell partial-opacity (just on/off).
- Multiple fog layers (just one).
- Fog "memory" (once cleared, stays cleared until GM repaints — there's no auto-refog).
- Sight radius / LoS computation.
- Walls.

---

## Appendix — Phase 3 design (deferred reference only)

(Original full LoS spec preserved here so we don't have to redesign it from scratch when/if we revisit.)

### Walls + LoS data shapes
```ts
interface Wall {
  id: string
  segments: [number, number][]  // polyline endpoints
  door: boolean
  is_open: boolean
  locked: boolean
}
```

### Algorithm sketch
- Visibility polygon via angular-sweep using wall endpoints as event points
- Per-token sight radius from `scene_tokens.sight_radius_cells`
- Fog overlay = scene minus union of token visibility polygons
- Memory mode: per-user `scene_visibility.ever_seen_cells` jsonb; cells previously visible render at half-opacity fog when not currently visible

### When to revisit
After Phases 1 + 2 have been used in 3+ live sessions and a clear gap is named.
