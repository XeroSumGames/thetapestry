# Test plan - fog toolbar occlusion / map tokens hidden top-left

Date: 2026-05-25
Lane: Hunt & Peck
Change: fog/lighting toolbar default position moved from the top-left corner
(8,8) to a computed TOP-CENTER, so it no longer sits on top of the locked
(1,1) token spawn anchor and hide the PCs' tokens behind it.

Files touched:
- components/TacticalMap.tsx - centering callback ref, reset target, reset-button check
- lib/tactical-spawn.ts - new pure helper `centeredToolbarX(contW, barW, rightReserve)`
- tests/lib/tactical-spawn.test.ts - 4 new tests for the helper

## What "fixed" looks like
The fog/lighting toolbar (🌞 Day / 🌫️ Edit Fog) now opens centered across the
top of the map instead of jammed in the top-left corner. Tokens that spawn at
the top-left anchor (1,1), (3,1), (5,1)... are no longer hidden underneath it.

## IMPORTANT first step - clear the stale saved position
Existing GMs have a saved toolbar position in localStorage from before this fix.
A saved {8,8} (the old corner default) is auto-migrated to center - you should
NOT have to do anything. But if the toolbar still opens in the corner after the
deploy, it means you previously DRAGGED it there (a deliberate non-corner save is
respected). To force the new default:
  - Option A: drag the toolbar by its ⠿ handle, then click the ↺ reset button
    that appears - it now snaps to top-center.
  - Option B (hard reset): open DevTools console on the table page and run
    `localStorage.removeItem('fog_bar_pos_cc766e7f-04de-4d09-a497-ce6c8e21b53d')`
    then refresh.

## Steps (live - thetapestry.distemperverse.com)
1. Open the campaign "Minnie & The Magnificent Mongrels" table page as GM.
2. Open the TACTICAL MAP for the active scene "Spring Valley RV & Storage".
3. CONFIRM: the 🌞 Day / 🌫️ Edit Fog toolbar opens centered across the top of
   the map, NOT in the top-left corner.
4. CONFIRM: Juno (was at grid 3,1) and Enya (was at grid 1,1) tokens are now
   VISIBLE at the top-left of the map instead of hidden. All three PCs
   (Shimmy center, Juno, Enya) should be on the board.
5. Click 🌫️ Edit Fog - the toolbar expands rightward with the paint/wall/door
   controls. CONFIRM it does not cover the top-right zoom slider / 👁 Share View
   on a normal-width window. (On a very narrow window the expanded bar may reach
   toward them - that is expected; drag the bar if it gets in the way.)
6. Drag the toolbar by its ⠿ handle. CONFIRM the ↺ reset button appears, and
   clicking it snaps the toolbar back to top-center (not the corner).
7. Refresh the page. CONFIRM the toolbar stays where you left it (position
   persists per-campaign).

## Map-button knock-on (from the handoff)
8. In the player bar, toggle a character ON the map via the MAP button, then OFF.
   CONFIRM the token appears top-left (visible now, not under the toolbar) and
   the toggle adds/removes cleanly - it should no longer "do nothing" / flip an
   invisible token, because the token is no longer hidden behind the toolbar.

## Regression checks
9. New scene: create a fresh scene, open it. CONFIRM the toolbar centers on it
   too (each campaign computes its center once).
10. Players (non-GM) never see the fog toolbar - unchanged, confirm no toolbar
    shows for a player-role viewer.

## Automated
- `npx vitest run tests/lib/tactical-spawn.test.ts` - 11 pass (incl. 4 new
  centeredToolbarX tests).
- `npx tsc --noEmit` - clean.
