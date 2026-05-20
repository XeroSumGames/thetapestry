# Spec: `compactRollSummary` Regex Parser Deprecation

Closes Tech Debt Ledger item: `compactRollSummary` parses labels via regex. Closes Phase P2 / A1.4 of `tasks/puffer-fish-platform-plan.md`.

**Audience:** the hunt-and-peck chat that will execute. Puffer-fish wrote this; puffer-fish maintains.

**Status:** SPEC. No code shipped yet.

---

## 1. The problem

`lib/roll-helpers.ts:compactRollSummary` derives structured data from the prose `label` field via regex. ~30 distinct regex patterns extract weapon names, skill names, target names, NPC names, vehicle names, evolution targets, etc.

Every label-string change is a parser-break risk. Examples of the brittleness:

- A label changed from `Cree Hask - Stabilize Marcus` to `Cree Hask: Stabilize Marcus` would break the stabilize regex.
- Adding an emoji prefix (e.g., the recruit `🤝` prefix) requires updating the regex too.
- The em-dash sweep on 2026-05-19 needed careful work to NOT break the suffix-strip prefix detector (which handles BOTH `<name> - <label>` and `<name> - <label>`).
- Each playtest reveals 1-2 label inconsistencies; some are fixed in labels, some in the regex.

This makes label authoring expensive. Every new feed event is "write the label + write the regex + write the test + verify the preview HTML."

### Current regex inventory

| Pattern (sample) | Purpose | Line |
|---|---|---|
| Suffix-strip prefix | Detect `<name> - ` or `<name> - ` prefix | L99-L106 |
| `^Infection Check\s*\((Wound\|Sickness)\)` | Infection check kind | L172 |
| `^Ready\s+(.+?)(?:\s+\(.+\))?$` | Weapon-ready, capture weapon | L235 |
| `^Switch to\s+(.+?)(?:\s+\(.+\))?$` | Weapon-switch | L241 |
| `^Reload\s+(.+?)(?:\s+\(.+\))?$` | Reload weapon | L243 |
| `^Unequip\s+(.+?)(?:\s+\(.+\))?$` | Unequip weapon | L245 |
| `^Defend\b` / `^Take Cover\b` / `^Reposition\b` | Defensive action tags | L248-L252 |
| `^(Cover Fire\|Inspire)\s+->\s+(.+?)(?:\s*\(.+\))?$` | Social-action debuff with target | L278 |
| `^(Attack\|Rapid Fire\|Charge\|Subdue\|Fire from Cover)(?:\s*\(([^)]+)\))?` | Attack flavor + optional weapon | L298 |
| `^Stress Check(?:\s+\(at max\))?$` | Stress check mid-play vs at-max | L397 |
| `^Stabilize\s+(.+)$` | Stabilize, capture patient | L432 |
| `^Coordinate\s*\(vs\s+([^)]+)\)` | Coordinate target | L447 |
| `^Heal\s+(.+?)\s+\((.+?)\)$` | Heal target + skill | L479 |
| `^Coordinated Effort\s+-\s+(.+)$` | Coord Effort, capture skill | L510 |
| `^Unjam\s+-\s+(.+?)(?:\s*\(\|$)` | Unjam, capture weapon | L524 |
| `^Repair\s+-\s+(.+?)(?:\s*\(\|$)` | Repair, capture weapon | L541 |
| `^Upkeep\s+-\s+(.+)$` | Upkeep | L560 |
| `^Grapple\s+(.+?)(?:\s+\(.+\))?$` | Grapple, capture target | L577 |
| `^(Perception Check\|Gut Instinct\|First Impression)` | Narrative-check kind | L591 |
| `^First Impression\s+\((.+?)\)\s*$` | FI target capture | L622 |
| `^😰\s+(.+?)\s+gains\s+a\s+Stress\s+from\s+being\s+(.+)$` | Stress label parse | L654 |
| `^🤝\s+(.+?)\s+tried to recruit\s+(.+?)\s+-\s+(.+)$` | Recruit failure | L673 |
| `^🤝\s+(.+?)\s+recruited\s+(.+?)\s+as\s+(?:a\|an)\s+(Cohort\|Conscript\|Convert\|Apprentice)\s+to\s+(.+)$` | Recruit success | L693 |
| `^(?:📈\s*)?(.+?)\s+-\s+(.+?)\s+Lv\s+(\d+)\s+->\s+Lv\s+(\d+)\s+-\s+(\d+)\s+CDP\.?$` | Evolution spend | L734 |
| `^🎯\s+(.+?)\s+attack(?:\s+->\s+(.+?))?\s+·\s+([^·]+?)\s+·\s+([^·]+?)\s+·\s+Ranged Combat` | Vehicle/mounted attack | L759 |
| `^Drive\s+-\s+(.+?)$` | Drive | L793 |

