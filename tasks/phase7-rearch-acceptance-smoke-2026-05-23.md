# Phase 7 - Grand Re-Architecture acceptance smoke (2026-05-23)

Validates the 6 god-component seam migrations (Phase 5) + the console cleanup
(Phase 6) end-to-end. All migrations were behavior-preserving, so this is a
regression check: **nothing should look different to the player; the realtime
should still sync; the console should now be quiet.**

**Setup:** two logged-in browsers - **A = GM**, **B = player** (or a 2nd tab).
Target a throwaway campaign (**The Arena** is the stand-alone test one). Open
DevTools console in BOTH before starting.

**The Phase 6 payoff to watch the whole time:** the prod console should be
**silent** - no `[playtest-trace]`, `[nextTurn]`, `[consumeAction]`, `[crop]`,
`[kickCheck]` spam. Diagnostics now route into the recorder buffer via trace()
(echo only in local dev). Real failures still show as `console.error`. If you
see bare `console.log/warn` noise on the live site, that's a regression.

---

## 1. World map (MapView) - `lib/data/map.ts` + `usePostgresSubscription`
- [ ] /map loads; pins render; sidebar folders populate.
- [ ] Drop a pin (A) -> it appears for B without refresh (map_pins realtime).
- [ ] Follow/unfollow a world community; open a pin's attachments (storage seam).
- [ ] Whispers tab: post a whisper (A) -> shows for B (whispers_feed realtime).
- [ ] Console clean.

## 2. Vehicle popout (vehicle/page.tsx) - data + 6 channels (COMBAT-ADJACENT)
- [ ] Open a vehicle popout. Crew pickers populate (PC + NPC).
- [ ] Board / disembark a crew member (A) -> the tactical map (B, and A's table)
      updates the aboard tokens + passenger badge (vehicle_updated cross-window
      + the localStorage/BroadcastChannel fallbacks).
- [ ] Mounted-weapon attack that zeroes the actor's actions -> the table
      auto-advances the turn (turn_advance_requested on initiative_).
- [ ] "Show Arc" toggles the firing cone on the tactical map (firing_arc_toggle).
- [ ] MOVE HERE / disembark snaps a token -> "Too far" range tags recompute (token_moved).
- [ ] Console clean (only [vehicle-popout] console.error on a real RPC failure).

## 3. NPC roster (NpcRoster) - `lib/data/npc-roster.ts` + useCampaignChannel postgres[]
- [ ] Roster loads; create / edit / clone / delete an NPC.
- [ ] Apply damage to an NPC from the table (A) -> roster WP/RP updates live (B).
- [ ] Reveal / Hide All; portrait auto-assign on generate; publish->library round-trip.
- [ ] Console clean.

## 4. Communities (CampaignCommunity) - `lib/data/community.ts` + stockpile channel
- [ ] Community panel loads; members/roles/morale render.
- [ ] Deposit/withdraw a stockpile item (A) -> B's open panel updates without
      refresh (stockpile-${id} dynamic-filter sub).
- [ ] Create community / add member / change role / schism / publish.
- [ ] Console clean.

## 5. Tactical map (TacticalMap) - `lib/data/tactical.ts` + 2 channels (COMBAT-CRITICAL)
- [ ] Scene loads; tokens render.
- [ ] Drag a token (A) -> moves on B (scene_tokens postgres + token_moved).
- [ ] GM activates a different scene -> B follows (scene_activated).
- [ ] GM zoom -> B's view snaps (tactical_zoom); GM "Share View" -> B scrolls/zooms
      to match (tactical_view_share).
- [ ] Alt+right-click a door -> opens for both (door_open).
- [ ] Resize / rotate / scale a token; GM ping (gm_ping) shows on B.
- [ ] Console clean.

## 6. Initiative / roll core (table page, Phase 3 - re-confirm)
- [ ] Start combat; roll an attack; damage applies; nextTurn advances on both.
- [ ] CMod (Aim/Cover/Range) shows in the breakdown AND the total (the 3c-A fix).
- [ ] Mortal wound -> stress pip; insight dice; auto-advance.

## 7. THE OPEN QUESTION - wound-infection at end of combat
- [ ] During a fight, when a PC/NPC takes WP damage, does the feed show
      "<name> is wounded and may have to deal with infection"?
- [ ] At end of combat, does the wound-infection modal fire for the owner of a
      wounded PC? (3c-B smoke saw it NOT fire - 3d's stable init subscription
      should have fixed it. This is the bisection: did the warning feed rows
      appear during the fight?)
- If it still doesn't fire: bisect with `sql/diag-wound-infection-2026-05-23.sql`
  (Supabase CLI must be linked).

---

## Pass criteria
All realtime cross-client updates land without refresh; combat math correct;
**console silent on prod**; no regressions vs pre-re-arch behavior. Any failure
-> report the surface + console.error text + repro; the migration is one
`git revert <sha>` away per component (all behavior-preserving single commits).
