# Incident Response Runbook

Closes Phase P3 / A4.4 of `tasks/puffer-fish-platform-plan.md`. The runbook to open when something is on fire in production.

**Audience:** Xero (the only operator). Future Claude chats helping triage.

**Status:** ACTIVE 2026-05-20. Updated when an incident happens and the playbook gaps.

---

## 1. When to open this runbook

Any of these:

- A player or Xero says "the site is down" / "I can't log in" / "rolls aren't appearing."
- A Sentry alert fires for a NEW issue class (per the R4 wiring once live).
- A health check at `/api/health` returns non-200 for >2 minutes.
- A Supabase dashboard alert (rate-limit hit, connection saturation, RLS error spike).
- A Vercel deploy completes with a build error AND prod traffic is hitting the broken build.
- A user reports "my character disappeared" / "my campaign is gone" / "someone else's data is on my screen."
- A secret (Stripe key, Supabase service-role key, Turnstile secret, Sentry DSN) is suspected leaked.

If none of those apply, this is not an incident. Use the normal triage playbook in `tasks/debug-handoff.md` Sec 4.

---

## 2. Pre-incident state (know this before you need it)

| Surface | Where | Why |
|---|---|---|
| Live URL | `thetapestry.distemperverse.com` | Direct check |
| Health endpoint | `thetapestry.distemperverse.com/api/health` | Returns `{status, checks: {db}, ms, ts}`. 200 = DB reachable. 503 = problem. |
| Sentry dashboard | `xero-sum-games.sentry.io` -> `thetapestry` project | Issue stream, alerts, trace breadcrumbs |
| Vercel dashboard | Vercel project for `thetapestry` | Deploy history, env vars, logs |
| Supabase dashboard | Project `jbudzglgtxeoaufpejrv` | DB query editor, logs, RLS, backups |
| GitHub repo | `XeroSumGames/thetapestry` | Commit history, `git revert` source |
| Uptime monitor | Better Stack (`betterstack.com`) -> "Tapestry prod /api/health" monitor | External 30s HTTP check of `/api/health`; posts incidents to `#all-xero-sum-games` Slack + email. This is the pager. |

Daily monitoring: external uptime monitor LIVE 2026-05-29 - Better Stack hits `/api/health` every 30s and posts incidents to the `#all-xero-sum-games` Slack channel (Slack mobile-app push = the free pager, since Better Stack's native push/SMS/call are paid) plus email. Verified end-to-end (test incident landed in Slack + phone push). Setup playbook: `tasks/ops-uptime-monitor-setup-2026-05-29.md`. STILL PENDING: the Sentry alert-rule click-through (Sentry catches app ERRORS; the uptime monitor catches OUTAGES - both needed). See `tasks/todo.md` observability B.

---

## 3. Severity classification

Assess severity in the first 60 seconds. Drives the rest of the response.

### P0 - Outage (whole platform down or data-loss in progress)
- Site returns 5xx for all routes.
- DB unreachable; `/api/health` returns 503.
- Active data corruption being written.
- Confirmed secret leak (key visible in public repo, screenshot, etc.).

**Response time target:** mitigation < 15 min. Communication < 30 min.

### P1 - Degraded (platform up, key feature broken)
- One major feature is broken (combat, character sheet, signup, etc.).
- One client is desynced from others (realtime broken).
- A subset of users can't log in (auth partial outage).
- High error rate (>10/min on a single error class).

**Response time target:** mitigation < 2 hours. Communication < 4 hours if scope is broad.

### P2 - Bug (something is wrong, no immediate damage)
- Visual bug, wrong color, broken layout.
- Slow performance on one surface.
- An edge case mis-renders.
- A handler logs a warning but doesn't crash.

**Response time target:** add to backlog. Triage in normal session cadence.

### P3 - Cosmetic / observability gap
- A Sentry breadcrumb is missing context.
- A log message is unclear.
- A doc is stale.

**Response time target:** drain when other work permits.

This runbook covers P0 + P1. P2 + P3 go through the normal triage playbook.

---

## 4. P0 playbook: site is down (Vercel-side)

Symptom: site returns 5xx, can't even reach `/api/health`, custom domain DNS resolves but no response.

1. **Confirm Vercel is the cause.**
   - Open Vercel dashboard -> the project -> Deployments. Is the most recent deploy `Error` or `Ready`?
   - If `Error`: a bad build is currently routing prod traffic. **Skip to step 3 (rollback).**
   - If `Ready`: check Vercel status page (vercel-status.com). Vercel-side outage is rare but possible.
   - If `Ready` and Vercel status is green: skip to playbook for Supabase / app-side issue.

2. **Pull the build error.**
   - Vercel -> the failing deployment -> Build Logs.
   - Quick scan for `error TS`, `Module not found`, env-var-related errors.
   - Snapshot the error for the post-incident review.

3. **Rollback to the last good deployment.**
   - Vercel dashboard -> Deployments -> find the most recent deploy with status `Ready`.
   - Click `...` -> `Promote to Production`. (Vercel calls this "Instant Rollback.")
   - Verify: site returns 200 within 30 seconds.

4. **Fix the build error.**
   - In a fresh git checkout: run `npx tsc --noEmit` + `npm test` locally. Reproduce the error.
   - Fix. Commit. Push. Wait for Vercel deploy.
   - Once green, the rollback can stay or you can let the latest replace it.

5. **Communicate.**
   - In-app banner is not implemented. Defer.
   - Email is the bright-line "broadcast to all users" - confirm with yourself before sending. For most P0s a personal message to the active playtester group via whatever channel you use is enough.

---

## 5. P0 playbook: DB unreachable (Supabase-side)

Symptom: `/api/health` returns 503, Vercel side is fine, Supabase dashboard shows the project as degraded.

1. **Confirm Supabase outage.**
   - Open Supabase dashboard -> project -> Reports. Check connection count + error rate.
   - Check status.supabase.com.

2. **If Supabase is having a regional incident:** wait. Don't deploy. Communicate.

3. **If Supabase is up but our project is unreachable:**
   - Check API logs in Supabase dashboard. Look for RLS errors, connection pool saturation, or query timeouts.
   - If connection-pool saturated: see if there's a runaway query in the logs. Kill it via `pg_terminate_backend(pid)` from the SQL editor.
   - If RLS errors spike: a recent migration may have broken a policy. Check git log for recent `sql/` changes; revert if needed.

4. **If a key was rotated and the new key isn't in Vercel:**
   - Vercel dashboard -> Settings -> Environment Variables.
   - Verify `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`) match the live Supabase project.
   - If wrong: update, redeploy.