Plus more patterns further into the file. Total ~30 patterns.

---

## 2. The canonical shape

Add structured columns to `roll_log` so parsers don't need to exist. Writers stamp the structure; readers read it directly.

### Proposed columns

```sql
ALTER TABLE roll_log
  ADD COLUMN IF NOT EXISTS event_type text,         -- 'attack' | 'stabilize' | 'recruit' | ...
  ADD COLUMN IF NOT EXISTS event_subtype text,      -- 'wound' | 'sickness' for infection, 'mid' | 'at_max' for stress, etc.
  ADD COLUMN IF NOT EXISTS target_name text,        -- the row's primary target (patient, victim, NPC)
  ADD COLUMN IF NOT EXISTS skill_name text,         -- skill used (Medicine*, Manipulation, etc.)
  ADD COLUMN IF NOT EXISTS weapon_name text;        -- weapon involved (Ready, Switch, Repair, Unjam, Attack)
```

These 5 columns cover most of the regex-derived fields. Anything more specific (mounted attack's 4-field breakdown, evolution's level numbers) goes into `damage_json` per the DamagePayload spec.

### Why these 5 columns specifically

| Column | Patterns it replaces |
|---|---|
| `event_type` | Replaces the prefix-pattern matching at the start of every regex. Currently every regex starts with `^(Stabilize\|Stress Check\|Heal\|...)`. With this column the prefix matching disappears. |
| `event_subtype` | Replaces parenthetical disambiguators like `(Wound\|Sickness)`, `(at max)`, `(vs X)`. |
| `target_name` | Replaces `(.+)` captures for patient, target NPC, NPC name in recruit, etc. Already exists as a column in the type at types.ts but is underused at the write side. |
| `skill_name` | Replaces `(.+?)\s+\((.+?)\)` heal-pattern + coord-effort skill capture. |
| `weapon_name` | Replaces Ready/Switch/Reload/Unequip/Repair/Unjam/Attack weapon captures. |

The 25-30 regex patterns collapse to ~5 lookups on structured columns + simple `event_type` switch.

---

## 3. Migration plan

Phased so each step is shippable + verifiable. Hunt-and-peck owns execution.

### Phase C1: Add columns (no breaking)

1. New SQL migration `sql/roll-log-structured-columns-YYYY-MM-DD.sql`:
   ```sql
   ALTER TABLE public.roll_log
     ADD COLUMN IF NOT EXISTS event_type text,
     ADD COLUMN IF NOT EXISTS event_subtype text,
     ADD COLUMN IF NOT EXISTS target_name text,
     ADD COLUMN IF NOT EXISTS skill_name text,
     ADD COLUMN IF NOT EXISTS weapon_name text;
   ```
   All NULL by default. Per the migration discipline doc (R10): dated filename, idempotent, applied via `npx supabase db query --linked -f`.

2. Type updates in `app/stories/[id]/table/types.ts` + `components/RollsFeed.tsx`:
   - Add the 5 fields to the `RollEntry` interface as `string | null`.

**Gate:** tsc clean. No reader code uses the new columns yet. Live DB has the columns ready.

### Phase C2: Backfill from regex parsing (one-time)

Write a one-shot migration script that reads each `roll_log` row, runs the existing regex parsers, and populates the new columns where it can. Rows that don't match any regex stay NULL.

The script is "use the parsers we're about to deprecate, save their output to columns, so deletion of the parsers doesn't lose historical structure."

1. `scripts/backfill-rolllog-structured.mjs` (NEW):
   - Pulls `roll_log` rows in batches (1000 at a time, `id > last_id`).
   - For each row, runs the regex parsers in the same order compactRollSummary does.
   - On match: extracts the fields + UPDATEs the row with them.
   - On no-match: skips.
   - Logs progress + final stats (N rows processed, M matched, K skipped).
