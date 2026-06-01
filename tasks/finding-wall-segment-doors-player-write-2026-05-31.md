# Finding - Wall-segment doors silently no-op for players (LoS desync at the table)

**Lane:** routed to **Hunt & Peck**.
**Severity:** **HIGH for fair-play.** This is a real cross-client
state-desync bug that bit at the table on 2026-05-31 and Xero called
out as a recurring issue ("we have been over this before"). It does
NOT crash combat - it produces silent visibility unfairness between
players (one player can see through a door they "opened"; the others
still see fog).

## Trigger

2026-05-31 playtest. Xero (GM) recovered note:

> "doors/lines of vision are working. we have been over this before but
>  when a player opens a door, everyone should be able to see what's in
>  there, if they are in line of sight. we had one char open a door and
>  they could see things the char next to them could not."

## What's actually broken (root cause)

The codebase has TWO door authoring paths:

1. **Object-token doors** (whole-cell, legacy) -
   [components/TacticalMap.tsx:3070-3084](components/TacticalMap.tsx:3070).
   When a player clicks one of these, the code:
   - Updates local mirror (`setTokens(...)`)
   - **Calls `updateToken(tok.id, { door_open: nextOpen })`** -> DB write fires.
   - Broadcasts `token_changed` on the tactical channel.
   - `scene_tokens` IS in `supabase_realtime` publication.
   - **Result: other clients see the door open. Works.**

2. **Wall-segment doors** (cell-edge, the toolbar's Door tool, modern
   authoring path) -
   [components/TacticalMap.tsx:2748-2789](components/TacticalMap.tsx:2748).
   When a player clicks one of these, the code:
   - Updates local mirror (`setWallsLocal(...)`).
   - Calls `scheduleWallsPersist()`.
   - **`scheduleWallsPersist` at line 537 starts with `if (!scene || !isGM) return`.**
   - **DB write NEVER FIRES** for non-GM clients.
   - The opener sees the door open (local mirror is correct).
   - Every other client - including the GM viewing the same scene -
     still sees the door closed because nothing was persisted to
     `tactical_scenes.walls` for postgres_changes to fan out.

So the bug is: **wall-segment door toggles are silently dropped for any
player who isn't the GM.** The visible behavior matches what Xero
described exactly: one PC opens a door, sees through it; the PC next to
them (different client) doesn't, because their local mirror still has
the door closed.

This is a `tactical_scenes.walls` JSON column write gated by an
`isGM` check that predates the player-door-toggle feature. The gate was
correct when only the GM authored walls; it's wrong now that gameplay
includes player-driven door opens/closes via the segment path.

## Fix shape (two routes, recommend B)

### Route A: drop the `isGM` gate in `scheduleWallsPersist`

[components/TacticalMap.tsx:537](components/TacticalMap.tsx:537):

```ts
function scheduleWallsPersist() {
  if (!scene || !isGM) return       // <- this line
  ...
}
```

Simplest fix. Drop `|| !isGM` and let players write to
`tactical_scenes.walls`. But this opens RLS questions: does the RLS
policy on `tactical_scenes` allow non-GM members to UPDATE the `walls`
JSONB column? If yes, ship A. If no, RLS blocks the write silently and
we're back where we started (with a different silent failure).

### Route B (recommended): server-side door-toggle RPC

Add a new SECURITY DEFINER RPC `toggle_wall_segment_door(p_scene_id,
p_segment_id, p_open)`:
- Validates the caller is a member of the scene's campaign (campaign
  membership check, not GM-only).
- Read-modify-write the `walls` JSON column: find the segment by id,
  set `door_open: p_open`.
- Returns the new state.
- The walls JSON is small (max a few hundred segments per scene), so
  read-modify-write in a single statement is fine. Use `jsonb_set` if
  you want to do it without parsing.

Then in `scheduleWallsPersist`:
- Keep the existing GM bulk-persist path for wall AUTHORING (the GM
  draws walls in edit mode, those go through the full `updateScene`).
- For door TOGGLES specifically (the click-handler at :2769-2787), call
  the new RPC instead of touching the bulk persist. Players can toggle
  doors via the RPC even if they can't write the whole walls array.

This mirrors the exact pattern Puffer just used for `gm_apply_damage`
(SECURITY DEFINER + scoped authz check). Same security envelope.

### Bonus catch: window-segment toggles have the same bug

`scheduleWallsPersist` is called for both door AND window segment
toggles (same code path at :2769-2787 toggles either kind). Windows
have the same player-can't-toggle bug. Whatever fix lands for doors
must cover windows too - same RPC, same call sites.

## Why this is recurring

Per Xero's "we have been over this before" line - this exact bug
class (silent player-write rejection) bites every time a feature gets
added that mixes player gameplay with GM-authored data. The pattern to
break it: any door/wall/window state that gameplay modifies needs an
RPC, not a direct table UPDATE. Adding to lessons.md once the fix
lands so future features don't repeat the path.

## Acceptance

- Player clicks a wall-segment door. DB row in `tactical_scenes.walls`
  for that segment flips `door_open`. Postgres_changes event fires.
- A second client (GM, or another player) sees the door open in their
  view without a refresh, within the usual realtime latency (~500ms).
- LoS sweep on every client picks up the open door and clears fog
  through the opening for every PC in line of sight - same as it would
  if the GM had opened it.
- Window-segment toggles work identically for players.
- GM bulk-authoring of walls (the edit-mode draw-a-wall flow) keeps
  working unchanged.
- RLS test: a player who is NOT a member of the campaign cannot toggle
  doors in that campaign's scenes. Verify via spec or manual test.
- Build + 822 unit tests + font/role/em-dash/arch all green.

## Tracking

Append to `tasks/todo.md` CURRENT OPEN as a **HIGH priority** item
(player-fairness bug, ships before the polish items):

```
- [ ] **[ROUTED -> HUNT & PECK 2026-05-31][HIGH] wall-segment door toggles silently no-op for players** - LoS desync between clients during play. Root cause: `components/TacticalMap.tsx:537` `scheduleWallsPersist` gates DB write on `isGM`. Player door-clicks update local mirror only; no DB write, no realtime fan-out, other clients still see door closed. Fix: SECURITY DEFINER `toggle_wall_segment_door` RPC (mirror `gm_apply_damage` pattern) + route player click-handlers at `:2769-2787` through it. Window-segment toggles have same bug - same fix covers both. Finding: `tasks/finding-wall-segment-doors-player-write-2026-05-31.md`.
```
