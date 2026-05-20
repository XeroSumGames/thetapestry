# Migration Ordering Discipline

Closes Pre-Launch Audit item **R10**. Codifies the SQL migration workflow as it actually exists today + sets the going-forward convention. Pairs with the soft-delete stance (Y11) + backup playbook (Y12) - this one tells you how to ship a schema change without surprising another chat or breaking a re-apply.

---

## TL;DR

- **Where we are:** 229 SQL files in `sql/`, applied ad-hoc via `npx supabase db query --linked -f sql/<file>.sql`. One file uses a `000-` numeric prefix (the canonical initiative_order DDL); 21 files have a dated suffix (`-YYYY-MM-DD.sql`); the rest are topic-named with no ordering signal. No `supabase/migrations/` directory; the canonical Supabase CLI migration flow is unused.
- **What's the risk:** Two chats can produce conflicting SQL files in the same session; a fresh re-apply from `sql/` has no canonical order; dependencies between files (e.g. `campaign-clock.sql` adds a column that a later `campaign-clock-vehicles.sql` references) are implicit, not enforced.
- **Going forward:** Date-suffix every new SQL file. Reserve numeric prefixes for files that MUST run before something else. Treat `sql/` as a flat applied-list with a "this is the order it landed" record (the dated suffix is the order). Do NOT renumber existing 228 topic-named files - too much blast radius.
- **Future state (not today):** migrate to `supabase/migrations/` proper when we're on Supabase Pro + have a staging project for testing migrations.

---

## Current convention (codified, not changing)

### File naming
- **Topic-named (default):** `campaign-clock.sql`, `community-stockpile.sql`, `roll-log-grappling-cleanup.sql`. The bulk of `sql/` looks like this. Topic = what the file does, not when.
- **Topic + dated suffix:** `advantages-2026-05-19.sql`, `hot-table-indexes-2026-05-17.sql`. Used for files that landed alongside a feature ship and need to convey "this applied on this date." Today: 21 files.
- **Numeric prefix:** `000-initiative-order-canonical-2026-05-17.sql`. One file uses this. Reserved for canonical CREATE TABLE statements that must run before any topic file that ALTERs the same table.

### How files get applied
Manually, one at a time, via `npx supabase db query --linked -f sql/<file>.sql`. Output goes to terminal; success/failure is visual. There is no `migrations_applied` table tracking what has been run.

### Why it works at the current scale
- Solo dev applying changes deliberately. No CI/CD pipeline running migrations.
- The DB is the source of truth - if a file already ran, re-running an idempotent file is a no-op (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). The convention is "always write idempotent SQL."
- New developers onboarding to the repo would need to know which files have been applied. We're not multi-developer yet so this hasn't broken.

### Why it doesn't scale
- A fresh DB cannot be brought up by replaying `sql/` blindly - some files depend on others, ordering is implicit.
- Two chats producing SQL in parallel can collide on the same topic file or on a column-add that the other already shipped.
- No "migration X applied to project Y at time Z" record. PITR can rewind through a migration but we can't audit "did this run on prod?"

---

## Going-forward convention (apply on every new SQL file from 2026-05-20 forward)

1. **Date-suffix every new file:** `<topic>-YYYY-MM-DD.sql`. Today's date wins; if you ship two files for the same topic on the same day, use `-YYYY-MM-DD-a.sql` / `-b.sql` to disambiguate ordering within the day.
2. **Numeric prefix only for canonical DDL.** Reserve `000-` through `099-` for canonical CREATE TABLE statements that MUST precede any ALTERs. The single `000-initiative-order-canonical-2026-05-17.sql` is the template; copy that shape (idempotent, reverse-engineered from live DB) when adding canonical DDL for the 15 orphan tables (R12 / Phase 2 follow-up).
3. **Idempotent or it doesn't ship.** Every new SQL file MUST be safe to re-run. Use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP TRIGGER IF EXISTS ... CREATE TRIGGER ...`, etc. If a file can't be made idempotent (e.g. a one-time data backfill), suffix it with `-backfill-YYYY-MM-DD.sql` so the convention flags "this is a one-shot."
4. **Document dependencies inline.** If your file requires another file to have run first, add a comment at the top: `-- Requires: campaign-clock.sql + campaign-vehicles.sql to have been applied.` This is the cheap version of a real dependency graph.
5. **The commit body documents the apply.** Commit message of any feature ship that includes SQL says "Applied to live via `npx supabase db query --linked -f sql/<file>.sql` at <commit time>" so the apply step is traceable in git log when PITR alone isn't enough.

---

## What we are NOT doing (yet)

- **`supabase/migrations/` adoption.** The canonical Supabase CLI flow uses this directory + a migrations table. Migrating to it requires:
  - One-time audit of `sql/` to produce an ordered applied-list (the R10 audit work).
  - Reverse-engineering 229 files into a single ordered baseline migration.
  - Either trusting "this was already applied" or risking re-runs.
  - A staging project to test migrations on before live (we don't have one).
  Defer until: we're on Supabase Pro + have a staging project + a second developer joining + paid users.

- **Renaming or renumbering the 228 existing topic-named files.** Blast radius too high - any chat with an in-flight feature would pick up rename-conflicts. The dated-suffix convention applies forward-only.

- **A `migrations_applied` table.** Would require auditing which of the 229 files have been applied. Defer to the `supabase/migrations/` adoption above; both happen together when they happen.

---

## When two chats produce conflicting SQL

Common today; documented in [tasks/lessons.md](lessons.md) "Verify shipped state before assuming uncontested scope":

1. `git fetch && git log --oneline origin/main -10` before starting feature SQL work. Grep for the touched table name in the recent log.
2. If a parallel chat shipped a colliding file already: rebase, see what they did, decide whether your design or theirs wins (most recent explicit Xero approval is canonical).
3. If your design wins: supersede their file with a commit message that references their SHA (`Supersedes <sha>` line).
4. If theirs wins: discard yours, add the missing pieces from your work as a follow-up file.

---

## Maintenance notes

Update this doc when:
- We adopt `supabase/migrations/` proper (delete the "What we are NOT doing" section).
- The dated-suffix convention turns out to fail in a specific way - revise the going-forward rules.
- A migration breaks live and the post-mortem identifies a procedural gap.

Last full audit: 2026-05-20. Re-audit when sql/ passes ~300 files OR when Supabase Pro adoption opens the door to migrations/.

---

## Open questions for Xero

1. **When to migrate to `supabase/migrations/`.** Recommended trigger: same time as the Supabase Pro upgrade for PITR (Y12). Doing both at once amortizes the staging-project provisioning cost.
2. **Should we add a one-line shell wrapper for the apply step?** Something like `scripts/apply-sql.sh sql/<file>.sql` that runs the supabase command + appends to a local applied-log file. Low priority; current `npx supabase db query --linked -f` works.
3. **The 15 orphan tables (R12, Phase 2 follow-up) need canonical DDL.** Use the `000-initiative-order-canonical-2026-05-17.sql` pattern; reserve `001-` through `015-` prefixes when shipping them. Or wait for the `supabase/migrations/` adoption to handle them together.
