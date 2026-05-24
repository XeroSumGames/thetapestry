# Stage A1 - Infra-as-code: scope + approach

**Status: Tier 1 PARTIALLY BUILT (puffer-fish, 2026-05-23). No DB or schema change made (capture + guardrail only).** Part of `tasks/architecture-path.md` Stage A. Goal: get the Supabase config that today lives ONLY in the live DB (+ the dashboard) into versioned artifacts, so the silent-config bug class dies (the publication gap that cost an hour, and that I triaged again this session, is the poster child).

**BUILT 2026-05-23:** publication baseline (`sql/_baseline/publication.sql`, 21 tables) + drift-detector (`scripts/check-publication-drift.mjs`, `npm run check:publication`) - tested green against live + negative-tested. The discipline rule is in `AGENTS.md` (## Database / infra-as-code). This is the bug-class killer half of Tier 1.

**SCHEMA BASELINE BUILT 2026-05-23 via the no-Docker route** (Docker is not installed here; `supabase db dump` needs a containerized pg_dump). Captured instead through the `supabase db query --linked` API using Postgres's own DDL generators - `scripts/capture-schema.mjs` -> `sql/_baseline/schema.sql` (5,460 lines): 69 tables (incl. all 15 orphans), 292 constraints, 121 indexes, 69 RLS-enables, 286 policies, 56 triggers, 72 functions. functions/triggers/constraints/indexes are EXACT (Postgres-generated); TABLES + POLICIES are reconstructed and spot-checked faithful (characters renders correct; INSERT policies emit WITH CHECK + no USING, SELECT the reverse). The script is RE-RUNNABLE to refresh the baseline. This is a versioned record + drift reference, NOT a deploy artifact (never db-reset prod from it). Tier 1 is now COMPLETE.

---

## The live inventory (verified 2026-05-23, `sql/diag-infra-as-code-inventory-2026-05-23.sql`)

| Thing | Count | In version control today? |
|---|---|---|
| public tables | 69 | 54 have a `CREATE TABLE` in `sql/`; **15 do NOT (orphans)** |
| tables with RLS enabled | 69 / 69 | the *enablement* is live-only; **no RLS gap** (0 disabled - good) |
| RLS policies | 286 | scattered across `sql/`; not authoritative, drift-prone |
| triggers on public tables | 62 | partial; e.g. `trg_normalize_role` is documented but not all are |
| functions / RPCs | 72 | partial (incl. SECURITY DEFINER RPCs like `update_vehicle_in_campaign`) |
| `supabase_realtime` publication | 21 tables | **NOT in version control until the 2026-05-24 fix file** - the exact gap |
| `supabase/migrations/` dir | **does not exist** | the project applies ad-hoc `sql/` files via `db query --linked`; there is no canonical schema and no migration ledger |

### The 15 orphan tables (no `CREATE TABLE` anywhere in `sql/`)
`campaign_members`, `campaign_notes`, **`campaigns`**, **`character_states`**, **`characters`**, `chat_messages`, `map_pins`, `notifications`, **`profiles`**, **`roll_log`**, `session_attachments`, `sessions`, `user_events`, `visitor_logs`, `world_npcs`.

**The striking part:** the orphans are the OLDEST, most central tables - `campaigns`, `characters`, `character_states`, `profiles`, `roll_log`. They predate the `sql/`-file habit, so they were created via early dashboard work and never captured. **This decides the approach:** you cannot reliably hand-reconstruct the core of the data model (15 tables + their columns/defaults/constraints + 286 policies + 62 triggers) from memory or grep. The capture must be machine-generated from the live DB.

---

## Approach decision: a generated schema baseline, not a hand-rolled capture

**Chosen: `supabase db dump` (schema-only, `--linked`) as the canonical baseline,** committed to the repo, plus a lightweight drift-detector for the highest-risk config. Reasoning:

- A full `pg_dump --schema-only` captures ALL of it in one authoritative file: every table (orphans included), every RLS policy, every trigger, every function, and the publication membership. It is the ground truth, machine-faithful, regenerable.
- A hand-rolled "capture just publication + RLS + triggers" misses the 15 orphan table definitions (the hardest part) and would itself drift. More work, less coverage.
- We are NOT going to `db reset` prod from this dump - it is for **versioning + drift detection + code review of future changes**, not for rebuilding the live DB. So the risk of an imperfect dump is low (it is a read-only snapshot, not a deployment artifact).

### Tiered implementation (pragmatic for a solo dev, no staging)

- **Tier 1 - baseline + the bleeding-stopper (do first, cheap, high value).**
  1. `supabase db dump --linked --schema public` (schema only) -> commit as `supabase/schema.sql` (or `sql/_baseline/schema.sql`). This is the authoritative snapshot; the 15 orphans now have a versioned definition.
  2. A small drift-detector script (sibling to `scripts/check-arch.mjs`) that queries the live `supabase_realtime` publication membership and diffs it against a committed `sql/_baseline/publication.sql` list, failing on drift. This is the specific config that bit us; it gets its own fast guardrail. Run on-demand / pre-ship (it needs `--linked`, so it is not a blind CI step yet - see Tier 3).
- **Tier 2 - discipline (the habit change).** Any future publication / RLS / trigger / schema change goes through a committed `sql/` file applied via `npx supabase db query --linked -f ...` (already the habit for most `sql/`; this just extends it to publication/RLS/trigger changes, which have been dashboard-only), AND the `schema.sql` baseline is refreshed in the same commit. Captured as a rule in `AGENTS.md` / `lessons.md` so it sticks.
- **Tier 3 - full CI drift-check (later, needs a secret).** Wire the drift-detector into CI with a read-only DB role connection string as a GitHub secret, so drift fails the build automatically. Deferred because it needs credential plumbing and CI DB access; Tier 1+2 already kill the bug class for the two-of-us workflow.

---

## Execution order (when greenlit to build)

1. **Confirm `supabase db dump --linked` works in this env** (read-only; produces the schema file). One command, de-risks the whole approach.
2. **Commit the schema baseline** (`supabase/schema.sql`). Decide location with Xero: `supabase/schema.sql` (CLI-conventional) vs `sql/_baseline/`.
3. **Capture the publication membership** to `sql/_baseline/publication.sql` (the 21 tables) + write the drift-detector script + wire to `npm run` and the pre-ship gate (NOT the blind pre-commit, since it needs `--linked`).
4. **Tier 2 discipline note** into `AGENTS.md` + `lessons.md`.
5. (Later) Tier 3 CI wiring.

---

## Risks + bright lines

- **`supabase db dump` is READ-ONLY** (reads the schema; writes a local file). Safe to run without a confirm. The schema file is schema-only - no row data, no PII, no secrets - so committing it is safe.
- **Applying anything back to the live DB is a separate, Xero-gated step** (bright line: live-DB migration = confirm intent). Stage A1 as scoped does NOT apply anything; it CAPTURES. The only writes in all of Stage A are if/when we choose to re-apply (we are not - the live DB already has this state).
- **The drift-detector needs `--linked`**, so it cannot be a blind pre-commit/CI gate yet; it is an on-demand / pre-ship check until Tier 3. Be honest that until then, drift detection depends on someone running it.
- **Scale note:** none. This is capture + a guardrail; it adds no runtime cost. It REDUCES risk (the publication gap class).

## What would change my mind
- If `supabase db dump --linked` is unavailable or produces an unusable file in this env, fall back to a targeted hand-rolled capture (publication + RLS via `pg_policies` + triggers via `pg_dump -t` per orphan table) - more work, documented as plan B.
- If Xero wants true CI drift-detection sooner, jump Tier 3 ahead of Tier 2 (needs the DB secret first).
