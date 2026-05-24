# Decomposition 2-Client Smoke Testplan

> **ARCHIVED 2026-05-24 - superseded by [tasks/phase7-acceptance-2client-testplan.md](phase7-acceptance-2client-testplan.md).** Its three former KNOWN-FAILUREs (CMod, tactical-share, nextTurn perf) are fixed and re-verified in that sheet's Section A, and the realtime core is now automated + green (10 Playwright specs on prod). Kept for history; do not run this - run the Phase 7 sheet.

The hands-on test you run after each decomposition step. Built so you don't have to think - do the action, watch for the PASS condition. Per the aggressive sequencing in `tasks/page-tsx-decomposition-plan.md`.

**Two parts:**
- **Part 0** = single-client click-through. Gates the 3 LEAF batches (A/B/C). ~5 min, one browser.
- **Parts 1-3** = two-client smokes. Gate the 3 TRUNK steps. ~5 min each, TWO browsers.

If a step FAILS: tell whichever chat shipped it "Trunk N smoke failed at step X, saw Y." They revert that one commit (`git revert <sha>`) and re-do. The other batches stay.

---

## Setup (do once)

**Two clients:**
- Window 1 (GM): your normal browser, logged in as a GM account, in a test campaign.
- Window 2 (Player): an incognito/private window OR a second browser, logged in as a DIFFERENT account that is a player in the same campaign.

Put them side by side. Hard-refresh both (Ctrl+Shift+R) after each deploy lands on Vercel. Keep DevTools Console open in BOTH (F12 -> Console) to catch red errors.

**Test campaign needs:** at least 1 GM + 1 player PC, 1 NPC, 1 tactical scene with a couple tokens. If you don't have one, spin it up before starting.

---

## PART 0 - Single-client click-through (gates LEAF batches A/B/C)

One browser, as GM. No second client needed. After the leaf batches deploy, walk this once. ~5 min.

- [ ] **Page loads.** Open the table page. It renders. Console has NO red errors on mount.
- [ ] **Header.** Every header dropdown opens + closes. Session controls visible. Tactical/Campaign toggle works.
- [ ] **Feed column.** Switch Rolls / Chat / Both tabs. Send a chat message - it appears. Feed scrolls.
- [ ] **GM sidebar.** Each of the 4 tabs (Pins / NPCs / Assets / Notes) opens + loads its content. Notes editor saves.
- [ ] **GM modals.** Open each: Loot, CDP, Populate, Advance Time, Restore picker, Reload picker. Each renders without crashing. Close each.
- [ ] **Special checks.** Fire one Perception/Gut Instinct check. The modal opens, rolls, closes.
- [ ] **Recruit.** Open the Recruit wizard. Steps render. Close it.
- [ ] **Trade.** Open a trade with an NPC. Inventory panel renders. Close it.
- [ ] **Tactical map.** Map renders. Place a token. Move a token. Switch scenes. Fog paints.
- [ ] **Character sheet.** Open a PC's inline sheet overlay. It renders.

**PASS:** everything above works + console is clean. The leaf batches are good. Move to the trunk steps.

**FAIL:** note which item + the console error. The leaf batch that broke it gets reverted; the rest stay.

---

## PART 1 - Initiative (gates TRUNK 1: `useInitiative`)

TWO browsers. The failure mode is "turn order desyncs between GM and player." ~5 min.

- [ ] **Start combat.** GM clicks Start Combat. Add the player PC + 2 NPCs to initiative (the GM controls the NPCs - the GM has no PC).
  - **PASS:** both windows show the same initiative order, same active combatant.
- [ ] **Take a turn (NPC active).** On Window 1, the GM has the active NPC take an action (any attack or check).
  - **PASS:** action count decrements on BOTH windows. Same combatant still active on both.
- [ ] **Advance turn.** GM clicks next-turn (or the PC ends turn).
  - **PASS:** BOTH windows advance to the next combatant simultaneously. No window stuck on the old turn.
- [ ] **Player's turn.** When the player PC is active, Window 2 (player) takes an action.
  - **PASS:** both windows see it; action decrements on both.
