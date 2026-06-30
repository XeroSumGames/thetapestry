# Workflow - using the staging environment

Staging exists to test risky changes against a prod-mirror DB WITHOUT touching live
playtester data. It is opt-in insurance, not a mandatory gate.

## The setup (one-time, done 2026-07-01)
- **Staging Supabase:** ref `vublqobsuzvzywlnebns` (free org, $0), schema at exact prod
  parity. Refresh from prod with `scripts/build-staging-schema.sh` (see
  `tasks/spec-staging-environment.md`).
- **Vercel:** `main` -> Production -> PROD DB. The **`staging` branch** (and any other
  non-main branch) -> Preview deploy -> STAGING DB, via Preview-scoped env vars.
- **Preview URL:** the `staging` branch's deployment URL in the Vercel dashboard
  (e.g. `thetapestry-git-staging-*.vercel.app`).

## When to route through staging (vs straight to main)
ROUTE THROUGH STAGING:
- schema / RLS / trigger / function / publication changes (anything in `sql/`)
- column revokes / grant changes (the PII-revoke class)
- realtime sub-filter changes, anything that could break the table loop at scale
- data migrations / backfills

STRAIGHT TO MAIN IS FINE:
- routine app-code fixes, copy, UI, narrative - the low-blast-radius majority

## How to use it
1. `git checkout staging && git rebase origin/main` (or branch off main), make the change.
2. `git push origin staging` -> Vercel builds the Preview against staging DB.
3. For DB changes: apply the SQL to STAGING first -
   `npx supabase link --project-ref vublqobsuzvzywlnebns --password ""`, apply via
   `db query --linked`, verify, then **re-link prod**
   (`npx supabase link --project-ref jbudzglgtxeoaufpejrv --password ""`). The link is
   repo-local (`supabase/.temp/project-ref`); `db query` auths via the Management API (no
   DB password). ALWAYS confirm the linked ref before a destructive op.
4. Load the Preview URL, exercise the change against staging (empty-ish DB, throwaway data).
5. When it holds: merge `staging` -> `main` (and apply the same SQL to prod, confirming intent).

## Guardrails
- A bad migration on staging costs nothing; the same on prod mid-playtest costs real data.
- Staging has NO edge functions (log-visit etc.) and starts with no auth users - create a
  throwaway account on the Preview URL to test. Its data is disposable; do NOT copy real
  user rows into it.
- Keep staging schema current: re-run `build-staging-schema.sh` after prod schema changes
  so staging does not drift.
- Free-tier staging pauses after ~1 week idle - un-pause in the Supabase dashboard when needed.
