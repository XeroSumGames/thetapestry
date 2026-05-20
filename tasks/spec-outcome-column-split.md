# Spec: `outcome` Column Kind-Discrimination

Closes Tech Debt Ledger item: `outcome` column overloaded for 3 purposes. Closes Phase P2 / A1.3 of `tasks/puffer-fish-platform-plan.md`.

**Audience:** the hunt-and-peck chat that will execute. Puffer-fish wrote this; puffer-fish maintains the spec.

**Status:** SPEC. No code shipped yet.

---

## 1. The problem (already mostly type-safe)

`roll_log.outcome` (text column) does triple duty per the inline doc at `lib/roll-outcomes.ts:1-23`:

1. **Roll-result labels (6 values, capital-case):** `Success`, `Failure`, `Wild Success`, `Dire Failure`, `High Insight`, `Low Insight`. Written by `getOutcome()` for dice-resolved rolls.
2. **Grapple-result labels (3 values, custom strings):** `Grappled!`, `Failed - 1 RP`, `No clear victor`. Written by the grapple branch of `executeRoll`.
3. **Event tags (32 values, snake_case):** `combat_start`, `death`, `loot`, `morale_check`, `wound_infection_warning`, etc. Written by event-only inserts (no dice).

The 2026-05-15 RollOutcome union (commit `87f3063` + `4bbd7eb` + `42d5cd3`) gave the column TypeScript-level type safety. 49 insert sites use `OUTCOME.X` constants; typos at write time fire a TS error. **That's the Tech Debt Ledger band-aid that's already in place.**

The remaining costs of the overload, post-band-aid:

| Cost | Status today | Right fix |
|---|---|---|
| Type-narrowing across kinds (e.g., functions that handle roll-results only) | Manual narrowing | Add a `kind` discriminator helper |
| DB-level integrity (e.g., reject `outcome='death'` on a row with `die1, die2 != 0`) | None | CHECK constraints, requires schema split |
| Reader code branching by kind | switch on raw string | switch on `kind`, then on narrowed value |
| Documentation drift (which values are events?) | Inline comments in roll-outcomes.ts | Codified in the type system |

**Most of the remaining cost is solvable at the TypeScript layer alone, no schema change needed.** That's the recommended shape below.

---

## 2. Two options

### Option A: Type-only kind discrimination (RECOMMENDED)

Split `RollOutcome` into three sub-unions + add a `kind` discriminator helper. No schema change. Pure code.

```ts
// lib/roll-outcomes.ts (additions, not breaking)

export type RollResult =     // 6 values
  | typeof OUTCOME.Success
  | typeof OUTCOME.Failure
  | typeof OUTCOME.WildSuccess
  | typeof OUTCOME.DireFailure
  | typeof OUTCOME.HighInsight
  | typeof OUTCOME.LowInsight

export type GrappleResult =  // 3 values
  | typeof OUTCOME.Grappled
  | typeof OUTCOME.GrappleFailed
  | typeof OUTCOME.GrappleNoVictor

export type EventTag =       // 32 values
  | typeof OUTCOME.action
  | typeof OUTCOME.barter
  // ... 30 more

export type OutcomeKind = 'roll' | 'grapple' | 'event'

// Deterministic: which kind is this outcome?
export function outcomeKind(o: RollOutcome): OutcomeKind {
  // Roll-result first because the 6 values are the hottest hot-path
  if (
    o === OUTCOME.Success || o === OUTCOME.Failure ||
    o === OUTCOME.WildSuccess || o === OUTCOME.DireFailure ||
    o === OUTCOME.HighInsight || o === OUTCOME.LowInsight
  ) return 'roll'
  if (
    o === OUTCOME.Grappled || o === OUTCOME.GrappleFailed ||
    o === OUTCOME.GrappleNoVictor
  ) return 'grapple'
  return 'event'
}

// Type-guard variants for narrowing
export function isRollResult(o: RollOutcome): o is RollResult { ... }
export function isGrappleResult(o: RollOutcome): o is GrappleResult { ... }
export function isEventTag(o: RollOutcome): o is EventTag { ... }
```

**Pros:**
- No schema migration risk.
- Zero downtime, zero dual-write phase.
- Readers narrow naturally via the type guards.
- Compile-time exhaustiveness check on switch statements (the `never` exhaustion pattern).
- Catches 90% of the Tech Debt Ledger value at ~1 session of work.

