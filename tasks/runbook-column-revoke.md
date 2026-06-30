# Runbook - hiding a column via revoke-table / regrant-columns (PII)

The safe, verified procedure for hiding ONE sensitive column (e.g. `profiles.email`,
`campaigns.invite_code`) behind a definer RPC. Born from the 2026-06-29/07-01 PII batch,
where a read-only verification declared the gate "closed" while creates were silently
broken. Follow this top to bottom; do not shortcut the verification.

Why a plain `REVOKE SELECT (col)` does not work: when table-level SELECT is granted,
a column-level revoke is a no-op. You must `REVOKE SELECT ON table` then
`GRANT SELECT (every-column-except-the-sensitive-one)`. On this Supabase PostgREST an
ungranted column is NOT omitted from a `*` request - it 401s `permission denied for
table`. So the revoke is only safe once NOTHING asks for `*` on that table.

---

## 1. Pre-revoke prep (app-lane - route to HP, do not revoke until done)

- **Grep for every `*` request, reads AND writes** (writes return the representation too):
  `\.(select|insert|update|upsert)\([^)]*\)\s*\.select\((\)|'\*')` across the table,
  plus embedded `<table>(*)` in other tables' selects. A bare `.insert(...).select()`
  or `.update(...).select()` asks for `return=representation` = the full `*`.
- Convert each to an explicit column list (a shared `COLUMNS` const), or for writes pick
  the minimal column the caller actually reads (usually `.select('id')`), or drop
  `.select()` entirely if only `error` is checked.
- Sweep again until the grep is EMPTY (single-line greps miss multi-line chains - use the
  `-Pzo` multi-line form).

## 2. Confirm the regrant list is complete (Puffer - live, read-only)

The regrant column list MUST equal all live columns minus the sensitive one, or a column
added since the SQL was written gets silently dropped:
```
select column_name from information_schema.columns
where table_schema='public' and table_name='<table>'
  and column_name not in (<regrant list>, '<sensitive col>');   -- must return []
```

## 3. Apply (Puffer - live, confirm intent first)

`REVOKE SELECT ON public.<table> FROM anon, authenticated;`
`GRANT SELECT (<all cols except sensitive>) ON public.<table> TO anon, authenticated;`
`NOTIFY pgrst, 'reload schema';`

## 4. Verify on the REAL path - reads AND creates (Puffer)

Raw SQL `SELECT *` always errors on a missing grant (false alarm); test what the app
actually does. Use anon REST where RLS allows it, and rolled-back authenticated
impersonation (`SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', ...)`)
otherwise. ALWAYS `BEGIN; ... ROLLBACK;` - never a bare mutating test.

- **READ smoke:** explicit-column read (the app's query) -> 200/rows; `select=<sensitive>`
  -> permission denied. Leak closed, reads intact.
- **CREATE smoke (the step that was missing):** create ONE row of each affected entity,
  because the write-then-return path returns `*` too. `INSERT INTO <table> (...) RETURNING
  id` must succeed; `RETURNING *` will (correctly) 401 - that is the exact failure a bare
  `.select()` would have shipped. For campaigns this is: create a story + save a GM-note.
  A read-only pass PASSES while creates are broken - so this step is mandatory.

If anything 401s, ROLL BACK immediately: `GRANT SELECT ON public.<table> TO anon,
authenticated; NOTIFY pgrst, 'reload schema';` (restores prior state, reopens the leak),
then fix the offending `*` site app-side and re-run from step 1.

## 5. Record

Dated `sql/` file (committed, mirrors live), update `active-lanes.md` + `todo.md`, and
only declare "closed" after BOTH the read and create smokes pass.

---

Background + the incident that earned each step: `tasks/lessons.md` (the two
"revoke table SELECT + regrant columns" entries) and
`tasks/finding-pii-revoke-readiness-2026-06-29.md` (POST-REVOKE GAP section).
