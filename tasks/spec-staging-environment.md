# Spec - Staging Environment (pre-large-scale-playtest)

**Goal:** a place to test risky changes - especially SQL/RLS/infra migrations - WITHOUT
touching the live playtester database. Today everything pushes straight to main = live;
the moment 50+ playtesters are on, one bad migration nukes real data. Staging removes that
risk. Owner to drive: `[PF]`. Dashboard/account/secret steps are `[Xero]` (the one class
of thing the AI can't do).

## Architecture (decided)

- **Vercel - ONE project, environment-scoped** (no second project needed):
  - `main` branch -> **Production** deploy -> PROD Supabase (unchanged, already live).
  - a `staging` branch -> **Preview** deploy (auto URL) -> STAGING Supabase.
  - Done purely with Vercel's per-environment env vars (Production vs Preview scope).
- **Supabase - a SECOND project** `thetapestry-staging` (free tier; ~$0):
  - schema replicated from `sql/_baseline/schema.sql` + `sql/_baseline/publication.sql`.
  - seeded with throwaway fixtures, never real user data.
- **Workflow:** risky/infra/SQL/RLS changes land on `staging` first, verify on the preview
  URL against the staging DB, THEN merge to main. Routine safe app changes can still go
  straight to main if a lane chooses - staging is opt-in insurance, not a mandatory gate.

Why not Supabase branching: that needs the Pro plan + per-branch compute (real money). A
second free project is $0 and gives full DB isolation, which is the whole point.

## Cost / accounts

- Supabase free tier allows 2 active projects per org. Prod is #1; staging is #2 = **$0**.
  (Free projects pause after ~1 week idle - fine for staging, un-pause on demand.)
- **Confirm before creating:** the org is not already at its free-project cap. If it is,
  that is a real-money decision for Xero, not an automatic step.
- Vercel: env-scoping + preview deploys are included in the current plan = $0.

## Env-var matrix (built from Vercel's PROD env - Xero confirms the full set)

`.env.local` only carries 3 public keys; the real set lives in Vercel + Supabase function
secrets. Every Production var needs a Preview counterpart pointing at staging:

| Var | Production (main) | Preview (staging) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | prod URL | staging URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon | staging anon |
| `SUPABASE_SERVICE_ROLE_KEY` (server/API) | prod | staging |
| Sentry DSN / auth token | prod project | staging (or shared with an `environment` tag) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + secret | prod | staging keys (or Turnstile test keys) |
| `RESEND_API_KEY` / `THRIVER_EMAIL` (edge fn) | prod | staging - or leave email OFF in staging |
| any other prod var | - | mirror or deliberately disable |

Xero exports the full Production var list from the Vercel dashboard; PF maps each to a
Preview value. Edge-function secrets (`log-visit`) are set per Supabase project separately.

## Execution plan (who does what)

**STEP 1 - [Xero] create the staging Supabase project.** (click-by-click below.) Hand PF
back: the project **ref** (the `xxxx` in `xxxx.supabase.co`) + the **anon key** + **URL**.
Handle the `service_role` key + DB password as secrets - do NOT paste them in chat; set them
straight into Vercel Preview env (Step 4) and Supabase function secrets.

**STEP 2 - [PF] replicate the schema** to staging from `sql/_baseline/schema.sql` +
`publication.sql` (via the Supabase CLI/Management API with the existing access token; no DB
password needed in chat). Verify table/policy/publication parity against prod with a
read-only diff.

**STEP 3 - [PF] seed throwaway fixtures** (a test GM + a test campaign + a couple PCs) so
staging is usable, never copying real user rows.

**STEP 4 - [Xero] set Vercel Preview env vars** to the staging values (the matrix above),
scoped to "Preview" only so Production is untouched. (click-by-click after Step 1.)

**STEP 5 - [PF] create the `staging` branch** + a one-page `tasks/workflow-staging.md` so
all three lanes know when to route through it. First Preview deploy validates end to end.

**STEP 6 - [PF/Xero] smoke the staging deploy:** load the preview URL, confirm it talks to
the STAGING DB (not prod), run one risky-change rehearsal (a dummy migration) to prove
isolation.

---

## STEP 1 click-by-click - create the staging Supabase project [Xero]

1. Open `https://supabase.com/dashboard` and select your org (the one that owns the live
   TheTapestry project).
2. Click **New project**.
3. Name: `thetapestry-staging`. Organization: same as prod.
4. **Database Password:** generate a strong one and SAVE it in your password manager (you
   will not be shown it again; PF does not need it pasted in chat).
5. **Region:** pick the SAME region as the prod project (parity - avoids latency surprises).
6. Plan: **Free**.
7. Click **Create new project**, wait ~2 minutes for provisioning.
8. Go to **Project Settings -> API**. Copy and paste back to PF in chat (these are safe to
   share - they are public/clientside):
   - **Project URL** (e.g. `https://abcdwxyz.supabase.co`)
   - **anon / public** key
9. From that same page note the **service_role** key and (from Settings -> Database) the
   connection string - keep these PRIVATE; they go into Vercel Preview env at Step 4, not
   into chat.

When PF has the ref + URL + anon key, PF replicates the schema (Step 2) and preps the rest.