**Cons:**
- DB-level integrity not enforced. A bad insert (e.g., `outcome='death'` with `die1=4, die2=5`) is not blocked by the DB.
- No SQL-side query optimization by kind (still single text column).

### Option B: Schema split (DEFERRED)

Add `outcome_kind` enum column + tighten `outcome` to be kind-scoped. Migration: add column -> backfill -> dual-write -> migrate readers -> add CHECK constraints -> drop legacy use.

**Pros:**
- DB-level integrity.
- SQL queries can filter by kind without text-matching.
- The column becomes self-documenting at the DB level.

**Cons:**
- Multi-session migration with dual-write phase (riskier than type-only).
- All readers must learn about the new column.
- Backfill of historical rows requires the deterministic map (which IS deterministic, but still a migration).
- The OUTCOME union already gives 90% of this safety at compile time.

**Recommendation:** ship Option A now. Defer Option B unless and until a real "we needed DB-level integrity and didn't have it" incident surfaces. Re-evaluate at the post-launch quiet window (per Tech Debt Ledger 6-month interest rate framing).

---

## 3. Option A migration plan

Type-only. Three phases. Each ships independently.

### Phase O1: Add the sub-unions + kind helper + guards (no breaking)

1. Edit `lib/roll-outcomes.ts`:
   - Add `RollResult` (already exists at L101-L107; keep).
   - Add `GrappleResult` union (3 values).
   - Add `EventTag` union (32 values).
   - Add `OutcomeKind` type.
   - Add `outcomeKind(o: RollOutcome): OutcomeKind` function.
   - Add `isRollResult`, `isGrappleResult`, `isEventTag` type guards.
2. Add unit tests at `tests/lib/roll-outcomes.test.ts`:
   - `outcomeKind('Wild Success')` returns `'roll'`.
   - `outcomeKind('death')` returns `'event'`.
   - `outcomeKind('Grappled!')` returns `'grapple'`.
   - Exhaustiveness: every OUTCOME value maps to exactly one kind (assert via Object.values(OUTCOME).map).
   - Type guard tests: each guard narrows correctly.

**Gate:** tsc clean. `npm test` green. The file is added but nothing imports the new exports yet.

### Phase O2: Migrate readers to narrow on kind

Targets, smallest first:

1. **`lib/roll-helpers.ts:outcomeColor()`** - currently switches on raw outcome strings. Add a kind-discriminating early-exit:
   ```ts
   export function outcomeColor(outcome: string): string {
     const norm = normalize(outcome)  // existing snake_case-tolerant normalizer
     if (norm === 'wild success' || norm === 'high insight') return '#7fc458'
     // ... etc
   }
   ```
   Already works; refactor for clarity:
   ```ts
   export function outcomeColor(outcome: RollOutcome | string): string {
     // Roll-result and grapple-result branches; everything else gets default.
     if (isRollResult(outcome as RollOutcome)) {
       // narrow + switch
     }
     // event tags hit the default branch
   }
   ```
   Pure refactor, same output. New test cases assert the kind narrowing.

2. **`lib/roll-helpers.ts:compactRollSummary()`** - the big branching reader. Currently does ~30 string-match branches inline. Re-structure to switch on kind first:
   ```ts
   export function compactRollSummary(r: ...): string | null {
     const kind = outcomeKind(r.outcome as RollOutcome)
     switch (kind) {
       case 'roll': return summarizeRoll(r)
       case 'grapple': return summarizeGrapple(r)
       case 'event': return summarizeEvent(r)
     }
   }
   ```
   Each sub-function takes a kind-narrowed argument so the inner switch is exhaustive. **This is the highest-leverage rename** - it converts ~30 inline branches into 3 focused sub-functions, each independently testable.

3. **`components/RollsFeed.tsx`** - already branches by outcome in places. Re-structure renderers to switch on kind.

4. **`app/stories/[id]/community/page.tsx`** - already filters events by kind implicitly; make it explicit.

5. **`lib/session-export.ts`** - JSON export structure could group by kind.

**Gate per reader:** unit tests cover the narrowed branches. Snapshot tests for `compactRollSummary` outputs match the pre-refactor strings exactly.

### Phase O3: Catch new outcomes at write time via guard rail

Optional polish. Add a pre-commit guard (similar to `check-em-dashes.mjs`) that:
- Greps for `outcome: '<literal>'` in app code.
- Fails if the literal isn't in the OUTCOME union.
- Suggests `OUTCOME.X` syntax.

The TypeScript layer already catches this on `as const` literals, but `outcome: 'death'` (a plain string) bypasses the union check unless the variable is typed. Guard rail backstops the human discipline.

**Gate:** the script lands + a deliberate-violation test exercise passes.

---

## 4. Estimated session count

- Phase O1: 0.5 session (~1 hour: write types + guards + tests).
- Phase O2: 2-3 sessions (one per reader cluster).
- Phase O3: 0.5 session (optional polish; skip if unnecessary).

**Total: 2.5-4 hunt-and-peck sessions.** Compare to Option B's 4-6 sessions with a dual-write phase.

---

## 5. Risk register

### OC-R1: Wrong-kind values in historical rows

If any historical `roll_log` row has an outcome string NOT in the OUTCOME union, the `outcomeKind()` function will return `'event'` (the catch-all fallback). This may silently mis-categorize edge cases.

**Mitigation:** before shipping Phase O2 reader migrations, run a SQL audit:
```sql
-- Returns outcome values in roll_log that are NOT in the OUTCOME union.
SELECT DISTINCT outcome, count(*) AS row_count
FROM roll_log
WHERE outcome NOT IN (
  'Success', 'Failure', 'Wild Success', 'Dire Failure',
  'High Insight', 'Low Insight',
  'Grappled!', 'Failed - 1 RP', 'No clear victor',
  'action', 'barter', 'cdp', 'clothed_check', 'combat_end',
  'combat_start', 'coordinate', 'death', 'defer', 'drop',
  'encumbrance', 'evolution', 'fed_check', 'incap', 'initiative',
  'loot', 'morale_check', 'pending_heal', 'rations', 'recruit',
  'retention_check', 'revive', 'sprint', 'stress', 'subsistence',
  'wound_infection_warning', 'weapon_malfunction',
  'lasting_wound_acquired', 'advantage_used', 'gather_materials'
)
GROUP BY outcome
ORDER BY row_count DESC;
```
If the audit returns any rows, either:
- Add the missing values to the OUTCOME union + EventTag sub-union.
- Backfill the rows with the correct canonical outcome (if it was a typo).

### OC-R2: `compactRollSummary` regression during the kind-switch refactor

The function has ~30 inline branches today. Refactoring to a switch-on-kind structure means moving each branch into a sub-function. A branch missed or mis-routed = a feed row renders wrong.

**Mitigation:** snapshot test the existing output before the refactor. Run the refactor. Re-run the snapshot. Diff. Zero string diffs = clean refactor. Any diff = investigate (likely a missed branch).

The 121 existing roll-helpers tests already cover many branches; supplement with the snapshot before Phase O2 item #2.

### OC-R3: Type guards cast types unsafely

`isRollResult(o: RollOutcome): o is RollResult` returns a type predicate that the compiler trusts. If the implementation is wrong (e.g., returns true for `'death'`), downstream code that narrows on the guard will fail at runtime.

**Mitigation:** the guards are 6-9 line functions checking against a fixed set of strings. Unit tests assert every OUTCOME value gets the right answer from every guard. No room for drift if the tests stay green.

---

## 6. What this spec is NOT proposing

- **Schema migration:** not now. Option B is documented above as deferred; revisit if real DB-integrity bugs surface.
- **Splitting roll_log into multiple tables:** out of scope. The single-table single-timeline structure works for the feed.
- **Changing the OUTCOME constant values:** they stay. The migration adds layers ABOVE the constants, doesn't change them.
- **A new column on `roll_log`:** none.

---

## 7. Maintenance

Update this spec when:
- The OC-R1 SQL audit returns surprises - log them + add to OUTCOME union.
- A new outcome is added to OUTCOME - it must also land in exactly one sub-union (RollResult / GrappleResult / EventTag). Update this spec + the `outcomeKind()` function in lockstep.
- The kind discrimination surfaces a benefit we didn't predict - document for Option B re-evaluation.

When all 2-3 phases ship + the snapshot tests pass clean + the SQL audit returns zero surprises, archive to `tasks/spec-outcome-column-split-archived.md` with a postmortem.
