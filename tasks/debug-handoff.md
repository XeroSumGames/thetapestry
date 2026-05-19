# Debug Handoff

Diagnostic companion to `tasks/handoff.md`. Open this file when:

- A bug report comes in and you don't know where to look first.
- You're about to ship something risky and want to know what you're risking.
- A playtest surfaces a regression and you need to triage it under pressure.
- You're deciding "is this a quick fix or a structural issue?"

Updated when architecture/risk shifts, not every session. Last full review: 2026-05-16 (added test-infra paid-down entry; updated Confidence Ledger TESTED row from "nothing" to 141-test inventory).

---

## 1. Risk Register — load-bearing parts of the app

Each entry: where it lives, what depends on it, current health, what a player sees if it breaks.

### `app/stories/[id]/table/page.tsx` — **YELLOW**
- **What it is:** the in-session game table. One 10,000+ line client component.
- **Touches:** combat, initiative, loot, healing, recruitment, grappling, fog, vehicles, broadcasts, modals, every roll_log write that happens during play.
- **What players see if it breaks:** anything from "rolls don't appear in the feed" to "I can't take my turn" to "the page crashed and I lost my place." This is the throat of the app at session time.
- **Why yellow:** size + coupling + frequent changes + zero tests. Every refactor here is "typecheck passed, fingers crossed."
- **First-place-to-look on a bug report from session:** here.

### `lib/campaign-clock.ts` — **YELLOW**
- **What it is:** the only writer of `campaigns.clock`. Owns advance() + drainers (rations, subsistence, pending heals).
- **What players see if it breaks:** time doesn't advance, or it does but the wrong things drain (rations don't decrement, heals don't tick, world events don't expire).
- **Why yellow:** Phase 3 a/b/c/d shipped 2026-05-13, playtested green 2026-05-18. Demote candidate next review — keeping YELLOW one more cycle because the drainers touch multiple state surfaces and one clean playtest isn't a full audit.
- **First-place-to-look:** if anything time-related misbehaves, here.

### `roll_log` writer path — **YELLOW**
- **What it is:** every event that produces a feed row. Touches `lib/roll-outcomes.ts`, `lib/roll-helpers.ts`, the 49 insert sites migrated to `OUTCOME.X` on 2026-05-15.
- **What players see if it breaks:** feed rows render wrong, don't render, or render with wrong colors/labels.
- **Why yellow:** the 49-site RollOutcome migration shipped 2026-05-15 is the largest single-day change to this path in the project's history. Playtested green 2026-05-18 — keeping YELLOW one cycle because feed-rendering bugs can be subtle (wrong color, slightly-off label).
- **First-place-to-look:** if a feed row looks off post-2026-05-15, suspect the migration first.