2. Run against live DB (read-only-then-write). Backfill completes in minutes for a small dataset.

**Gate:** post-backfill, run a SQL audit:
```sql
SELECT event_type, count(*)
FROM roll_log
WHERE event_type IS NOT NULL
GROUP BY event_type
ORDER BY count(*) DESC;
```
Sanity-check the distribution against the OUTCOME union's event tags. If anything is way off (e.g., `event_type='stabilize'` returns 0 rows but you know there are stabilize rolls), investigate the backfill regex before proceeding.

### Phase C3: Migrate writers to populate structured columns

Each insert site that writes to `roll_log` gets updated to stamp the new columns at write time. Order: smallest blast radius first.

Suggested sites (in order):

1. **Event-only writers** (12 sites: combat_start, drop, defer, sprint, death, incap, revive, etc.). Each writes `event_type = OUTCOME.X` and any relevant target/skill/weapon fields. Trivial.
2. **Stress / Stabilize / Distract / Gut Instinct / First Impression** (lib helpers). Each helper writes its structured fields.
3. **Recruit** (PC + proxy paths). 2 sites.
4. **Healing** (table page + cascade handler). 1 main site.
5. **Coord Effort** (lead + participant writes). 2 sites.
6. **Vehicle checks (Drive / Brew / Navigate)**. 1 site.
7. **Evolution / CDP spend**. 1 site.
8. **Weapon ops (Ready / Switch / Reload / Unequip / Repair / Unjam)**. 6 sites.
9. **Attack (executeRoll branch)**. **LAST.** Same gate as DamagePayload D3h (sequence after Phase 3.4 of the decomposition plan).

Each writer migration is one commit. After each, `compactRollSummary` falls through the regex parser on the OLD column path (label) AND the new structured-column path is populated alongside. Backward-compatible.

**Gate per migration:** tsc clean, manual smoke of the affected feature.

### Phase C4: Migrate reader (compactRollSummary) to use structured columns

Big rewrite of `lib/roll-helpers.ts:compactRollSummary`. Replace the 30+ regex branches with a switch on `event_type`:

```ts
export function compactRollSummary(r: RollEntry): string | null {
  switch (r.event_type) {
    case 'attack': return summarizeAttack(r)
    case 'stabilize': return summarizeStabilize(r)
    case 'recruit': return summarizeRecruit(r)
    case 'heal': return summarizeHeal(r)
    case 'stress_check': return summarizeStressCheck(r)
    // ... etc
    default:
      // Pre-backfill rows OR new untyped events. Fall through to the
      // legacy regex parser, kept for transition. Will be removed in C5.
      return legacyCompactRollSummary(r)
  }
}
```

Each `summarize*` function reads `r.target_name`, `r.skill_name`, `r.weapon_name`, etc. directly. No regex. No label parsing.

The 121 existing tests for compactRollSummary must continue to pass. Mostly because the legacy fallback path still exists at this phase; pre-backfill rows in the test fixtures hit the legacy path.

**Gate:** all tests green. Snapshot the preview HTML rendering before + after; zero string diffs.

### Phase C5: Drop the legacy regex parser

1. Verify: `SELECT count(*) FROM roll_log WHERE event_type IS NULL` returns 0 (or close - some pre-backfill rows are acceptable if they're not from the active campaign).
2. Delete `legacyCompactRollSummary` from `lib/roll-helpers.ts`.
3. Delete the 30+ regex constants.
4. Make `event_type` NOT NULL via a final ALTER TABLE (only after the backfill + writer migrations are 100% verified).

**Gate:** all tests green, full session playtest, preview HTML unchanged.

---

## 4. Tests required at each phase

| Phase | Test type | Coverage target |
|---|---|---|
| C1 | Type-only | Updated `RollEntry` interface compiles; new fields are nullable string |
| C2 | Manual + SQL | Backfill SQL audit returns sensible distribution per event_type |
| C3 (per writer) | Unit + smoke | Existing tests still green; new test asserting the writer stamps `event_type` + relevant fields |
| C4 | Unit + snapshot | `compactRollSummary` outputs match pre-refactor strings exactly via snapshot |
| C5 | Unit + playtest | Legacy parser deleted; all 121 tests still green; one full session playtest renders feed correctly |

---

## 5. Estimated session count

- Phase C1: 0.5 session (SQL migration + type update).
- Phase C2: 1 session (backfill script + run + audit).
- Phase C3: 4-5 sessions (one per writer cluster; AttackDamage LAST gated on Phase 3.4).
- Phase C4: 2 sessions (the big switch + per-event `summarize*` sub-functions).
- Phase C5: 0.5 session (delete legacy + NOT NULL constraint + final playtest).

**Total: 8-9 hunt-and-peck sessions.**

Sequencing constraint: C3-attack (the last writer migration) gates on Phase 3.4 of the decomposition plan, same gate as DamagePayload D3h. **Recommend running C3-attack + DamagePayload D3h + executeRoll extraction in the SAME session - all three touch the same code at the same time.**

---

## 6. Risk register

### CR-R1: Backfill mis-classifies historical rows

If a regex in the backfill script is subtly different from the production regex (e.g., a fix landed in production but not the backfill copy), the backfill populates wrong values. Reader migrations then read those wrong values, breaking the feed for historical rows.

**Mitigation:** backfill script imports `compactRollSummary` directly (or its sub-parsers) rather than re-implementing the regex. Single source of truth. Test the backfill on a small sample (10 rows) + manually verify before running on the full table.

### CR-R2: Writer migration drift during long C3 phase

Phase C3 spans 4-5 sessions and 12+ writers. If new writers are added during C3 that don't stamp `event_type`, the reader's switch falls through to the legacy parser - but the legacy parser hasn't been kept in sync with new writer changes either.

**Mitigation:** add a TypeScript-level guard: a `writeRollLog()` helper that REQUIRES `event_type` as a typed argument. All new writers go through this helper. Existing writers migrate to it during C3.

Additionally, the `event_type` column can be made NOT NULL with a default value (e.g., `'unknown'`) before C5 to surface missing writes.

### CR-R3: `compactRollSummary` test suite false-passes

The 121 tests rely on inline label strings as inputs. If the refactor changes the function signature (e.g., requires `event_type` as input), the test inputs need to be migrated too. A bug-introducing migration that ALSO migrates the tests in the same wrong direction = green tests, broken production.

**Mitigation:** snapshot test the EXACT output strings before any refactor. Run the refactor. Re-run snapshots. Manual diff every change. The snapshot files become a reviewable artifact.

### CR-R4: Bespoke event labels that don't fit the 5-column shape

Some labels carry information that doesn't fit `event_type / event_subtype / target_name / skill_name / weapon_name`. Examples: brewing materials gathered (`gather_materials` event has fuel count + supplies count); vehicle attack has 4 distinct columns of context.

**Mitigation:** anything that doesn't fit the 5 columns goes into `damage_json` per the DamagePayload spec. The two specs work together: structured columns for hot-path lookup; `damage_json` for variant-specific extras.

### CR-R5: Production rows from BEFORE the migration that the backfill can't classify

Old roll_log rows from months ago may have labels that no current regex matches (because the label format changed). These rows would stay `event_type IS NULL` after backfill.

**Mitigation:** acceptable. The reader's default branch falls through to legacy `compactRollSummary` for NULL-event-type rows. These old rows render the same as they do today. Phase C5's NOT NULL is added LATER, and only if/when these stale rows are cleaned out (or accepted as `event_type = 'unknown'`).

---

## 7. What this spec is NOT proposing

- **Removing the `label` column.** The label remains the human-readable representation. Structured columns supplement, not replace.
- **A new event types table.** `event_type` is just a text column with a sentinel set. Could become an enum later if we want DB-level integrity (paired with the outcome-column kind spec).
- **A general-purpose "rich event" payload.** That's `damage_json`. Structured columns are the SUBSET of payload fields most-frequently read.

---

## 8. Maintenance

Update this spec when:
- A new event type is added during C3 - add the writer to section 3's list.
- Backfill surfaces unexpected old labels - log them as CR-R5 fallout.
- C4's snapshot test reveals a missed branch - patch it + document the catch.

When all 5 phases ship + the legacy parser is gone + Tech Debt Ledger A1.4 closes, archive to `tasks/spec-compactrollsummary-regex-deprecation-archived.md` with a postmortem.
