# Schema Drift Report - 2026-05-17

> Pre-launch audit follow-up to R9 + R10 (tasks/pre-launch-audit-2026-05-17.md). Method: query live `information_schema` + `pg_trigger` for every table / function / trigger in the `public` schema, grep `sql/` for matching `CREATE TABLE` / `CREATE FUNCTION` / `CREATE TRIGGER`, report mismatches.

**Method tool:** `node .claude/worktrees/determined-knuth-11efa4/drift_diff.mjs` against live DB at branch `d2ba6b6`.

---

## Headline

**15 of 68 production tables have NO canonical CREATE TABLE statement in `sql/`.** These include the most load-bearing tables in the entire application. A point-in-time restore or fresh-project recreate from `sql/` would not reproduce any of them - their schemas exist only in the live Postgres instance.

Functions: 0 orphans of 72 (all accounted for in `sql/`).
Triggers: 1 orphan of 56 (`on_character_changed`).

This is R10 (migration ordering chaos) made concrete. The audit estimated this was a discipline gap; in fact it's a data-loss-vector gap.

---

## Orphan tables (NEED canonical DDL)

Listed in rough order of how badly they need a canonical DDL committed:

### Tier 1 - load-bearing for every session
| Table | Why it matters |
|---|---|
| `profiles` | User identity. Has the role-normalize trigger (`trg_normalize_role`) referenced in canon, but no CREATE TABLE. |
| `campaigns` | Every game. FK target of countless other tables. |
| `characters` | Every PC. R12 cascade question is unanswerable without the DDL. |
| `character_states` | Every live-session PC state (WP/RP/stress/infection). |
| `campaign_members` | Who-is-in-which-campaign. RLS policy joins reference this. |

### Tier 2 - high-write per-session
| Table | Why it matters |
|---|---|
| `roll_log` | Every dice roll ever. Phase 1 just added indexes here. |
| `chat_messages` | Every message ever. Phase 1 just added indexes here. |
| `notifications` | Every notification. Phase 1 just added indexes here. |

### Tier 3 - feature-specific
| Table | Why it matters |
|---|---|
| `campaign_notes` | GM-only notes. |
| `map_pins` | Pins on the campaign map. |
| `session_attachments` | Per-session uploads. |
| `sessions` | Session history table. |
| `user_events` | Analytics / funnel. |
| `visitor_logs` | Anonymous-visitor tracker (log-visit edge function writes here). |
| `world_npcs` | World-library NPCs. |

---

## Orphan trigger

`on_character_changed` - fires somewhere on `characters` but the `CREATE TRIGGER` isn't in `sql/`. Probably wires `character_states` propagation or a notification side-effect. Unknown until we extract its definition.

---

## What this changes about Phase 2

The audit's R9 fixed `initiative_order`. Today's work landed the canonical DDL for that one. But R10 (migration discipline) needed to be elevated from "process change" to **"15 follow-up canonical-DDL migrations, one per orphan."**

Each of these follows the same pattern as today's `sql/000-initiative-order-canonical-2026-05-17.sql`:

1. Query live `information_schema.columns` + `pg_indexes` + `pg_policy` + FKs.
2. Reverse-engineer a `CREATE TABLE IF NOT EXISTS` + indexes + RLS policies (DROP+CREATE idempotent).
3. Commit as `sql/000-<table>-canonical-2026-05-17.sql`.
4. Apply via `npx supabase db query --linked -f ...` to verify idempotency (should be a no-op).

That's a discrete checklist. Estimated 15-30 min per table. Could batch the Tier 3 ones into single files. Roughly **3-5 sessions** to clear the orphan list completely.

---

## Recommended next actions (do NOT ship today)

- **Don't touch `characters` / `character_states` canonical DDL until after the playtest.** Those are read by every gameplay path. A wrong reverse-engineering could mask a real divergence and we'd ship a "canonical" file that doesn't match reality. Highest-care reverse, lowest-priority to land before playtest.
- **`profiles` canonical DDL is also high-care** because the `trg_normalize_role` trigger and the role-cascade on signup all attach there.
- **Tier 3 tables (`campaign_notes`, `map_pins`, etc.) are safer to reverse-engineer first** because they have less in-band traffic and surprises will surface as obvious test failures rather than silent data corruption.
- **`on_character_changed` trigger** - extract its definition (`pg_get_triggerdef` + `pg_get_functiondef`) and commit as a one-off SQL file. Probably a 10-minute fix once we look at it.

---

## Files generated during this audit

Throwaway dump files at `.claude/worktrees/determined-knuth-11efa4/`:
- `live_tables.txt` (68 lines)
- `live_funcs.txt` (72 lines)
- `live_triggers.txt` (56 lines)
- `drift_diff.mjs` (the diff script)

These can be re-run after each batch of canonical-DDL migrations to track progress (`orphan tables count -> 0`).
