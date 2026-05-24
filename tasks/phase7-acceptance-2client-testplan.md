# Phase 7 Acceptance - 2-Client Smoke (Grand Re-Arch finish line)

The single sheet that closes the Grand Re-Architecture. Run this in two browser windows; do the action, watch for the PASS condition. When every section passes, the re-arch moves from HOPED-FOR to verified and the Realtime-channels Risk Register entry demotes from YELLOW.

- **Derive HEAD before running:** `git rev-parse --short HEAD`. The re-arch is complete through Phase 6 at `667c100` / later.
- **Supersedes** `tasks/decomposition-2client-smoke-testplan.md` (table-only, baseline-run 2026-05-22 on un-migrated code). The three KNOWN-FAILURE items in that file are now FIXED (CMod 3c-A `7350715`, tactical-share 3a `cde8003`, nextTurn perf 3b `e3a9df0`) and are re-verified in Section A below. Archive the old file once this passes.
- **Why this exists:** the re-arch rewrote all six god-components + every realtime channel onto `lib/realtime/*`. tsc + 548 unit tests are green, but multi-client desync (a dropped broadcast, a channel that doesn't resubscribe) is invisible to any unit test. Two live clients are the only detector. TacticalMap (the hardest seam) already passed on prod 2026-05-23; this sheet covers the remaining five surfaces.

## Automating this: the Playwright E2E "final test" suite

This manual sheet is the gate you run TODAY (no harness needed) and the sign-off for THIS release. The durable, automated version is the e2e "final test" suite (brief: `tasks/e2e-final-test-handoff-2026-05-24.md`) - multi-context (GM/player/Ghost) against THE ARENA (`35ed2133-498a-43d2-bbd6-21da05233af2`, MARV = player), seed + teardown, headless in CI. The two are complementary, not redundant:

- **Automates cleanly (Playwright's strength):** the console/network sweep (every route) + DOM-propagation Sections **C** (NPC reveal), **D** (stockpile deposit + the community-create resubscribe), **E** (map pins + whispers). As each lands in the suite, drop it from this manual run.
- **Needs small app edits:** token-move on the `<canvas>` (Sections **B** + **A3**) needs `data-testid` hooks or a JS-eval bridge to read token positions.
- **Stays manual the longest:** combat math (**A2** - random dice + modal branches + feed-text parsing) and the end-of-combat infection modal (**F**) - the most stateful, multi-modal paths.
- **Fixture overlap = the long-term answer to "the vehicle only exists in Minnie":** the suite can PROGRAMMATICALLY SEED the vehicle (`campaigns.vehicles` JSONB) + a community + stockpile rows into the Arena, then tear down. Until it does, set them up by hand or fold Sections B/D into the 2026-05-25 Minnie playtest.

**Do NOT block Phase 7 sign-off on the suite being finished.** The manual sheet gates this release; Playwright is the permanent regression net for every future realtime-touching change.

---

## Setup (do once)

**Locked plan (2026-05-24):**
- **Sandbox = THE ARENA** (`35ed2133-498a-43d2-bbd6-21da05233af2`; GM = Xero, player = MARV). The designated disposable test campaign; accounts already wired. Do NOT run any of this in Minnie - it is a real campaign and these sections write rolls / combat / content.
- **Run Sections A, C, D, E, F in the Arena BEFORE the 2026-05-25 playtest** - the high-risk, controllable surfaces (roll engine, table realtime, NPC roster, community/stockpile, map, the infection modal). The Arena has a community already, so D runs here (the deposit step creates its own stockpile item).
- **Only Section B (vehicle) is FOLDED INTO the 2026-05-25 Minnie playtest** - the Arena has 0 vehicles and a named vehicle is the one involved fixture to hand-build; the Playwright suite is being built to seed it programmatically. The vehicle migration is behavior-preserving and its hardest counterpart (TacticalMap) already passed on prod, so verifying it live in Minnie with a second window is the proportionate call. (To gate B earlier instead, create one named vehicle + mounted weapon in the Arena via the tactical map first.)

**Arena readiness CONFIRMED 2026-05-24** (via `sql/diag-arena-readiness-2026-05-24.sql`): 7 player PCs, 14 NPCs, 1 tactical scene, 22 scene tokens, 30 GM map pins, 1 community, 0 vehicles. Everything A/C/D/E/F needs is present; only the vehicle (B) is absent. Re-run that probe if the Arena state may have drifted.

**Two clients, side by side:**
- **Window 1 (GM):** normal browser, logged in as Xero (GM), in THE ARENA.
- **Window 2 (Player):** incognito/private window OR a second browser, logged in as MARV (player in the Arena).

**Arena needs for the A/C/D/E/F run:** confirmed present (7 PCs, 14 NPCs, 1 scene, 22 tokens, 1 community, 30 GM pins). Only the vehicle (Section B) is absent and rides the Minnie playtest.

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

> **RUN DURING THE 2026-05-25 MINNIE PLAYTEST** (second window open), not in the Arena pre-run - the named vehicle fixture only exists in Minnie. See the locked plan in Setup.

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

> **RUNNABLE IN THE ARENA** - it has 1 community already; the deposit step below creates its own stockpile item, so no seeding needed.

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

## Results - Playwright lane, 2026-05-24 (Gate 0 meets closure criteria)

Run headless: `npm run test:e2e` (auto-login mints all 4 sessions first). All specs on `origin/main`.

**AUTOMATED + GREEN on prod (10 spec files):**
- **Console/network sweep** (`console-network.spec.ts`) - 92 routes, zero console errors + zero in-scope failed requests. Re-verified green twice.
- **Infra:** `auth.setup.ts` (auto-login x4), `seed-smoke.spec.ts` (vehicle RPC + community/stockpile seed+teardown), `role-nav.spec.ts` (Thriver-vs-Survivor gating), `character-create.spec.ts` (create->persist->owner-delete).
- **Section A1** (`section-a1-combat-start.spec.ts`) - GM Start Session+Combat -> player sees IN COMBAT live.
- **Section A3** (`section-a3-token-move.spec.ts`) - tactical token move -> player `scene_tokens` refetch (the hardest seam; no canvas bridge).
- **Section C** (`section-c-npc-reveal.spec.ts`) - GM reveals NPC -> player roster updates live.
- **Section D** (`section-d-stockpile.spec.ts`) - deposit (INSERT) + qty (UPDATE) + community-create resubscribe.
- **Section E** (`section-e-whispers.spec.ts` + `section-e-pins.spec.ts`) - whisper feed + map-pin refetch.

**MANUAL-ONLY (logged with rationale; per the "pass headless OR logged manual" criterion):**
- **Section B (vehicle):** broadcast-driven (`vehicle_updated`/`firing_arc_toggle` from the popout) + canvas-rendered + needs the popout window + the puffer-fish lane's active fix area. Shared token seam covered by A3.
- **Section A2 (roll engine) + F (infection modal) = the conditions smoke (#5 gate):** the apply-logic (`useRollResolution.ts:623-673`) only fires on an attack that zeroes WP/RP - inherently **dice-gated** (an attack can miss) + session/turn/multi-combatant gated. The brief designates this "stays manual the longest." **Documented manual 2-client procedure (Arena, GM + MARV), to the locked baseline (gate0 `1623c88`):**
  1. GM Start Session + Combat (automated in A1).
  2. Attack a PC to WP=0. PASS: "<name> mortally wounded" feed row on BOTH windows; the wounded PC owner's window shows the mortal-wound/Insight prompt; `death_countdown` + a Stress pip set. Drive RP=0 -> incap + Stress pip.
  3. Wound a PC (WP>0, cut/shot weapon) -> "is wounded and may have to deal with infection" feed row; **End Combat -> infection MODAL on the wounded owner's window.**
  4. GM Restore -> infection + stress + MW + incap clear (the 4). At HEAD lasting wounds do NOT clear; AFTER #5 lands they do (that one assertion belongs to #5's acceptance, not the HEAD baseline).
  This is #5's acceptance gate - run before #5 merges.

**Open items / failures:** none. Everything automated is green on prod. A2/F is the documented manual smoke (above); B is manual-only.

**Net - Gate 0 meets the closure criteria:** every section A-F either passes headless or is logged manual-only with rationale; the console/network sweep is green on every route; runs are repeatable (`npm run test:e2e`). Recommend demoting the Realtime-channels Risk Register entry from YELLOW and promoting the re-arch HOPED-FOR -> PLAYTESTED. **Releasing Stage C is the puffer-fish lane's / Xero's call** - this is the evidence. The 2026-05-25 playtest is the final real-world confirmation on top of this.
