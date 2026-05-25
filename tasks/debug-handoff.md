# Debug Handoff

Diagnostic companion to `tasks/handoff.md`. Open this file when:

- A bug report comes in and you don't know where to look first.
- You're about to ship something risky and want to know what you're risking.
- A playtest surfaces a regression and you need to triage it under pressure.
- You're deciding "is this a quick fix or a structural issue?"

Updated when architecture/risk shifts, not every session. Last full review: 2026-05-16 (added test-infra paid-down entry; updated Confidence Ledger TESTED row from "nothing" to 141-test inventory). Refreshed 2026-05-20: test count 141 -> 388 + coverage inventory expanded; em-dash sweep across 409 files / 7099 chars + new check-em-dashes pre-commit guardrail. Risk Register triage 2026-05-20: demoted `lib/campaign-clock.ts`, Initiative state machine, TacticalMap canvas from YELLOW to GREEN-ish (post-2026-05-18 playtest evidence + no fresh bug reports). Held `roll_log` writer YELLOW one extra cycle (2026-05-19 added new write paths: Advantages, FI cutover, Stress narrative, Stabilize Phase 1 cascade) and `app/stories/[id]/table/page.tsx` YELLOW (now 13,192 lines; Stabilize Phase 1 added +200; one extraction shipped, need 3-4 more before demote).

---

## 1. Risk Register - load-bearing parts of the app

Each entry: where it lives, what depends on it, current health, what a player sees if it breaks.

### `app/stories/[id]/table/page.tsx` - **GREEN-ish (demoted 2026-05-24)**
- **What it is:** the in-session game table. **~10,530 lines** (down from 13,192 at the 2026-05-20 peak via the Grand Re-Arch + hook extractions).
- **Touches:** combat, initiative, loot, healing, recruitment, grappling, fog, vehicles, broadcasts, modals, every roll_log write that happens during play.
- **What players see if it breaks:** anything from "rolls don't appear in the feed" to "I can't take my turn" to "the page crashed and I lost my place." This is the throat of the app at session time.
- **Why demoted from YELLOW (2026-05-24):** the YELLOW was "size + coupling + frequent changes -> regression risk." The Grand Re-Arch addressed the mechanism: all DB through `lib/data/*`, all realtime through `lib/realtime/*`, roll resolution in `useRollResolution`, enforced by the `check-arch` ratchets + dependency-cruiser on every commit. The realtime core (combat-start A1, token-move A3 - the hardest seam, NPC reveal, stockpile, map) is now **2-client-validated on prod by the automated Phase 7 suite** (`tasks/phase7-acceptance-2client-testplan.md`). Demote rationale is **verified behavior + enforced architecture**, NOT "small file" - it is still ~10.5k lines (Stage C, the client-state layer, is what dissolves it structurally). **Residual:** the `roll_log` writer-path entry below still holds YELLOW for the 2026-05-25 playtest, and those writes live here - so feed-render bugs post-2026-05-19 still triage to the roll_log path first.
- **First-place-to-look on a bug report from session:** here.

### `lib/campaign-clock.ts` - **GREEN-ish (demoted 2026-05-20)**
- **What it is:** the only writer of `campaigns.clock`. Owns advance() + drainers (rations, subsistence, pending heals).
- **What players see if it breaks:** time doesn't advance, or it does but the wrong things drain (rations don't decrement, heals don't tick, world events don't expire).
- **Why demoted from YELLOW:** Phase 3 a/b/c/d shipped 2026-05-13, playtested green 2026-05-18. No functional changes since (only em-dash sweep + clock-tick log entry). Two days of clean post-playtest behavior plus the Confidence Ledger HOPED-FOR drain on 2026-05-18 = enough evidence to demote. Same tier as Realtime channels now.
- **First-place-to-look:** if anything time-related misbehaves, here.

