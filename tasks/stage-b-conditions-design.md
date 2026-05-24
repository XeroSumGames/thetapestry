# Stage B - Conditions subsystem: design

**Status: DESIGN (puffer-fish, 2026-05-24). Engineering decisions are LOCKED (mine); two product/canon calls are flagged for Xero (below). No DB change - the schema part is dry-run only until Xero confirms.** Grounded in a verified read-only audit (every claim spot-checked against the code, 2026-05-24).

## The verified map (how the 5 conditions live today)

| Condition | PC store | NPC store | Expiry clock | Restore clears? |
|---|---|---|---|---|
| Infection (7 fields) | `character_states.infection_*` | `campaign_npcs.infection_*` | in-game **day** clock (`drainInfectionDays`) | yes |
| Stress | `character_states.stress` | **none (no NPC column)** | none | yes (PC) |
| Mortal wound | `character_states.death_countdown` | `campaign_npcs.death_countdown` | combat **round** upkeep | yes |
| Incap | `character_states.incap_rounds` | `campaign_npcs.incap_rounds` | combat **round** upkeep | yes |
| Lasting wounds | `characters.data.lastingWounds` (jsonb-in-data) | `campaign_npcs.lasting_wounds` (real jsonb col) | none | **no** |

**The real problems (verified):** (1) no shared apply/clear path - MW/incap/stress are hand-inlined identically at ~9 sites in `useRollResolution.ts` + `page.tsx`; (2) the infection/stress `as any` reads come from the in-memory `liveState` object being built `} as any` at `page.tsx:1025` (the DB types are complete - so this is a code fix, not schema); (3) lasting wounds use two different idioms split PC-vs-NPC and have no realtime of their own on the PC side; (4) `campaign_npcs` has no `stress` column; (5) character-sheet's select omits infection + lasting wounds, so that surface silently drops 2 of 5.

## Design principle (the key call)

**Unify the CONTRACT, not the physics.** The clock-domain split is correct and stays: infection legitimately ticks per in-game day, MW/incap per combat round, stress/lasting-wounds have no decay by rule. Do NOT force one expiry driver - that would break canon to satisfy tidiness. What unifies is one apply/clear/read/reset API over the existing columns.

## LOCKED engineering decisions (mine - shipping behind ratchets + the 2-client smoke)

1. **Type `liveState`** (DISPATCHED 2026-05-24, background agent). Kills the infection/stress `as any` cluster. Pure code, un-gated. This is the typed read-model the chips already funnel through (`PlayerStatusChips`).
2. **One `lib/conditions.ts` API** - pure helpers + thin data calls: `applyMortalWound`, `applyIncap`, `addStress` (cap 5), `applyInfection`, `applyLastingWound`, `clearConditions(set)`, and a `tickConditions` that dispatches to the RIGHT clock (round vs day) rather than merging them. Collapse the ~9 inlined MW/incap/stress writes behind it. Behavior-preserving; the 2-client smoke is the gate.
3. **Restore routes through `clearConditions`** so the "clears every condition" promise can't drift again (the audit found Restore's own comment over-claims today; once it calls the one API, comment and behavior converge).
4. **Fix the character-sheet select** to include infection + lasting wounds (small code fix; that surface should not silently drop conditions).

## FLAGGED for Xero (genuine product/canon calls, NOT engineering)

1. **NPC stress - RESOLVED (Xero 2026-05-24): NO, narrative only.** Stress is a PC-only mechanic; for NPCs it is purely narrative flavor, never a tracked stat. So: do NOT add a `campaign_npcs.stress` column - the PC/NPC asymmetry is INTENTIONAL and correct. `addStress` in the conditions API stays PC-only (no NPC branch). No migration. (Locked in `decisions.md`.)
2. **(Engineering call, mine, but schema-gated to apply):** move PC lasting wounds from `characters.data.lastingWounds` (jsonb-in-data, no realtime) to a real `characters.lasting_wounds` column to match NPCs + get realtime parity. This is a schema change + a one-time backfill. I'll write + dry-run it; applying it is the bright-line confirm.

## Sequencing within Stage B

- **Un-gated, ships now:** liveState typing (in flight) -> `lib/conditions.ts` API + route the inlined writes + Restore through it -> char-sheet select fix. All behavior-preserving, gated by tsc + tests + ratchets, validated by the 2-client conditions smoke (Playwright lane / manual).
- **Gated (dry-run -> your confirm):** the lasting-wounds column move (+ backfill), and NPC stress IF canon wants it.

The schema migrations get written and dry-run here; nothing touches live until you confirm.

## `lib/conditions.ts` API surface (build-ready spec for task #5)

Decided now so #5 can be built to spec. A `ConditionTarget` discriminates PC (`character_states` row + `characters.data` for lasting wounds) vs NPC (`campaign_npcs` row). Functions are thin writers over the existing columns + the pure canon math (some already exist: `mortalWoundCountdown(phy)`, the incap formula `max(1, 4-phy)`, stress cap 5):

- `applyMortalWound(target, phy)` - sets `death_countdown = mortalWoundCountdown(phy)` + the on-entry stress pip (the WP=0 path).
- `applyIncap(target, phy)` - sets `incap_rounds = max(1, 4-phy)` + the on-entry stress pip (the RP=0 path).
- `addStress(target)` - +1, cap 5. (PC only until the NPC-stress canon call lands - task #6.)
- `applyInfection(target, {state, daysLeft, lastingRisk, severity, infectedBy})` - the 7-field write + the RP-to-floor(max/2) cap.
- `applyLastingWound(target, woundName)` - PC -> `characters.data.lastingWounds` (or the new column if #7 lands); NPC -> `campaign_npcs.lasting_wounds`.
- `clearConditions(target, set?)` - the Restore reset; default clears ALL (incl. lasting wounds, fixing today's gap). Restore routes through this.

**Two clocks stay separate (NOT one `tick`):** `tickCombatConditions` (round upkeep: MW + incap) stays in the table upkeep; `drainDayConditions` (infection) stays in `campaign-clock.ts`. The API unifies apply/clear/read, not expiry.

**Merge gate for #5:** this routes ~9 combat-hot-path writes, and unit tests do not cover multi-client combat state, so #5 does NOT blind-merge to main. Its acceptance is a **2-client conditions smoke** (wound -> infection apply, MW/incap entry + stress pip, Restore clears the set, propagation to the other client). That smoke is owned by the Playwright lane (a Gate-0 successor) - coordinate before #5 lands. Build behind a worktree + tsc/tests/ratchets; merge only after the smoke is green. This respects the locked posture (validated-per-slice, no unvalidated combat code with playtesters live).
