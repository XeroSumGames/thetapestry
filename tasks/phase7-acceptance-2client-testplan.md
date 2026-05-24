# Phase 7 Acceptance - 2-Client Smoke (Grand Re-Arch finish line)

The single sheet that closes the Grand Re-Architecture. Run this in two browser windows; do the action, watch for the PASS condition. When every section passes, the re-arch moves from HOPED-FOR to verified and the Realtime-channels Risk Register entry demotes from YELLOW.

- **Derive HEAD before running:** `git rev-parse --short HEAD`. The re-arch is complete through Phase 6 at `667c100` / later.
- **Supersedes** `tasks/decomposition-2client-smoke-testplan.md` (table-only, baseline-run 2026-05-22 on un-migrated code). The three KNOWN-FAILURE items in that file are now FIXED (CMod 3c-A `7350715`, tactical-share 3a `cde8003`, nextTurn perf 3b `e3a9df0`) and are re-verified in Section A below. Archive the old file once this passes.
- **Why this exists:** the re-arch rewrote all six god-components + every realtime channel onto `lib/realtime/*`. tsc + 548 unit tests are green, but multi-client desync (a dropped broadcast, a channel that doesn't resubscribe) is invisible to any automated test. Two live clients are the only detector. TacticalMap (the hardest seam) already passed on prod 2026-05-23; this sheet covers the remaining five surfaces.

---

## Setup (do once)

**Two clients, side by side:**
- **Window 1 (GM):** normal browser, logged in as a GM account, in a test campaign.
- **Window 2 (Player):** incognito/private window OR a second browser, logged in as a DIFFERENT account that is a player in the same campaign.

**Test campaign needs:** 1 GM + 1 player PC, at least 1 NPC, 1 tactical scene with 2+ tokens, 1 vehicle with a name + a mounted weapon, 1 community with a stockpile, a couple of map pins.

**Both windows:** hard-refresh (Ctrl+Shift+R) after the deploy lands on Vercel. Keep DevTools Console open in BOTH (F12 -> Console). A resubscription loop spams "channel"/"subscription" warnings - that is the canonical re-arch failure signature, watch for it the whole time.

**If a step FAILS:** note the exact action + what you saw vs expected + any console error. Tell Claude "Section X step Y failed, saw Z." Claude reverts the one implicated commit and re-does it; the rest stay.

---

## SECTION A - Core table re-arch (re-verify; was the 3-trunk decomposition)

TWO browsers. This is the condensed re-run of the old decomposition smoke. The three items marked **(was KNOWN FAILURE)** were broken at the 2026-05-22 baseline and have since been fixed - they should now PASS.

### A1 - Initiative (useInitiative)
- [ ] **Start combat,** add the player PC + 2 NPCs. PASS: both windows show the same order + same active combatant.
- [ ] **Advance turn.** PASS: BOTH windows advance together; no window stuck on the old turn; settles fast (the 3b optimistic flip - **was KNOWN FAILURE: nextTurn 656ms-3.6s; should now feel instant**).
- [ ] **Player turn.** Window 2 takes an action. PASS: action count decrements on both.

### A2 - Roll engine (useRollResolution)
- [ ] **Normal attack.** PASS: dice + damage correct; both windows show the same feed row, same outcome + color.
- [ ] **CMod stack (aim + cover + range).** Combatant Aims, then attacks a target with cover at range. PASS: **(was KNOWN FAILURE)** the breakdown now ITEMIZES each source as its own term (e.g. `+2 Aim`, range as its own term, target defense as its own negative term); the total is correct and Aim is no longer dropped.
- [ ] **Grenade vs a cell, friendly in radius.** PASS: blast resolves; every victim takes damage AND every victim shows a per-target line in the feed (3c-A4 blast-log); friendly is not immune.
- [ ] **Mortal wound + Insight save.** Drive a PC to WP=0. PASS: the mortal-wound prompt fires ON THE WOUNDED PC's window (the `pc_mortal_wound` stale-closure spot - watch closely). Accept the Insight save -> resolves.
- [ ] **Heal (Low Insight).** A medic heals a wounded PC and rolls Low Insight. PASS: HP restored; the Wound Infection cascade fires on the patient's client.

### A3 - Realtime (useCampaignChannel on the table)
- [ ] **Token move / fog paint / initiative advance.** GM does each. PASS: Window 2 reflects each within ~2s, no refresh.
- [ ] **Chat.** Player sends a message. PASS: GM sees it within ~2s.
- [ ] **Tactical share toggle.** GM toggles "share tactical view." PASS: player's tactical pane opens/closes to match AND **(was KNOWN FAILURE)** the GM can now switch their OWN view back to the Campaign map while still sharing (3a decouple).
- [ ] **Background + return.** Background Window 2 for 30s, then return. PASS: it refetches + catches up, no desync, no console resubscription spam.

---

## SECTION B - Vehicle realtime (app/vehicle/page.tsx)

TWO browsers. Window 1 = GM with the **tactical map open** (it is the receiver). Window 2 = the vehicle popout (open the vehicle's controls). The seam moved 6 channels behind `usePostgresSubscription` + `useCampaignChannel` + `broadcastOnce`; the localStorage/BroadcastChannel belt-and-suspenders fallbacks are preserved.

- [ ] **Board / disembark a crew member** in the vehicle popout. PASS: the OTHER window's tactical map updates (the `vehicle_updated` broadcast; also exercises the localStorage/BroadcastChannel fallbacks).
- [ ] **Mounted-weapon attack that zeroes the vehicle's actions.** Fire the mounted weapon until actions hit 0. PASS: the table auto-advances the turn (`turn_advance_requested` on the `initiative_` channel).
- [ ] **"Show Arc"** on a mounted weapon. PASS: the firing-arc cone appears on the tactical map in the other window (`firing_arc_toggle`).
- [ ] **MOVE HERE / dismount** a token from the vehicle. PASS: the token snaps on the tactical map AND range tags ("Too far") recompute on both windows (`token_moved`).
- [ ] **Drag a token near/away on the TacticalMap** (Window 1). PASS: the vehicle popout's range gate recomputes (the `token_moved` handler reads the fresh loader via `loadTokensRef`, no resubscribe).

---

## SECTION C - NPC Roster realtime (components/NpcRoster.tsx)

TWO browsers, both with the NPC roster panel visible (GM sidebar -> NPCs; player sees revealed NPCs). Channel: `npc_roster_${campaignId}` watching `campaign_npcs` + `community_members`.

- [ ] **GM edits an NPC** (rename, change HP, change folder). PASS: the change appears in the GM's own roster without manual reload (the `campaign_npcs` sub).
- [ ] **GM reveals a hidden NPC to players.** PASS: the NPC appears in Window 2's player-visible roster within ~2s.
- [ ] **GM recruits an NPC into a community / changes membership.** PASS: the roster reflects the membership change (the `community_members` sub) on both windows.
- [ ] **Console check.** PASS: no `npc_roster` resubscription spam in either console.

---

## SECTION D - Community + stockpile realtime (components/CampaignCommunity.tsx)

TWO browsers, both with the SAME community's panel open. Channel: `stockpile-${campaignId}-{communityIds}` watching `community_stockpile_items` with an IN-filter keyed on the community-id set (so it must resubscribe when communities are added/removed).

- [ ] **Player A deposits an item** into the community stockpile (via the InventoryPanel give modal). PASS: Player B's open community panel shows the new stockpile row appear without reload.
- [ ] **Withdraw / change quantity** of a stockpile item. PASS: the qty change propagates to the other window.
- [ ] **Create a NEW community** while the panel is open (resubscribe test). PASS: a deposit into the NEW community still propagates live (the channel name includes the community-id set, so it must have resubscribed). This is the single highest-value step in this section - the dynamic IN-filter resubscribe is the seam behavior most likely to regress.

---

## SECTION E - Map realtime (components/MapView.tsx)

TWO browsers. Two GLOBAL postgres subs (not campaign-scoped): `whispers_feed` (whispers table) + `map_pins_changes` (map_pins table). Both behind `usePostgresSubscription` (sentry-wrapped).

- [ ] **Whispers:** open the whispers sidebar tab in BOTH windows. One window posts a whisper. PASS: the other window's whispers feed updates without reload. (Note: the sub only mounts when the whispers tab is active - confirm it still works after switching away and back.)
- [ ] **Map pins - add:** one window adds a map pin. PASS: the other window sees the pin appear within ~2s.
- [ ] **Map pins - edit/delete:** edit a pin's details, then delete a pin. PASS: both changes propagate to the other window.
- [ ] **Console check.** PASS: no `whispers`/`map_pins` resubscription spam.

---

## SECTION F - End-of-combat infection modal (the fragile one)

TWO browsers. This is the item handed to the Playwright/E2E window because it is fragile to automate. It was the one open question from the 3c-B smoke (player owned the wounded PC + watched + saw no modal). 3d moved `infection_check_request` onto the stable `useCampaignChannel` subscription, which SHOULD fix the resubscribe-miss - this confirms it.

- [ ] **Wound a PC during combat** (cut/shot weapon, leave them at WP > 0 so a warning is queued - not dropped to 0). PASS (bisect): the "<PC name> is wounded and may have to deal with infection" WARNING row appears in the feed DURING the fight, on both windows.
- [ ] **End combat** (GM clicks End Combat). PASS: the wound-infection MODAL fires on the WOUNDED PC owner's window (Window 2 if the player owns the PC). This is the confirmation 3d fixed it.
  - If the warning rows appeared (step 1 PASS) but the modal does NOT fire here: the logging works, the broadcast/listener is the bug -> not fully fixed by 3d, re-open the todo.
  - If the warning rows did NOT appear in step 1: it is a logging bug (`queueWoundInfectionChecks` found nothing), not a realtime bug. Run `sql/diag-wound-infection-2026-05-23.sql` with a linked DB.

---

## After ALL sections pass

Claude does these (no Xero action needed beyond reporting the all-green):
1. **Risk Register** (`tasks/debug-handoff.md` Sec 1): demote **Realtime channels YELLOW -> GREEN-ish** (this sheet is its demote-gate). Re-evaluate **table page YELLOW** - with the re-arch validated end-to-end it is a demote candidate (note: it is still ~10.5k lines, so the demote rationale is "verified behavior" not "small file").
2. **Confidence Ledger** (`tasks/debug-handoff.md` Sec 3): move the whole re-arch from HOPED-FOR to PLAYTESTED RECENTLY.
3. **Archive** `tasks/decomposition-2client-smoke-testplan.md` (its job is done; the still-valid steps live in Section A here).
4. **decisions.md / lessons.md:** note Phase 7 closed + the re-arch verified.
5. The **2026-05-25 playtest** is the final real-world confirmation on top of this structured smoke.

---

## NOT part of Phase 7 (separate platform-hardening, do not block the re-arch on these)

Two operator items are owed by Xero but are NOT re-arch work - tracked so they are not forgotten, not gating the re-arch sign-off:
- Set `UPSTASH_REDIS_REST_URL` + `_TOKEN` in Vercel (prod `/api/auth/verify-turnstile` returns 503 until then). See `tasks/l3-kv-ratelimiter-testplan-2026-05-20.md`.
- Apply `sql/audit-log-table-2026-05-20.sql` to live.

---

## Results (fill in as you run)

- Date / HEAD:
- Section A (table core):
- Section B (vehicle):
- Section C (npc roster):
- Section D (community/stockpile):
- Section E (map):
- Section F (infection modal):
- Console clean both windows (no resubscription spam):
- Open items / failures:
