# Playtest Analysis - 2026-07-13 (2-client, GM xerosumgames + player tony_bushell)

Xero ran the [playable-loop smoke testplan](playable-loop-smoke-testplan-2026-07-10.md)
at 14:21-14:26 UTC on story `8f15cf20`. Inputs: his answers (playtest.xlsx,
step-numbered to the plan) + two recorder dumps. Player dump is a single end
snapshot (character-sheet modal open, no combat on the player side); the GM
dump is 395 events. This is the correlation + root-cause pass.

## Verdict: core loop is PLAYABLE. Realtime side-panels + a few combat details are the gaps.

Creation -> story -> session -> combat start -> attack -> rest all passed. The
failures cluster in (a) realtime propagation to side panels/sheets and (b) a
couple of combat-action correctness holes the audit already flagged.

---

## GOOD NEWS - verified working this run

- **H13 realtime fix HOLDS (step 20).** Advancing time on an infected character
  did NOT hang the table; the infection resolved to a Lasting Wound and both
  windows stayed live. The 2026-07-09 channel-reuse fix (`128145b6`) is verified
  in real play - drains that health-pulse item.
- Core creation loop (steps 1-4): character (Zola Pryce, Light Pistol + Kitchen
  Knife), WP/RP 10 & 6, story create - all clean.
- Combat start + initiative (steps 8-10): NPC (Jamie Zimmerman) added, combat
  started, PC attack damaged the NPC.
- Rest advances the clock ONCE correctly (steps 15-16): Day 1 -> Day 2 on a 24h
  rest (H10 party-multiply NOT triggered - he had one PC, step 17 n/a).
- Token move propagates to the player live (step 19).
- NOTE: the step-15 clock text "Campaign Day 1 · 12 AM, March 2nd..." separator
  is a middle dot (U+00B7), NOT an en-dash - no house-rule violation (the xlsx
  showed it as a replacement char, a display artifact only).

---

## CONFIRMED LIVE (already in the 2026-07-09 audit - playtest proves them real)

**P1 [= audit H14, HIGH] Pin reveal/hide does NOT reach the right sidebar for GM
OR player without a manual refresh or tab toggle (step 18).**
Root cause confirmed in code: `CampaignPins.tsx:169` and `CampaignMap.tsx:996`
BOTH open the topic `campaign_pins_${id}`. When the map + Pins sidebar are both
mounted (the table's default pairing), the second `supabase.channel(sameTopic)`
returns the FIRST's instance, so the sidebar's `.subscribe(... loadPins())`
catch-up never fires (silent no-op on an already-joined channel), and unmounting
either one `removeChannel`s the shared instance. Both tables ARE in the
publication - this is purely the shared-topic collision. The "toggle the tab
fixes it" detail matches exactly (remount re-runs loadPins once). **This is the
top Beta blocker on the pin feature.**

**P2 [= audit H4, HIGH] Cover Fire applies no penalty to the target (step 13).**
"no seeming penalty to the NPC." Confirmed: the -2 is written to the target's
`aim_bonus`, which `activateUpdate` (page.tsx:2423) zeroes the instant the
target's turn starts, before any roll reads it. Guaranteed no-op.

**P3 [= audit H2, HIGH] Ammo not consumed (steps 12-13).** "I can fire the
weapon without a target but it doesn't use the gun's ammo"; Cover Fire "doesn't
use any ammo." Ammo only decrements on the damage-application path (which needs
a target), and that path reads the viewer's slots not the attacker's (H2). Fire-
at-nothing and no-target actions skip ammo entirely.

---

## NEW findings (not in the audit) - all realtime/UX, route to HP

**N1 [MED] A newly-joined player doesn't appear to the GM without a manual
refresh (steps 5-6).** "player didn't join immediately, had to manually refresh
to see them." The `members_${id}` handler (page.tsx:1544) refetches on
campaign_members changes BUT filters `.not('character_id','is',null)` - a player
who joins before picking a character has a null character_id, so the roster
never updates until they assign AND someone refreshes. Show unassigned members
(or refetch unfiltered) so a join is visible immediately.

**N2 [MED] An open character sheet doesn't reflect damage live (step 11).** "RP
damage didn't reflect on the char sheet till a manual refresh." The player had
the character-sheet modal open (confirmed in their snapshot: open_modal =
character-sheet); it doesn't live-apply character_states updates. Wire the sheet
to the character_states realtime it's already receiving elsewhere.

**N3 [MED] Players get no pin popup at all (step 18a).** "there is no popup for a
player." Separate from P1: even setting aside the stale sidebar, the player has
no way to open a revealed pin's detail popup. Feature gap for players.

**N4 [LOW/UX] NPC ammo is not surfaced anywhere (step 11).** "very unclear where
to see an NPC's ammo." Add an ammo readout to the NPC card/sheet.

---

## NEEDS ONE CLARIFICATION

**Step 14 (Insight reroll double-damage, audit H3).** Xero answered "yes" but the
step had two questions (did the reroll change the outcome / did the target take
damage a SECOND time). Can't tell which "yes" answers. Next combat test: after a
reroll on an already-hit attack, watch whether the target's WP drops twice.

---

## Recommended priority off this playtest

1. **P1 / H14 - pin sidebar realtime.** Most visible broken feature; a reviewer
   will hit it in five minutes. Rename one of the two `campaign_pins_${id}`
   holders to a distinct topic (or route both through the shared reconcile hook).
2. **N1 + N2 - roster-on-join + live char sheet.** Both are "why didn't it
   update" moments that read as broken to a new player.
3. **P2 / H4 - Cover Fire** and **P3 / H2 - ammo**, folded into the Tier 1 combat
   pass already on the roadmap.
4. **N3 player pin popup**, then **N4 NPC ammo readout** as polish.