### Initiative state machine — **YELLOW**
- **What it is:** turn order, `actions_remaining` decrement, nextTurn cascades, initiative_order RLS.
- **What players see if it breaks:** turns stick (stuck on one player), skip (player gets passed over), or duplicate (two players think it's their turn).
- **Why yellow:** Nana 2-attack initiative-stuck bug fixed via SQL RLS tightening on 2026-05-15. No fresh stuck-turn reports as of 2026-05-18 playtest; demote candidate after one more playtest with active combat.
- **First-place-to-look:** combat-turn bugs → `sql/initiative-order-rls-*.sql` + `lib/initiative-actions.ts` + the consumeAction wrapper in the table page.

### TacticalMap canvas — **YELLOW**
- **What it is:** `components/TacticalMap.tsx`. Renders the grid, tokens, fog, range circles, blast overlays.
- **What players see if it breaks:** stale fog (cells stay dark after a PC walks past), wrong range overlay (range circle drawn at wrong size), invisible token movement, fog not clearing when a wall is opened.
- **Why yellow:** the `effective` fog cache (commit `e83514b`, 2026-05-15) drops O(n²) draw work to zero on cache hit, but the cache key surface is non-trivial. Cache invalidation bugs would manifest as stale visual state. Playtested green 2026-05-18; also drag-end grab-offset fix (`d2ba6b6`, 2026-05-17) validated same day.
- **First-place-to-look:** map-render bugs → `TacticalMap.tsx:1401-1437` (effective fog cache), `:1356-1399` (visible cache).

### Realtime channels (Supabase) — **GREEN-ish**
- **What it is:** broadcast events for token moves, fog paint, initiative changes, chat messages, scene switches.
- **What players see if it breaks:** desync between clients. GM moves a token, player doesn't see it move. GM opens a door, player still sees fog.
- **Why green-ish:** older code, stable, hasn't been refactored in months. But also: zero tests, and the failure mode is hard to detect without two clients.
- **First-place-to-look:** desync between clients → look at the broadcast send + receive pair for the affected event.

### Character creation wizard — **GREEN**
- **What it is:** `components/wizard/*`. Multi-step character builder.
- **What players see if it breaks:** can't create a new character, or character saves with wrong values.
- **Why green:** isolated, doesn't run during sessions, low recent change rate. The PrintSheet + StepEight weapon-helper consolidation today (`dabf888`) is the only recent touch.
- **First-place-to-look:** character-creation bugs → start with the failing step's `StepN.tsx` file.

---

## 2. Tech Debt Ledger — shortcuts taken, with their interest rate

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

### ~~No automated tests~~ — **PAID DOWN 2026-05-16**
- **Was:** zero test files. Every refactor was "typecheck passed, fingers crossed."
- **Now:** 141 unit tests across 7 files in `tests/lib/` cover the high-value pure helpers (roll-helpers, cdp-costs, community-logic, encumbrance, damage, xse-engine, roll-outcomes). Pre-commit hook runs the suite (~230ms); GitHub Actions runs it again on every push.
- **Still missing:** component tests, integration tests against a real DB, E2E browser tests. Those land separately if/when warranted - the cost/benefit on those is much higher than on pure-helper unit tests.
- **Habit going forward:** every bug we fix gets one test added. Over months that suite grows to cover real failure modes, not hypothetical ones.

### `compactRollSummary` parses labels via regex
- **What:** `lib/roll-helpers.ts` derives structured data ("X searched the corpse of Y") by regex-matching the `label` field.
- **Cost today:** brittle to label changes. Change a label text, break a parser.
- **Cost in 6 months:** more parsers accumulate, label changes get scarier.
- **Right fix when ready:** add structured columns (`event_type`, `target_name`, etc.) to roll_log; deprecate label parsing.

---

## 3. Confidence Ledger — what's actually verified

Mapped to: if a player reports a bug in area X today, how surprised should I be?

- **TESTED (automated):** 174 unit tests across `tests/lib/` covering roll-helpers (getOutcome, outcomeColor, compactRollSummary verbatim branches + attribute-check narrative + em-dash prefix strip), cdp-costs (the full cost ladder + Lv4 gate), community-logic (morale CMod / departure pct / labor pool math / departure picker priority), encumbrance (limit math + backpack + overload), damage (DM stacking + Stun rpFromRaw + reactive-melee-only armor), xse-engine (cumulative attrs/skills + step up/down), roll-outcomes (every OUTCOME constant value locked), sentry-realtime (event hooks), image-utils, rolls-feed-collapse (Coordinated Effort chain aggregation per Xero 2026-05-18). Suite runs in ~270ms on every commit + every push to main.
- **TYPECHECKED + GUARDRAILS PASSED:** everything that shipped this week. Catches type errors, font sizes, role-literal violations. Does NOT catch logic bugs.
- **PLAYTESTED RECENTLY (within last 2 weeks):** Phase 2 features, character sheet basics, weapon attack flow, Coordinated Effort full (per-participant Withdraw retcon validated), vehicle subsystem (passenger vanish model + count badge + drag-end grab-offset + MOVE HERE + Disembark + cross-tab sync), Heal-LI infection cascade, Day-0 Lasting Damage modal + reload-resume, Lasting Wound chips (PC + NPC), HIDE ALL panic button, pin sidebar (search + OSRM route planner + Alt+click waypoints + travel-mode ETA), QuickAddModal pin picker, GM Notes draft persistence, Token Creator rename + Tools sidebar reorder, moderation email triggers, bug report RESPOND + Export JSON, all 2026-05-13/14/15 ships (Phase 3 a/b/c/d drainers, 10 feed-audit drift fixes, Healing on Time-Tick, Year-0 calendar, Export Session Log, Weapon Repair, die3, Luxury Ration consume, effective fog cache, insight uncap, role-check sweep, helper consolidations, RollOutcome refactor, Thriver godmode UI sweep). Validated 2026-05-18 via three testplans (preplay-testsmoke-2026-05-17, polish-pass-2026-05-14, thriver-godmode-sweep).
- **HOPED-FOR (shipped + typechecked but not played):** *(empty — drained 2026-05-18)*

When a player reports a bug in something on the HOPED-FOR list, your default reaction should be "that's plausible, let me check" not "weird, that should work."

---

## 4. Triage Playbook — when a bug comes in

Run this in order, not in parallel. Each step is cheap; the goal is to spend the bare minimum before knowing what kind of bug you're dealing with.

1. **What does the player see?** Get the symptom in their words, not your interpretation. "The button is grey" is data. "The button is broken" is not.
2. **Which load-bearing part is implicated?** Cross-ref the Risk Register (Sec. 1). Most bugs route to one of the listed parts.
3. **Is this a recent change?** Run `git log --since="7 days ago" -- <area>` for the relevant file/dir. If something shipped recently in that area, suspect it first.
4. **Quick sanity check:** does the codebase still pass its guardrails? `npx tsc --noEmit && node scripts/check-font-sizes.mjs && node scripts/check-role-literals.mjs`. If any fail, fix those before debugging the reported bug — they're often related.
5. **15-minute rule:** if a recent change is implicated and the fix isn't obvious in 15 minutes, **revert first, investigate second**. The revert command is in each commit's chat summary. A reverted bug is a non-bug; a bug being actively investigated is still a live bug for any player playing right now.
6. **After the fix lands:** add a test for it (once test infra is up). This is the single habit that bends the bug-rate curve over time.

---

## 5. Pre-Ship Checklist — questions Claude must answer before shipping anything non-trivial

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
