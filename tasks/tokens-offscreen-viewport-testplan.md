# Test plan - P1 "character tokens won't appear on the map" (REAL root cause)

Date: 2026-05-25
Lane: Hunt & Peck
Severity: P1 / catastrophic

## What was actually wrong (NOT the fog toolbar)
Live DB confirmed the tokens were correct all along: on the active scene
"Spring Valley RV & Storage" the three PCs (Enya 1,1 / Juno 3,1 / Shimmy 5,1)
are present, non-archived, is_visible=true, and the GM render draws every token
unconditionally. So the rows exist and SHOULD draw.

The bug is the VIEWPORT. `centerViewport()` scrolled the map container to the
geometric MIDDLE of the (large) canvas on scene open. Tokens spawn at the
LOCKED top-left anchor (1,1) - canvas pixel ~(37,37) - which is scrolled off
the top-left edge of a middle-centered viewport. So freshly-placed tokens land
in a corner the view never shows. (This is why Shimmy was visible earlier at
center grid (32,22) but invisible now at (5,1): the cluster moved into the
unseen corner.)

## The fix
1. **Scene-open framing** now centers on the tokens' centroid when the scene
   has tokens (falls back to map middle for an empty scene). So opening a scene
   with tokens shows them.
2. **Live placement** (the actual interaction): when a token APPEARS mid-session
   - GM clicks the player-bar "Map" button, or un-archives one - the map
   smooth-scrolls that token into view (prefers a PC). Pure scroll/centroid math
   is in lib/tactical-view.ts with unit tests; moves/removes never steal scroll.

## Steps (live - thetapestry.distemperverse.com, as GM)
Campaign "Minnie & The Magnificent Mongrels", scene "Spring Valley RV & Storage".

1. Open the table page and the Tactical Map. CONFIRM: you now SEE the three PC
   tokens (Enya, Juno, Shimmy) - the view should frame on them (top-left area),
   not the empty middle of the map.
2. In the player bar, click "Map" to REMOVE a PC (e.g. Shimmy), then click "Map"
   again to ADD it back. CONFIRM: the map smooth-scrolls so the re-added token
   is centered/visible - you do NOT have to hunt for it in the corner.
3. Add a different character to the map via "Map". CONFIRM the view scrolls to
   the newly placed token and you can see it immediately.
4. Drag a token around. CONFIRM the view does NOT jump (only APPEARING tokens
   scroll the view, not moves).
5. Remove a token via "Map". CONFIRM the view does NOT jump on removal.
6. Switch to another scene (Tactical Map dropdown) and back. CONFIRM each scene
   frames on its own tokens on open.

## If tokens STILL don't appear after this
Then the diagnosis is wrong and I need to see your screen: tell me (a) is the
map SCROLLED such that the top-left corner is hidden? (b) after you click Map,
does the view move at all? (c) what's in the top-left corner of the map area?
The DB rows are confirmed correct, so any remaining issue is purely what the
canvas/scroll is showing.

## Automated
- lib/tactical-view.ts: tokenCentroidCell + centerScrollOnCell - 8 new unit tests.
- `npx vitest run tests/lib/tactical-view.test.ts` - 15 pass.
- `npx tsc --noEmit` clean; check-arch green (math+glue extracted to lib so the
  ratcheted TacticalMap stayed at baseline); font/role/em-dash green.
