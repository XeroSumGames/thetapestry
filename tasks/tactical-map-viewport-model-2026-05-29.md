# Tactical-Map Viewport Model - design spec for Hunt & Peck

**Author:** Puffer Fish (design, after a vision dialogue with Xero 2026-05-29). **For:** Hunt & Peck (`components/TacticalMap.tsx`, `lib/tactical-view.ts`). **Serves:** north-star #1 (reliable core table loop, KS-ready). **Supersedes** the viewport sections (4.3/4.5) of `tactical-map-render-fix-spec-2026-05-26.md` now that HP's bg-locked-to-grid rework shipped.

## Where we are (verified)
- GOOD + DONE: the bg is locked to the grid (bg covers `grid_cols*cell_px x grid_rows*cell_px`; grid_cols/cell_px shared in DB). So art + grid + tokens are ONE composite with a FIXED cell-to-art ratio cross-client. That part works.
- The chrome is UNIFORM: left feed panel `260px` + right asset panel `240px`, both fixed + role-agnostic (`isGM`/`gmLike` change only the content inside, not the widths). Center map = `flex:1` = window - 500. So at equal window width, GM + player get an identical map column. (Earlier "different chrome" hypothesis was WRONG - disproven.)
- TWO real problems remain:
  1. **Different SIZE/ratio at the same nominal window:** scale is derived from each client's column width - `effectiveScale(containerWidth, gridW, zoom) = (containerWidth/gridW)*zoom` (`tactical-view.ts:152`). So ANY width difference (browser zoom, OS scaling, real window size) makes the map a different size. Fragile by construction.
  2. **Tokens silently leave a player's view:** the follow (`TacticalMap.tsx:697-700`) scrolls a token into view only when it newly APPEARS; a token that MOVES triggers no follow, and pan is independent - so a GM-moved/edge token (e.g. "Mikey") drops off the player's screen.

## The model (Xero-approved): ONE shared map, INDEPENDENT windows, SMART follow
NOT a forced mirror (rejected - too rigid). Three independent properties:

### 1. Scale from the SHARED grid metric, not the local panel width
- Render at a shared absolute cell size (a fixed base px-per-cell) x the client's LOCAL zoom - do NOT derive the base scale from `containerWidth`. So at the same zoom, a cell is the same size on every screen, and the map is the same size + ratio for everyone; each window just shows as much as fits (scroll/zoom for the rest).
- On scene open, set each client's LOCAL default zoom to "fit the whole map in my window" (so everyone sees the whole map regardless of window size), centered on the party. That fit is a per-client DEFAULT ZOOM, not a change to the shared cell metric.
- Net: identical-window clients render pixel-identical; different-window clients see a bigger/smaller window onto the same-sized map (normal + fine). Removes the zoom/window fragility entirely.

### 2. Pan + zoom are LOCAL and independent
- Each client freely scrolls (pan) + adjusts its local zoom slider. Never broadcast, never forced. Moving your own view affects ONLY you. (Largely true post-rework; keep it.)

### 3. Smart follow + recenter (anti-"lost token", without a mirror)
- **Auto-follow on MOVE** (the missing piece): when a token's `grid_x/grid_y` changes, if it is the ACTIVE combatant (whose turn it is) OR the viewing player's OWN PC, `scrollCellIntoView` it for that client when it's (about to be) off-screen. Extend the existing appear-follow (`697-700`) to also fire on MOVE (diff prev vs new position). Scope it to active/own token - do NOT yank the view for unrelated token moves.
- **One-tap "Recenter":** the player's existing "CENTER" button should recenter on the player's own PC (or the active token in combat), not just geometric map center.
- **GM "Share View" / ping:** keep as the on-demand "everyone look here" (already one-shot, `760-771`) - the GM's deliberate attention pull, never automatic.

## Behavior table (what each action does)
| Action | Result |
|---|---|
| Player pans/zooms their view | LOCAL only - nobody else moves |
| GM pans/zooms their view | GM only - players NOT pulled (unless GM hits Share View) |
| GM moves a token | Broadcasts; each client auto-follows IFF it's the active / that player's own token; otherwise their view is undisturbed |
| Scene open | Each client fits the whole map to its window (local default zoom), centered on the party |
| GM hits "Share View" | One-shot push of the GM's scroll+zoom to players (deliberate "look here") |

## Code touch-points (HP)
- `lib/tactical-view.ts:152` `effectiveScale` - stop deriving the base from `containerWidth`; use a shared base cell size x local zoom. (Keep one helper driving BOTH draw + pointer<->cell math so they can't drift, as now.)
- Scene-open default zoom = fit-whole-map-to-window (per client), centered on party (the existing `centerViewport`/`frameViewportOnTokens` at `795-839` is the seam).
- `TacticalMap.tsx:697-700` - extend the appeared-token follow to fire on MOVE for the active combatant + the viewer's own PC.
- The "CENTER" button -> recenter on own/active token.
- Leave Share View (`760-771`) as-is.

## Acceptance (the 2-client gate, updated)
Run `tasks/tactical-map-verify-2client-testplan-2026-05-27.md` PLUS:
- Same-window-size GM + player -> map renders at the SAME size (no "different ratios").
- Token MOVE -> stays visible for the active combatant + the owning player (no "Mikey disappeared").
- A player panning/zooming does NOT move the GM's or another player's view.
- Different-window-size clients -> same map, just a bigger/smaller window (acceptable).
Puffer demotes the TacticalMap Risk Register entry to GREEN when this passes on 2 live clients.

## Lane
App code (`TacticalMap.tsx` + `tactical-view.ts`) = **Hunt & Peck**. The scale-metric + same-size assertions are E2E-automatable (data layer); the visual/pixel checks stay manual (canvas). Puffer owns this spec + the gate + the risk demote.
