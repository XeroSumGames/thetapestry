# Test plan - table page titlebar batch (5 cosmetic changes)

Date: 2026-05-25
Lane: Hunt & Peck
File: app/stories/[id]/table/page.tsx (header region)

## What changed
1. **One title line.** Removed the small red "<Setting> - GM View / Player View"
   line above the campaign name. The header now shows ONLY the campaign name.
2. **Record button = red dot only.** The Record/Stop-Recording button now shows
   just the ⏺ glyph (no "Record" / "Stop Recording" text). Hover still shows the
   start/stop tooltip; the button background still goes dark-red while recording.
3. **No "Session N" pill.** The standalone "Session 6" status pill is gone; the
   session number is now appended to the title, e.g. "MINNIE & THE MAGNIFICENT
   MONGRELS (SESSION 6)" (only while a session is active).
4. **"GM View" wording dropped** (folded into change #1).
5. **Map Setup folded into the Tactical Map dropdown.** The standalone purple
   "Map Setup" header button is gone. The TACTICAL MAP dropdown now reads:
   Map Setup -> New Scene -> <campaign scenes>. (First item opens the
   scene-controls popout, same as the old button.)

## Steps (live - thetapestry.distemperverse.com, as GM)
Open "Minnie & The Magnificent Mongrels" table page.

1. Title: CONFIRM only ONE line shows - the campaign name. No "Distemper - GM
   View" red line above it.
2. Start a session (Start Session). CONFIRM:
   - The title now reads "... (SESSION N)" with the current session number.
   - There is NO separate "Session N" pill button in the header row.
3. Record button: CONFIRM it shows just a red ⏺ dot, no "Record" text. Hover -
   tooltip explains start. Click it (starts recording, broadcasts to players) -
   CONFIRM it stays a ⏺ dot and the button background goes dark-red. Click again
   to stop (players auto-download). [Optional - only if you want to exercise it.]
4. Tactical Map dropdown: hover/click TACTICAL MAP. CONFIRM the menu lists, in
   order: Map Setup, New Scene, then each campaign scene (active one in green).
5. Click "Map Setup" in the dropdown - CONFIRM the scene-controls popout window
   opens (same panel the old standalone button opened).
6. CONFIRM the old standalone purple "Map Setup" button no longer appears in the
   header when viewing the tactical map.

## Player-view spot check
7. As a PLAYER (not GM): open the table page. CONFIRM the title shows just the
   campaign name (no "Player View" red line). Players never saw Record / Map
   Setup / the session pill, so nothing else changes for them.

## Automated
- `npx tsc --noEmit` - clean (also removed the now-dead SETTINGS import).
- check-font-sizes / check-role-literals / check-em-dashes / check-arch - all green
  (the page actually shrank a few lines; removed an &mdash; from the old line).