- [ ] **Aim.** Active combatant clicks Aim.
  - **PASS:** next attack shows +2 CMod. Aim doesn't double-consume the action.
  - **KNOWN FAILURE (found 2026-05-22):** the +2 shows in the AIM box / CMod field but is NOT applied to the roll total or the feed-log breakdown (`[3+5] +1 = 9`, +2 dropped). Aim is currently a no-op on the actual roll. Logged in `tasks/todo.md`; to be fixed in the Phase 3 `useRollResolution` rebuild (NOT to be behavior-preserved). Re-verify here once Phase 3 lands.
- [ ] **Sprint.** A combatant sprints.
  - **PASS:** 2 actions granted, Athletics roll fires, initiative re-order is consistent on both windows.
- [ ] **End combat.** GM ends combat.
  - **PASS:** both windows exit combat cleanly. If anyone was mortally wounded, the wound-infection queue fires.

**PASS all:** Trunk 1 is good. Proceed to Trunk 2.

**FAIL (most likely symptom):** a window gets stuck on a turn, or two windows disagree on who's active, or Aim burns 2 actions. That's the `consumeActionInFlightRef` / `nextTurn` extraction. Revert Trunk 1, re-do.

---

## PART 2 - Roll engine (gates TRUNK 2: `useRollResolution`) - THE BIG ONE

TWO browsers. This is the riskiest extraction. The failure mode is "rolls compute wrong, render wrong, or one client doesn't see them." Spend the full 5-10 min here. ~10 min.

- [ ] **Normal attack.** A PC attacks a target.
  - **PASS:** dice result + damage compute correctly. BOTH windows show the same feed row with the same outcome + color.
- [ ] **Insight Die spend.** Roll, then spend an Insight Die (3d6 / reroll).
  - **PASS:** the reroll resolves; the feed row updates; both windows agree.
- [ ] **CMod stacking.** An attack with a CMod (cover, aim, range).
  - **PASS:** the CMod shows in the breakdown; total is correct.
  - **KNOWN FAILURE (found 2026-05-22):** CMod from any source (cover/aim/range) is dropped from both the breakdown and the total - same root cause as the Aim step above. Logged in `tasks/todo.md`; fix in the Phase 3 `useRollResolution` rebuild (do NOT behavior-preserve). Re-verify here once Phase 3 lands.
- [ ] **Burst / grenade.** A burst attack OR a grenade against a cell.
  - **PASS:** multi-target / blast resolves; affected combatants take damage; both windows see it.
- [ ] **Grenade with friendlies in blast.** Throw a grenade where a friendly is in radius.
  - **PASS:** friendly takes damage too (no accidental friendly-immunity).
- [ ] **Mortal wound + Insight save.** Drive a PC to WP=0. The mortal-wound prompt fires.
  - **PASS:** the prompt appears ON THE WOUNDED PC's window (this is the `pc_mortal_wound` stale-closure spot - watch it closely). Accept the Insight save -> resolves. (Run again, decline -> resolves.)
- [ ] **NPC infection check.** End a combat where an NPC took a wound.
  - **PASS:** the end-of-combat wound-infection queue fires for the NPC.
- [ ] **Heal.** A medic heals a wounded PC.
  - **PASS:** HP restored; if Low Insight, the Wound Infection cascade fires on the patient's client.
- [ ] **Coordinated effort.** Lead a coord-effort, have a follower join, then withdraw one.
  - **PASS:** the chain banner shows; withdraw retcons the cmod on chained rows; both windows agree.

**PASS all:** Trunk 2 is good. This was the scary one. Proceed to Trunk 3.

**RESULT 2026-05-22 (baseline run on current/un-migrated code):** PASS overall ("seems good, if a little slow at times" - Xero). Two items logged, NOT blocking: (1) the CMod-stacking KNOWN FAILURE above (CMod dropped from total + breakdown); (2) PERF - `nextTurn` runs 656ms-3,638ms (sequential DB round-trips), flagged as a useInitiative Phase-3 batch/optimistic target. Both in `tasks/todo.md`.

**FAIL:** note the exact action + what you saw vs expected. This is `executeRoll` - the highest-value revert. Roll back Trunk 2, re-do (and confirm the pure-helper safety-net step landed first).

---

## PART 3 - Realtime (gates TRUNK 3: `useTableRealtime`) - LAST

TWO browsers. The failure mode is "one client stops seeing the other's changes" (channel resubscription bug). ~5 min.

- [ ] **Token move.** GM moves a token on the map.
  - **PASS:** Window 2 (player) sees the token move within ~2 seconds, no refresh.