### `roll_log` writer path - **YELLOW (held)**
- **What it is:** every event that produces a feed row. Touches `lib/roll-outcomes.ts`, `lib/roll-helpers.ts`, the 49 insert sites migrated to `OUTCOME.X` on 2026-05-15.
- **What players see if it breaks:** feed rows render wrong, don't render, or render with wrong colors/labels.
- **Why yellow (held 2026-05-20 triage):** RollOutcome migration playtested green 2026-05-18, but 2026-05-19 added new write paths on this surface (Advantages P3-Q4-b `advantage_used` outcome + C3 broadcast, FI single-modal cutover, Stress Check 12-string narrative lock, Stabilize Phase 1 cascade) plus 2026-05-19 `outcomeColor` dedup (canonical now accepts snake_case too - widens the affected surface). Hold one more playtest cycle (2026-05-25) to verify the new write paths render correctly.
- **First-place-to-look:** if a feed row looks off post-2026-05-19, suspect the new write paths first; if pre-2026-05-19, the RollOutcome migration.

### Initiative state machine - **GREEN-ish (demoted 2026-05-20)**
- **What it is:** turn order, `actions_remaining` decrement, nextTurn cascades, initiative_order RLS.
- **What players see if it breaks:** turns stick (stuck on one player), skip (player gets passed over), or duplicate (two players think it's their turn).
- **Why demoted from YELLOW:** Nana 2-attack stuck-turn bug fixed via SQL RLS tightening on 2026-05-15. No fresh stuck-turn reports through 2026-05-18 playtest. Tier-2 Recruit morale-tick drainer (2026-05-19, `1951d77`) is adjacent but doesn't write to initiative_order or call consumeAction. Stabilize Phase 1 (2026-05-20) consumes action via consumeAction synchronously in onRoll (cleaner than prior actionPreConsumedRef pattern) - direct verification that the consumeAction surface is being exercised by new code without breakage. Same tier as Realtime channels now.
- **First-place-to-look:** combat-turn bugs -> `sql/initiative-order-rls-*.sql` + `lib/initiative-actions.ts` + the consumeAction wrapper in the table page.

### TacticalMap canvas - **GREEN-ish (demoted 2026-05-20)**
- **What it is:** `components/TacticalMap.tsx`. Renders the grid, tokens, fog, range circles, blast overlays.
- **What players see if it breaks:** stale fog (cells stay dark after a PC walks past), wrong range overlay (range circle drawn at wrong size), invisible token movement, fog not clearing when a wall is opened.
- **Why demoted from YELLOW:** `effective` fog cache + drag-end grab-offset fix both playtested green 2026-05-18. GM Share View (`6a4669b`, 2026-05-19) is additive read-only mirror, not a render-path change. Vehicle canvas redraw deps fix (`16e33d6`) shipped 2026-05-15 and survived the playtest. Three clean rounds of evidence; demote.
- **First-place-to-look:** map-render bugs -> `TacticalMap.tsx:1401-1437` (effective fog cache), `:1356-1399` (visible cache).

### Realtime channels (Supabase) - **GREEN-ish (demoted 2026-05-24, vehicle caveat)**
- **What it is:** broadcast events for token moves, fog paint, initiative changes, chat messages, scene switches. As of the Grand Re-Arch, all of these route through `lib/realtime/*` (`useCampaignChannel` / `usePostgresSubscription` / `broadcastOnce`).
- **Why demoted from YELLOW (2026-05-24):** the YELLOW's own demote condition was "hold until the batched Phase 7 2-client acceptance passes every surface." That is now substantially met: the automated Phase 7 suite (10 spec files, green on prod, repeatable via `npm run test:e2e`) 2-client-validates the table core (A1 combat-start, A3 token-move = the hardest seam), NpcRoster reveal (C), community + stockpile incl. the dynamic-IN-filter resubscribe (D), and MapView whispers + pins (E), plus a 92-route console/network sweep. **Caveat (the one residual):** vehicle popout broadcasts (`vehicle_updated` / `firing_arc_toggle`, Section B) are manual-only and ride the 2026-05-25 Minnie playtest for final confirmation - vehicle's shared TOKEN seam is already covered by A3, so the residual is the popout-specific broadcasts. Promote to full GREEN after B confirms at the playtest.
- **What players see if it breaks:** desync between clients. GM moves a token, player doesn't see it move. GM opens a door, player still sees fog.
- **Why bumped from GREEN-ish (2026-05-24 stability audit):** the prior rationale was "older code, stable, hasn't been refactored in months." The re-arch (2026-05-22..24) just rewrote EVERY channel onto the seams - the largest realtime refactor in the app's history. Behavior-preserving by construction + tsc + unit green, but only TacticalMap token-move + combat-start + presence are 2-client-verified on prod. The rest (vehicle / communities / stockpile / MapView) are HOPED-FOR. Per-surface realtime regressions hide without two clients. Hold YELLOW until the batched Phase 7 2-client acceptance passes every surface (then demote). Still zero realtime integration tests.
- **First-place-to-look:** desync between clients -> the seam handler for the affected event (`lib/realtime/events.ts` for the payload type, then the consuming component's `useCampaignChannel` config). Verify the channel re-subscribes when its key (`campaignId` / `channelName`) changes.

### Character creation wizard - **GREEN**
- **What it is:** `components/wizard/*`. Multi-step character builder.
- **What players see if it breaks:** can't create a new character, or character saves with wrong values.
- **Why green:** isolated, doesn't run during sessions, low recent change rate. The PrintSheet + StepEight weapon-helper consolidation today (`dabf888`) is the only recent touch.
- **First-place-to-look:** character-creation bugs → start with the failing step's `StepN.tsx` file.

### `map_pins` world-pin moderation - **GREEN (CLOSED 2026-05-24 - server enforcement applied + verified)**
- **What it was:** world-map pin moderation (pending-vs-approved) was decided ONLY in the browser (`MapView.tsx:948`, `QuickAddModal.tsx:236`) with no server-side enforcement, so a non-Thriver could REST-insert (public anon key + own session token) a world-visible `pin_type='gm'`/`status='approved'` pin with zero review. MEDIUM - content-moderation evasion on a public surface; NOT a data breach / PII leak / privilege escalation beyond content. Same bug CLASS the campfire trigger (`enforce_moderation_on_insert`) closed; `map_pins` had been left out. Found by the E2E lane building `world-pin-to-queue.spec.ts`; full write-up in `tasks/security-finding-map-pins-moderation-2026-05-24.md`.
- **Fix (APPLIED to live 2026-05-24, Xero-authorized):** `BEFORE INSERT` trigger `trg_enforce_map_pin_moderation` (SECURITY DEFINER, `sql/map-pins-moderation-enforce-2026-05-24.sql`) - Thriver values respected; a non-Thriver private pin clamped to `status='active'` (owner-only, blocks the private+approved leak since "View pins" SELECT keys on `status` not `pin_type`); any other non-Thriver pin forced to `pin_type='rumor'`/`status='pending'`. **Verified on live:** trigger + function present + SECURITY DEFINER, and a non-Thriver-context `gm`/`approved` insert came back forced to `rumor`/`pending` (transactional test, zero rows persisted). Revert: `DROP TRIGGER trg_enforce_map_pin_moderation ON public.map_pins`.
- **Residual (NOT Puffer):** E2E lane adds the "Survivor REST insert -> forced pending" regression assertion (routed in `todo.md`).
- **First-place-to-look:** if a non-Thriver pin ever appears world-visible / styled as GM, confirm this trigger is still present + the `map_pins` "View pins" SELECT policy in `sql/_baseline/schema.sql`.

### `characters` cross-user writes (GM loot/award + PC trade) - **GREEN (all 8 flows resolved 2026-05-25)**
- **UPDATE 2026-05-25 (CLOSED):** the client rewire LANDED (E2E lane, cross-lane, Xero-authorized). `onGiveItem` now calls the `give_item_to_character` RPC (atomic both-sides), `InventoryPanel.confirmGive` skips the client giver-decrement for the PC case (no double-spend vs the RPC's `SELECT FOR UPDATE`). Verified by the un-fixme'd `inventory-trade.spec` PC-trade test (marv->percy: item MOVES, receiver gains + giver loses) + full re-cert clean. Flows 2-8 (GM loot/award/ration) were fixed 2026-05-24 by the GM-of-campaign UPDATE policy. Risk Register: YELLOW -> GREEN.
- **PRIOR 2026-05-24:** GM-of-campaign UPDATE policy APPLIED + verified live (flows 2-8). PC-PC trade (flow 1): Option B - `give_item_to_character` SECURITY DEFINER RPC APPLIED + verified live, but nothing called it yet (the YELLOW residual, now closed).
- **What it is:** `characters` UPDATE RLS is owner-only (`auth.uid() = user_id`) + a Thriver bypass (`is_thriver()`). A GM is NOT a Thriver, so any client write to ANOTHER player's `characters` row silently no-ops (RLS returns 0 rows, no error). Verified live 2026-05-24.
- **What players see if it bites:** items "given" by the GM (loot, NPC drops, object loot) or by another player (PC-PC trade) **vanish** - removed from the source, never land on the target. Rations not decremented (but stress applied = desync). Lasting wounds never persist on the victim's sheet. 8 flows total (`tasks/finding-characters-rls-cross-user-writes-2026-05-24.md`).
- **Why RED + why latent:** silent data loss across the whole GM loot/award/ration loop. It does NOT show in playtest because dev GMs are also Thrivers (the bypass covers them). At the 500-user beta, GMs are ordinary Survivors -> it breaks for real. **COMBAT IS SAFE** - HP/RP/stress/conditions write to `character_states`, which already has a member/GM policy; only `characters.data` writes (inventory/rations/lasting-wounds/log) hit the gap.
- **Fix (written, apply gated = Xero):** `sql/characters-gm-write-rls-2026-05-24.sql` adds a GM-of-campaign UPDATE policy on `characters` (scoped, mirrors `character_states`; resolves flows 2-8). PC-PC trade (flow 1, peer-to-peer) routes separately through a SECURITY DEFINER inventory-only RPC [PF writes] + client rewire [HP], OR is disabled for the beta. NOT a blanket member-write policy (that would let any peer rewrite a teammate's whole sheet).
- **First-place-to-look:** "I gave/looted an item and it disappeared" -> this gap; check `characters` has the GM UPDATE policy + that the flow uses it (or the trade RPC), not a raw owner-gated `.update`.

---

## 2. Tech Debt Ledger - shortcuts taken, with their interest rate

Each entry: what we did, what it costs today, what it costs if untouched in 6 months.

### `outcome` column overloaded for 3 purposes
- **What:** one column stores roll results (capital-case), event tags (lowercase), and grapple results (custom strings).
- **Cost today:** TypeScript band-aid via RollOutcome union (shipped 2026-05-15). Caught one dead-code path in the sprint handler.
- **Cost in 6 months if untouched:** schema migration becomes a 2-day job instead of an afternoon. Every new event tag piles more semantic weight on a column that was never designed for it.
- **Right fix when ready:** split into `outcome_kind` (enum: 'roll' | 'event' | 'grapple') + `outcome_value` (typed by kind). Or move event-only rows to a separate `roll_log_events` table.

### `app/stories/[id]/table/page.tsx` is 10,000+ lines
- **What:** one client component carrying combat, initiative, loot, healing, recruitment, grappling, fog, vehicles, broadcasts.
- **Cost today:** every refactor risks adjacent breakage. Realtime + state coupling is hard to reason about. Bug investigations are slow.
- **Cost in 6 months if untouched:** any structural change becomes multi-day work. The file resists testing because of its size + coupling.
- **Right fix when ready:** decompose into focused hooks (`useCombat`, `useInitiative`, `useLoot`) + state machines for the multi-step flows + per-concern subcomponents. Multi-week project; do incrementally.

### `damage_json: { ... } as any` casts
- **What:** at least 2 sites cast damage payload to `any` to skip type-checking.
- **Cost today:** type safety hole around damage. Bugs here can pass typecheck.
- **Cost in 6 months:** more sites accumulate, type guarantees erode further.
- **Right fix when ready:** define a `DamagePayload` interface, type the writes, type the reads.

### ~~No automated tests~~ - **PAID DOWN 2026-05-16**
- **Was:** zero test files. Every refactor was "typecheck passed, fingers crossed."
- **Now:** 388 unit tests across 20 files in `tests/lib/` cover the high-value pure helpers and supporting modules:
  - **Roll engine** - roll-helpers (getOutcome, outcomeColor, every compactRollSummary branch including ATTRIBUTE/STRESS/STABILIZE/HEAL/UNJAM/REPAIR/DISTRACT/RECRUIT/Coord-Effort/Vehicle narrative locks), roll-outcomes (OUTCOME constant union), rolls-feed-collapse (Coord Effort chain aggregation).
  - **Character math** - cdp-costs (full ladder + Lv4 gate), xse-engine (cumulative attrs + step up/down), damage (DM stacking + Stun rpFromRaw + reactive-melee-only armor), encumbrance (limit math + backpack + overload).
  - **Community math** - community-logic (morale CMod, departure pct, labor pool math, departure picker priority).
  - **Combat actions** - first-impression-resolver (Phase 1 pure-helper extraction).
  - **Vehicles** - fuel-storage (per-vehicle drum math), brewing-supplies (stockpile + Gather Materials).
  - **Advantages (P3 Q4-b)** - advantages library (schema + grant + use + clamp).
  - **Infrastructure** - sentry-filters (benign-event drops), sentry-realtime (event hooks), playtest-recorder (GM-cascade + tab-local + localStorage resume), supabase-errors (missing-schema message), safe-upload (filename injection guard), signed (URL signature verifier), image-utils, npc-drag-drop (player-side folder reorder).

  Suite runs in ~430ms on every commit + every push to main. The pre-commit hook gates on the full suite + 4 guardrails (font-sizes, role-literals, preview-sync, em-dashes).
- **Still missing:** component tests, integration tests against a real DB, E2E browser tests. Those land separately if/when warranted - the cost/benefit on those is much higher than on pure-helper unit tests.
- **Habit going forward:** every bug we fix gets one test added. Over months that suite grows to cover real failure modes, not hypothetical ones.

### `compactRollSummary` parses labels via regex
- **What:** `lib/roll-helpers.ts` derives structured data ("X searched the corpse of Y") by regex-matching the `label` field.
- **Cost today:** brittle to label changes. Change a label text, break a parser.
- **Cost in 6 months:** more parsers accumulate, label changes get scarier.
- **Right fix when ready:** add structured columns (`event_type`, `target_name`, etc.) to roll_log; deprecate label parsing.

---

## 3. Confidence Ledger - what's actually verified

Mapped to: if a player reports a bug in area X today, how surprised should I be?

- **TESTED (automated):** 622 unit tests across 37 files in `tests/lib/` covering roll-helpers (121), roll-outcomes (48), damage-payload (40), table-roll-context (38), community-logic (29), fuel-storage (21), community-stage (20), safe-upload (20), brewing-supplies (19), first-impression-resolver (18), xse-engine (18), cdp-costs (17), damage (15), advantages (14), conditions (13), encumbrance (13), npc-drag-drop (12), range-profiles (12), distract-helpers (11), initiative-actions (11), sentry-filters (11), stabilize-helpers (10), combat-targeting (9), gut-instinct-helpers (8), supabase-errors (8), tactical-view (8), vehicle-damage (8), confirm-delete (7), playtest-recorder (6), rolls-feed-collapse (6), session-log (6), weapons (6), roll-log-stamp (5), sentry-realtime (5), image-utils (3), signed (3), tactical-spawn (3). Suite runs in ~735ms on every commit + every push to main. (Auto-refreshed 2026-05-24 via `scripts/refresh-ledger.mjs`.)
- **TYPECHECKED + GUARDRAILS PASSED:** everything that shipped this week. Catches type errors, font sizes, role-literal violations. Does NOT catch logic bugs.
- **PLAYTESTED RECENTLY (within last 2 weeks):** Phase 2 features, character sheet basics, weapon attack flow, Coordinated Effort full (per-participant Withdraw retcon validated), vehicle subsystem (passenger vanish model + count badge + drag-end grab-offset + MOVE HERE + Disembark + cross-tab sync), Heal-LI infection cascade, Day-0 Lasting Damage modal + reload-resume, Lasting Wound chips (PC + NPC), HIDE ALL panic button, pin sidebar (search + OSRM route planner + Alt+click waypoints + travel-mode ETA), QuickAddModal pin picker, GM Notes draft persistence, Token Creator rename + Tools sidebar reorder, moderation email triggers, bug report RESPOND + Export JSON, all 2026-05-13/14/15 ships (Phase 3 a/b/c/d drainers, 10 feed-audit drift fixes, Healing on Time-Tick, Year-0 calendar, Export Session Log, Weapon Repair, die3, Luxury Ration consume, effective fog cache, insight uncap, role-check sweep, helper consolidations, RollOutcome refactor, Thriver godmode UI sweep). Validated 2026-05-18 via three testplans (preplay-testsmoke-2026-05-17, polish-pass-2026-05-14, thriver-godmode-sweep).
- **VALIDATED BY AUTOMATED 2-CLIENT SUITE (2026-05-24) - the Grand Re-Architecture:** all 6 god-components migrated onto `lib/data/*` + `lib/realtime/*` (Phases 1-6), console driven to 0, then the realtime core proven across two live prod clients by the Playwright Phase 7 suite (10 spec files, repeatable via `npm run test:e2e`): combat-start (A1), tactical token-move (A3, the hardest seam), NPC reveal (C), stockpile deposit+qty+dynamic-IN resubscribe (D), whispers + map pins (E), plus a 92-route console/network sweep. This is a STRONGER evidence class than a single manual playtest (repeatable, headless, broad). **Still HOPED-FOR within the re-arch:** vehicle popout broadcasts (Section B, rides the 2026-05-25 playtest) and the combat-math + end-of-combat infection modal (A2/F = the documented manual conditions smoke, the #5 gate). See `tasks/phase7-acceptance-2client-testplan.md`.
- **HOPED-FOR (shipped + typechecked but not played):** 2026-05-19 batch (~50 commits post-2026-05-18 playtest). Tier-2 Recruit (Phase A approach flags, Phase B morale-tick drainer + Escape Pending, Phase C modal locked-approach gates), Vehicles Q4-c (per-vehicle fuel storage via 55-Gal Drums) + Q4-d (brewing-supplies stockpile + Gather Materials), P3 Q4-b Advantages (schema + library + GM grant dialog + player tab + Use button + Award-on-feed + C3 broadcast), FI streamline (Phase 1 pure-helper extraction, Phase 2 single-modal flow, Phase 3 Insight Die spend + cutover), table refactor (`useHeaderMenus` extraction), First Impression RLS fix for non-GM players, Sentry-capture supabase errors, GM Share View on tactical map, NPCs CLOSE ALL + Esc + folder reorder + player drag/drop, GM-cascade playtest recorder + localStorage resume, player-bar online-near-GM sort, Stress Check 12-string narrative lock, narrative polish across HEAL / UNJAM / REPAIR / Stabilize / Gut Instinct / Group Check / First Impression / DRIVE / BREW / NAVIGATE. Drain target: 2026-05-25 playtest per `tasks/pre-playtest-smoke-2026-05-25.md`.

When a player reports a bug in something on the HOPED-FOR list, your default reaction should be "that's plausible, let me check" not "weird, that should work."

---

## 4. Triage Playbook - when a bug comes in

Run this in order, not in parallel. Each step is cheap; the goal is to spend the bare minimum before knowing what kind of bug you're dealing with.

1. **What does the player see?** Get the symptom in their words, not your interpretation. "The button is grey" is data. "The button is broken" is not.
2. **Which load-bearing part is implicated?** Cross-ref the Risk Register (Sec. 1). Most bugs route to one of the listed parts.
3. **Is this a recent change?** Run `git log --since="7 days ago" -- <area>` for the relevant file/dir. If something shipped recently in that area, suspect it first.
4. **Quick sanity check:** does the codebase still pass its guardrails? `npx tsc --noEmit && node scripts/check-font-sizes.mjs && node scripts/check-role-literals.mjs`. If any fail, fix those before debugging the reported bug - they're often related.
5. **15-minute rule:** if a recent change is implicated and the fix isn't obvious in 15 minutes, **revert first, investigate second**. The revert command is in each commit's chat summary. A reverted bug is a non-bug; a bug being actively investigated is still a live bug for any player playing right now.
6. **After the fix lands:** add a test for it (once test infra is up). This is the single habit that bends the bug-rate curve over time.

---

## 5. Pre-Ship Checklist - questions Claude must answer before shipping anything non-trivial

When Claude proposes a change, expect this report BEFORE the ship:

1. **If this breaks at the table mid-session, what do players see?**
2. **How would we know it broke without a player telling us?** (Today the answer is usually "we wouldn't." Saying that out loud is the point.)
3. **Symptom patch or root-cause fix?** If patch, what's the cause?
4. **Nth time touching this area in 30 days?** If N is high (3+), is the right move restructuring rather than patching again?
5. **What does "undo this" look like, and how fast?** (The revert command, plus any DB rollback if the commit included SQL.)

This list belongs at the top of `tasks/handoff.md` too, as a daily reminder. The 15-minute rule (Sec. 4, item 5) is the operational version of this.

---

## 6. What testing would have caught

As of 2026-05-16 the listed examples below ARE covered. Kept here as a calibration record of what unit tests buy us.

A look back at recent ships to calibrate "what would tests have prevented?"

- **2026-05-15 RollOutcome migration (3 commits, 51 sites touched):** a single unit test asserting `getOutcome(14, 6, 6).returns('High Insight')` + a handful of switch-case smoke tests would have made this refactor low-risk instead of "fingers crossed."
- **2026-05-15 role-check sweep (5 sites):** an integration test loading a Thriver profile and asserting `isThriver(profile) === true` would have prevented the `String(x).toLowerCase()` shape from being missed in the first place. (Caught here by the tightened guardrail; tests would catch it sooner.)
- **2026-05-15 effective fog cache:** a unit test on `computeEffectiveFog(visible, rawFog, hasPCs, hasBlockers, grid)` returning the same set as the inline old code, given a fixed input, would have made the perf refactor mechanical.
- **2026-05-14 Insight Dice on Death "1WP+1RP total" canon fix:** a unit test on the death-recovery math would have made it impossible to regress.
- **2026-05-09 Stun weapon canon (Taser 1WP/4RP, Cattle Prod 2WP/8RP):** unit tests on `calculateDamage()` with stun-tagged inputs would lock the canon into code permanently.

Pattern: pure-function unit tests on `lib/` would have caught nearly everything substantive that needed reverting in the last month. Cost is one-time setup + ~60 tests; payoff is permanent.

---

## 7. Maintenance Notes

- Update this file when a load-bearing part's health changes (yellow → green after a playtest with no regression; green → yellow after a big refactor or near-miss).
- Update the Tech Debt Ledger when a shortcut becomes more painful (interest rate rises) or when one gets paid down.
- The Confidence Ledger updates after every playtest: move items from HOPED-FOR to PLAYTESTED RECENTLY, or down to a bug list if something failed.
- This file is the doc you open under pressure. Keep it scannable. Resist the urge to add nuance that obscures the signal.
