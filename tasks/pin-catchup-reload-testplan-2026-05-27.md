# Testplan - pin/notes broadcast catch-up reloads (2026-05-27, Hunt & Peck)

## What changed and why

Five realtime surfaces converged on shared state ONLY by catching a one-shot
broadcast (or a flaky postgres_changes event). A broadcast is fire-and-forget:
a client that was briefly disconnected, subscribed late, or had its tab
backgrounded (Chrome pauses the socket) never receives the packet and shows
STALE data until a manual refresh. Two playtest reports confirmed it:
"shared a PIN and it didn't show up without a refresh" + "pin didn't show to
players as they neared it."

Fix: every one of these subs now ALSO reloads its data (a) when its channel
reports `SUBSCRIBED` (fires on first connect AND every reconnect), and (b) on
`document` `visibilitychange` when the tab returns to visible. This mirrors the
existing `RollsFeed` / `TableChat` catch-up pattern. Convergence no longer
depends on catching one ephemeral broadcast.

Surfaces touched:
1. `components/CampaignPins.tsx` - pins sidebar list (`pins_changed` broadcast)
2. `components/CampaignMap.tsx` - Leaflet map markers (`pins_changed` broadcast)
3. `components/PlayerNotes.tsx` - shared GM notes (`gm_notes_updated` broadcast)
4. `app/npc-sheet/page.tsx` - NPC popout WP/RP (`npc_damaged` broadcast)
5. `app/campaign-sheet/page.tsx` - clock / party WP / pending effects

Pure additive wiring - no schema, no data, no change to the existing broadcast
or postgres_changes paths. Rollback = revert the one commit.

## How to test (LIVE, needs two browsers)

Use a campaign you GM (e.g. The Arena) + a second browser/profile signed in as
a player member of the same campaign. "Player" below = the second browser.

### A. Pins - the headline case (CampaignMap + CampaignPins)
1. GM: open the campaign map (`/campaigns` -> open one, or the table page map).
2. Player: open the same campaign map. Confirm you see the currently-revealed
   pins.
3. Player: switch to another browser tab (background the campaign tab) for ~30s.
4. GM (while player tab is backgrounded): drop a new pin and REVEAL it (or
   reveal an existing hidden pin).
5. Player: switch BACK to the campaign tab.
   - EXPECT: the newly revealed pin appears within ~1s of the tab becoming
     visible, WITHOUT a manual refresh. (Before this fix it stayed missing
     until F5.)
6. Repeat with the pins SIDEBAR open on the player side (CampaignPins list) -
   the list should also catch up on tab-return.

### B. Reconnect path (harder to stage, optional)
1. Player: open the campaign map, note revealed pins.
2. Player: turn OFF wifi / network for ~20s (forces the realtime socket to
   drop), then turn it back ON. Stay on the tab the whole time.
3. GM: while the player was offline, reveal a new pin.
4. Player: within a few seconds of the network returning (socket re-SUBSCRIBES),
   the pin should appear with no manual refresh.

### C. Shared GM notes (PlayerNotes)
1. Player: open a surface that shows shared GM notes (player notes panel).
2. Player: background the tab.
3. GM: share a new note (or un-share one) from GM Notes.
4. Player: return to the tab -> the shared-notes list reflects the change with
   no refresh.

### D. NPC popout (npc-sheet)
1. Open an NPC sheet popout (GM or a player who can see the NPC).
2. Background the popout window/tab.
3. From the table, deal damage to that NPC (changes its WP).
4. Return to the popout -> WP/RP shows the post-damage value with no refresh.

### E. Campaign sheet (clock / pending effects)
1. Open `/campaign-sheet?c=<campaignId>` as a player.
2. Background the tab.
3. GM: advance the in-game clock (and/or queue a streaming heal).
4. Return to the tab -> the clock + Pending Effects panel + party WP reflect the
   change with no refresh.

## Regression watch (should be UNCHANGED)
- The IMMEDIATE in-session case (both tabs foregrounded, GM reveals a pin) must
  still update instantly via the broadcast - the catch-up is additive, it does
  not replace the broadcast.
- No duplicate pins / flicker on the initial open (the first SUBSCRIBED fires a
  redundant-but-harmless reload of data already loaded; values are identical so
  there is no visible flicker).
- Pings, view-share, route, measure tools on the campaign map - untouched.

## Pass criteria
All of A, C, D, E show the change after tab-return with NO manual refresh, and
the foregrounded instant-update case still works. B is a bonus confirmation of
the reconnect path.