- [ ] **Fog paint.** GM paints/clears fog (or opens a wall).
  - **PASS:** player's fog updates within ~2s.
- [ ] **Initiative change.** GM advances initiative.
  - **PASS:** player sees the turn advance within ~2s.
- [ ] **Chat.** Player sends a chat message.
  - **PASS:** GM sees it within ~2s.
- [ ] **Tactical share toggle.** GM toggles "share tactical view."
  - **PASS:** player's tactical pane opens/closes to match. (This is the `tacticalShared` open-state that breaks if the channel resubscribes - watch it.)
  - **KNOWN FAILURE (found 2026-05-22):** sharing works, but while shared the GM cannot switch back to the Campaign map - `scene_activated`/`tactical_shared` handlers force `setShowTacticalMap(true)` whenever shared, overriding the GM's toggle. Unshare frees it. Logged in `tasks/todo.md` (needs a design confirm: GM-can-preview-campaign-while-sharing). Fix in the Phase 3 useTacticalSync/useTableRealtime rebuild (do NOT behavior-preserve).
- [ ] **Logs cleared.** GM starts a new session (clears the feed).
  - **PASS:** both windows clear together. (NOTE: if Y11-e session-archive has shipped, the feed FILTERS rather than wipes - still both clear visually.)
- [ ] **Background + return.** Background Window 2 for 30s (switch tabs), then return.
  - **PASS:** it refetches + catches up to current state, no desync.
- [ ] **Console check.** Look at BOTH consoles for the duration.
  - **PASS:** no repeated "channel" / "subscription" warnings. (A resubscription loop spams the console - that's the R2 failure signature.)

**PASS all:** Trunk 3 is good. The whole decomposition is verified. The orchestrator-compose final commit is trivial (just confirm the page still loads after dead-state pruning).

**RESULT 2026-05-22 (baseline run on current/un-migrated code):** PASS overall ("otherwise good" - Xero) EXCEPT the tactical-share KNOWN FAILURE above (GM pinned to tactical while shared). No channel-resubscription spam observed in the dumps (clean single RECVs). Logged in `tasks/todo.md`; fix in the Phase 3 realtime rebuild.

---

## Whole-smoke result (2026-05-22 baseline, current code)
Parts 0/1/2/3 all run. PASS overall. Open items, all logged in `tasks/todo.md` and flagged fix-do-NOT-preserve for the grand-rearch Phase 3 (so the rebuild fixes them rather than carrying them forward):
1. **CMod dropped** from roll total + breakdown (all sources: aim/cover/range) - HIGH, correctness.
2. **GM pinned to tactical** while sharing (can't return to campaign map) - needs a design confirm.
3. **`nextTurn` perf** 656ms-3,638ms (sequential round-trips) - optimize via batch + optimistic.
Plus the band-aid catalog from the architecture audit (118 prod console writes incl. the `playtest-trace`/`kickCheck` lines seen throughout these dumps, the TEMP-WIDENED recorder, `alert()` placeholders).

**FAIL (signature):** a token/fog/initiative change on one window doesn't reach the other, OR the console shows repeated channel resubscriptions. This is `useTableRealtime` with the wrong deps array - it MUST be `[campaignId]` only. Revert Trunk 3, re-do with that constraint.

---

## After all parts pass

1. Tell the lane that shipped the trunk steps: "all three trunk smokes green."
2. The orchestrator-compose final commit can land (dead-state prune; confirm page loads).
3. Update the Risk Register in `tasks/debug-handoff.md`: `app/stories/[id]/table/page.tsx` can finally demote from YELLOW once it's ~300 lines + all smokes passed.
4. Promote the decomposition HOPED-FOR -> PLAYTESTED in the Confidence Ledger.

---

## Why this testplan exists

The leaf batches can't hide bugs from a single user, so Part 0 (one browser) covers them. The three trunk steps have failure modes that ONLY appear with two live clients - turn desync, roll-render divergence, channel resubscription. No unit test catches those; this hands-on 2-client smoke is the only detector. That's the one place "tiptoe" earns its keep.

**Discard this file after the decomposition is fully verified.** It's a one-shot for this work. The pattern (2-client smoke per realtime-touching extraction) is reusable - copy it next time a multi-client surface gets refactored.