5. **Communicate as in section 4.**

---

## 6. P0 playbook: secret leaked

Symptom: someone tells you a secret is visible in a screenshot / public repo / chat log. Or you see suspicious activity (Sentry has 100x normal volume, Supabase reports unexpected admin operations).

1. **Identify which secret.** Look at the leak source. Match against the env-var list (see Section 9).

2. **Rotate the secret immediately. Per-service procedure:**
   - **Supabase service-role key:** Supabase dashboard -> Settings -> API -> "Regenerate" service_role JWT. New key replaces old; old becomes invalid instantly.
   - **Supabase anon key:** same flow but for the `anon` key. Lower-stakes (it's a public key by design) but rotate anyway if it's been used to bypass RLS.
   - **Turnstile secret:** Cloudflare dashboard -> Turnstile -> Sites -> the Tapestry site -> regenerate `secret_key`.
   - **Sentry DSN:** Sentry dashboard -> Project Settings -> Client Keys (DSN) -> Reset / Add New. Old DSN remains valid until disabled; disable it after deploy.
   - **Vercel deploy token (if exposed):** Vercel dashboard -> Settings -> Tokens -> Revoke + create new.
   - **Stripe (when wired):** Stripe dashboard -> Developers -> API keys -> Roll. Old key invalid in seconds.

3. **Update Vercel env vars with the new value.**
   - Vercel dashboard -> Settings -> Environment Variables -> edit the relevant variable.
   - Trigger a redeploy (push an empty commit OR Vercel dashboard -> Redeploy).
   - Wait for deploy to complete. Test `/api/health` + a real signup if applicable.

4. **Audit damage.** Check Supabase logs for unexpected operations between the leak time and the rotation time. Note any data that may have been read or modified.

5. **Document the leak.** `tasks/incidents/<date>-<short-name>.md` (create the directory if missing). What leaked, how, blast radius, mitigation steps, rotation timestamp.

6. **Update `tasks/ops-secret-rotation.md`** (per P3/A4.5; not shipped yet but will be) with any procedure lessons.

7. **Communicate.** For service-role-key leaks at scale, this may meet the GDPR breach-notification threshold. Lawyer call (when you have one engaged per the launch-plan). For alpha-tier scale today, communicating to playtesters that "we rotated a key out of caution" is sufficient.

---

## 7. P1 playbook: realtime desync (one client diverged)

Symptom: GM moves a token, player doesn't see it. GM advances initiative, player's screen stays on the old turn.

1. **Quick fix: reload the broken client.** Most realtime desyncs resolve on reload (re-subscribes the channel).

2. **If reload doesn't fix:** check the player's browser console for `[broadcast:*]` errors. Sentry breadcrumbs should show recent handler failures.

3. **If a handler is throwing repeatedly:** identify the handler. Likely candidates per the realtime audit:
   - `pc_mortal_wound` (L1487) - documented stale-closure bug, queued for fix.
   - `infection_check_request` / `lasting_damage_check_request` - fixed previously.
   - Any new handler added without a `wrapBroadcast` Sentry wrap.

4. **Workaround:** GM can `/api/health` check then "End Session" + restart. Players reload after the restart message.

5. **Real fix:** scheduled in normal triage. Add to `tasks/todo.md` with file:line if known.

---

## 8. P1 playbook: data corruption (one campaign or row affected)

Symptom: a GM reports "my campaign's NPCs are wrong" or "all my pins are gone" or "the wrong character is showing on this initiative."

1. **STOP writes to the affected campaign.** Tell the GM to pause the session.

2. **Diagnose: what's actually corrupted?**
   - Open Supabase SQL editor.
   - Query the affected rows directly: `SELECT * FROM <table> WHERE campaign_id = '<id>'`.
   - Compare to expected state from the GM's description.

3. **Recovery decision tree:**
   - **If a single row** is wrong: write a corrective UPDATE in the SQL editor + apply.
   - **If many rows** are wrong AND the GM has a campaign snapshot: use the in-app Restore from snapshot flow (per `tasks/ops-backup-playbook-2026-05-19.md` Scenario A/B). This wipes + reinserts content rows from the snapshot.
   - **If many rows are wrong AND no snapshot exists AND we're on Supabase Pro+PITR:** restore to a NEW project per backup-playbook Scenario C, surgically copy the affected rows back.
   - **If we're on free tier with no snapshot:** the data is lost. Communicate with the GM. Re-create from memory if possible.

4. **Log to the backup-playbook drill log.** Real incidents teach the playbook.

5. **Identify root cause.** What corrupted the data? A bad migration? A logic bug? Add a regression test if testable.

---

## 9. Environment variable inventory

Keep this current. Each variable, where it's set, why it's load-bearing.

| Variable | Where set | Used by | Severity if missing |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env | All client-side Supabase calls | P0 - app can't connect to DB |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env | All client-side Supabase auth | P0 - no logins work |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | Edge functions (delete-user, notify-thriver) | P1 - admin ops broken; client-side reads still work |
| `TURNSTILE_SECRET_KEY` | Vercel env | `/api/auth/verify-turnstile` | P1 - signup CAPTCHA broken |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel env | Signup form Turnstile widget | P1 - signup CAPTCHA broken |
| Sentry DSN | Vercel env | `instrumentation-client.ts` etc. | P3 - error reporting broken but site works |
| Sentry auth token | Vercel env (build-time only) | Sentry CLI for source-map upload | P3 - stack traces are minified |

Update this table when a new env var is added.

---

## 10. Communication templates

Pre-written for speed under pressure.

### To playtesters (P0/P1 active):

> Heads up - we're seeing [brief description] on Tapestry right now. Investigating. Will follow up when resolved or when I have an ETA.

### To playtesters (P0/P1 resolved):

> Resolved at [time]. Cause: [one-sentence diagnosis]. [If data-affecting: what we can/can't recover.] Sorry for the disruption.

### To affected user (data corruption):

> I'm looking at your campaign now. Don't make any changes for the next ~15 minutes while I investigate. Will report back with what I find.

### To self (secret rotation done):

> [time] Rotated [secret name]. Old key invalid. Vercel env updated. Deploy [number] live. Audit window: [start time] to [rotation time].

---

## 11. Post-incident review

After every P0 + P1, write `tasks/incidents/<date>-<short-name>.md` with:

1. **Timeline:** when it started, when it was noticed, when mitigation began, when it ended.
2. **Impact:** how many users / campaigns affected, what was the user-visible symptom.
3. **Root cause:** the actual reason, not the surface symptom.
4. **Recovery:** what worked, what didn't, what we tried first.
5. **Lessons:** add to `tasks/lessons.md` if a reusable pattern.
6. **Action items:** todos that fall out of the post-mortem. Add to `tasks/todo.md`.

Don't skip this. The platform-stability plan's improvement loop depends on real incidents teaching the runbooks.

---

## 12. What's NOT in this runbook

- **Storage corruption / leak.** Storage policies live in the Supabase dashboard; outside the code path. Covered by the security audit (P4/A5.2). For now: if a malicious upload shows up, delete it via the dashboard.
- **Realtime saturation at scale.** Theoretical scale modeling (P6/A3.3) hasn't been done. At alpha-tier scale, saturation is not a current risk.
- **Compromised Vercel account.** If Vercel itself is breached, that's a "rotate every credential the account has access to + audit deploys" exercise. Out of scope for the day-to-day playbook.
- **Legal / GDPR notification.** Lawyer-track when the launch-plan's TOS/Privacy review lands.

---

## 13. Maintenance

Update this runbook when:
- A real incident teaches a step that's missing or wrong.
- A new env var is added (Section 9 table).
- A new alert / monitor is wired (Section 2 + Section 3).
- A new bright-line incident type emerges (e.g., when payment / Stripe goes live).

Re-audit quarterly OR after every P0/P1 OR after every major external dependency change (Supabase tier, new third-party API).
