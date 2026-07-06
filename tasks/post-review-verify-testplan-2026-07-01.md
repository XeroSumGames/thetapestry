# Verify testplan - 2026-07-01 review fixes (before moving on)

Give Vercel ~2 min to deploy after the last push before starting. Report back
what you saw for each numbered step; I'll check it against what should happen.

## Test 1 - pin-sync poll rework (the important one, needs 2 windows)

You need two browser windows on the same District Zero table: one signed in as
you (GM), one as a player who is a member.

GM window: `https://thetapestry.distemperverse.com/stories/6dd8611b-62ef-4810-b998-b9c5682d0a62/table`

1. In the player window, open the Campaign Map, click one revealed pin so its
   info popup opens, and then leave that window completely alone for about 40
   seconds - do not click, scroll, or switch tabs. Note whether the popup stays
   open the whole time or closes on its own.
2. In the GM window, hide a whole folder of pins (a reveal/hide control), wait
   about 5 seconds, then reveal that folder again. Keep watching the player
   window without touching it, and note whether the pins disappear and reappear
   on their own, and roughly how many seconds it took.
3. In the GM window, drag one pin to a clearly different spot on the map and let
   go. Then reload the GM window and note whether the pin stayed where you
   dropped it.
4. In the GM window, reveal an NPC that is attached to a pin (from the NPCs
   tab / the pin). In the player window, open that pin's popup and note whether
   the NPC's name shows under "Also Here" - then keep that popup open for about
   40 seconds and note whether the name stays or vanishes.

## Test 2 - the six drop-in pregens show in the picker (1 window, quick)

5. Open `https://thetapestry.distemperverse.com/stories/6dd8611b-62ef-4810-b998-b9c5682d0a62`
   (the story page, not the table), find the section for pre-generated
   characters for this story, and tell me which character names you see listed.

## Test 3 - Path to Citizenship content renders + stays GM-only (2 windows, quick)

6. In the GM window's table, open the GM Notes tab and tell me whether you see
   the scene briefs titled PtC 00 through PtC 22.
7. In the player window's table, open the player's Notes tab and tell me exactly
   which notes/handouts you see there.
