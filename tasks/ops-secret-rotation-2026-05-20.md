# Secret Rotation Playbook

Closes Phase P3 / A4.5 of `tasks/puffer-fish-platform-plan.md`. Per-service procedures for rotating credentials, secrets, and API keys.

Sibling to [tasks/ops-incident-response-2026-05-20.md](ops-incident-response-2026-05-20.md). The incident runbook says "rotate the secret" + names the per-service entrypoint; this doc spells out the FULL ROTATION procedure per secret + the verification + audit steps.

**Status:** ACTIVE 2026-05-20. Updated when a real rotation happens and the procedure gaps.

---

## 1. When to rotate

Three triggers, ordered by urgency:

1. **EMERGENCY: known or suspected leak.** A secret is visible in a screenshot, a public commit, a chat log, a stolen laptop, an ex-collaborator's machine. Rotate within minutes (per the incident response runbook Section 6).
2. **PROACTIVE: anomalous activity.** Unexplained spike in Sentry errors, unexpected admin operations in Supabase logs, signup volume that doesn't match traffic. Rotate within hours after a quick audit of the logs.
3. **SCHEDULED: hygiene.** No specific cause, but the key is old or a developer who once had access is no longer involved. Rotate on a defined cadence (recommended: every 12 months for ALL secrets; sooner for service-role keys).

If you're rotating because of #1, you're already in an incident. Follow that runbook + return here for the per-service steps.

---

## 2. Pre-rotation checklist (run before any rotation)

1. **Identify what depends on the secret.** Section 9 of the incident-response runbook has the env-var inventory; cross-reference there.
2. **Confirm you can update the consumer.** For Vercel-deployed secrets: do you have Vercel admin access right now? If not, get it before rotating. Don't rotate then realize you can't deploy the new value.
3. **Pick a window.** Service-role key rotation breaks all in-flight admin operations until the new key deploys. Schedule when in-session players are minimal.
4. **Snapshot the OLD value somewhere secure.** A password manager entry with the timestamp. Some rotations have a "you can revert if the deploy fails" window; without the old value you can't roll back.
5. **Open the incident log entry now** (per the incident response runbook Section 11). Even for scheduled rotations - the log captures what was rotated, when, and the new key's first 4 chars (for verification, never the full key).

---

## 3. Per-service rotation procedures

### 3.1 Supabase service-role key (HIGH stakes)

The service-role key is admin-level. Leaked = a bad actor can bypass RLS, read every user's data, modify anything. **Highest-priority rotation.**

**Procedure:**

1. Open Supabase dashboard -> project `jbudzglgtxeoaufpejrv` -> Settings -> API.
2. Find the `service_role` key entry. Click `Regenerate`. Confirm.
3. Copy the new key value IMMEDIATELY (it's shown once; clicking away re-hides it). Paste into your password manager entry.
4. Open Vercel dashboard -> the project -> Settings -> Environment Variables.
5. Edit `SUPABASE_SERVICE_ROLE_KEY`. Paste new value. Save.
6. Trigger a redeploy (push an empty commit `git commit --allow-empty -m "chore(deploy): rotate service-role key"` OR Vercel dashboard -> Redeployments -> Redeploy).
7. Wait for deploy to complete (~2-3 minutes).
8. **Verify (critical):** test an edge-function-dependent operation. The simplest: trigger a `delete-user` flow on a test account. If the new key is wrong, the edge function errors and the user isn't deleted.
9. **The old key becomes invalid the moment you regenerated it.** Any edge function call that was in-flight at rotation time fails. Acceptable cost; these are admin ops, not user-facing.
10. **Document:** incident log entry updated. First 4 chars of new key. Rotation timestamp.

**Recovery if rotation breaks the site:** the new key is in Vercel; if Vercel didn't pick it up, redeploy manually. Don't try to "revert to the old key" - it's already invalid.

### 3.2 Supabase anon key (LOWER stakes)

The anon key is intentionally public (it's served in `NEXT_PUBLIC_*` env). Rotation is hygiene, not emergency. RLS does the actual access control.

**Procedure:**

1. Supabase dashboard -> Settings -> API -> regenerate `anon` key.
2. Same Vercel + redeploy flow as 3.1.
3. **Verify:** open the site, log in (uses the new key). If login works, rotation succeeded.

### 3.3 Turnstile secret key (MEDIUM stakes)

Used by `/api/auth/verify-turnstile` to validate signup CAPTCHA. Leaked = a bad actor can spoof captcha-passed signups (but each signup still hits other validations).

**Procedure:**

1. Cloudflare dashboard -> Turnstile -> Sites -> the Tapestry site.
2. Click `Settings` or `Edit`. Find the secret key. Regenerate.
3. Copy the new secret to your password manager.
4. Update Vercel env: `TURNSTILE_SECRET_KEY` to the new value. Save. Redeploy.
5. **Verify:** sign up a fresh test account. CAPTCHA-pass -> account creates. CAPTCHA-fail = old key is invalid (good signal).

**Site key (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) is paired** but is intentionally public. If you regenerate the site key (Cloudflare may rotate both together), update Vercel for both.

### 3.4 Sentry DSN (LOW stakes)

The DSN identifies the project to Sentry. Leaked = a bad actor can spam your Sentry project with garbage events (rate-limit eats your quota).

**Procedure:**

1. Sentry dashboard -> the `thetapestry` project -> Settings -> Client Keys (DSN).
2. The existing DSN can't be "rotated" in place. Workflow: add a NEW DSN, deploy it, then disable the OLD DSN.
3. Click `Generate New Key`. Copy the new DSN value.
4. Update Vercel env: the Sentry DSN var (check exact name in the project config; may be `NEXT_PUBLIC_SENTRY_DSN` or used at build time).
5. Redeploy.
6. **Verify:** trigger a test error (Sentry dashboard has a "Send Test Event" button OR you can throw in dev). New event arrives in Sentry under the new DSN.
7. Once verified, disable the OLD DSN in the Sentry dashboard. Old key is now invalid.

### 3.5 Vercel deploy token (MEDIUM stakes)

If a Vercel deploy token leaks, an attacker can trigger deploys. Bad if they have a malicious commit ready; not catastrophic without a payload.

**Procedure:**

1. Vercel dashboard -> Settings -> Tokens.
2. Find the leaked token. Click `Revoke`. (No "regenerate" - tokens are one-shot; you create new + revoke old.)
3. Click `Create Token`. Name it descriptively (`thetapestry-ci-YYYY-MM-DD`). Choose scope (Read+Deploy, Full Account, etc.).
4. Copy the token. Paste into your password manager.
5. **Find every place the old token was used.** Likely: GitHub Actions secrets, CI scripts, deployment hooks. Update each.
6. **Verify:** trigger a deploy via the new token (push to main). Confirm success.

### 3.6 Stripe API keys (NOT WIRED YET; placeholder)

When Stripe goes live, this section gets the same treatment.

**Pre-Stripe-wiring note:** add a `STRIPE_SECRET_KEY` row to the env-var inventory in the incident response runbook Section 9 as a P0-severity entry. Stripe-secret-leak = financial exposure.

### 3.7 Lawyer / legal text (NOT a secret, but bright-line)

Privacy Policy + Terms of Service text changes. NOT a rotation; flagged here because it's bright-line per operating-mode.

**Procedure:** see lawyer recommendation route from the launch plan. Coordinated with lawyer; cannot be rotated unilaterally.

---

## 4. Post-rotation verification (every rotation)

After ANY rotation, run this checklist:

1. **Test the affected flow end-to-end.** Service-role -> edge function call. Anon -> login. Turnstile -> signup. Sentry -> test event.
2. **Check Sentry dashboard for new errors in the first 15 minutes.** A failed rotation often surfaces as an error spike.
3. **Verify Vercel deploy logs show success.** Build errors at deploy time can mask env-var issues.
4. **Check `/api/health` returns 200.** Catches the case where Supabase keys are rotated but Vercel didn't redeploy.
5. **Update the incident log entry** (per Section 2 step 5) with: completion timestamp, verification steps run, anything unexpected.

If any step fails, you have a P1 on your hands. Open the incident response runbook.

---

## 5. Scheduled rotation cadence

Suggested calendar (Xero adjusts as he likes):

| Secret | Cadence | Driver |
|---|---|---|
| Supabase service-role | Every 6 months | Highest stakes, but rotation is mid-disruption |
| Supabase anon | Every 12 months | Lower stakes; routine hygiene |
| Turnstile secret | Every 12 months | Hygiene |
| Sentry DSN | Every 24 months | Low stakes; rotate when refactoring or moving projects |
| Vercel deploy tokens | Every 6 months | Anyone with deploy access should rotate periodically |
| Stripe keys (when wired) | Every 12 months | Standard PCI-related hygiene |

These are NOT enforced today. Add a calendar reminder OR a quarterly check that walks this table.

---

## 6. Audit log (where + how)

Every rotation gets a log entry. Suggested location: `tasks/audits/rotation-log.md` (create if missing). Entry format:

```
## YYYY-MM-DD - <secret type> rotation

- Trigger: emergency / proactive / scheduled
- Old key first-4-chars: <xxxx>
- New key first-4-chars: <yyyy>
- Vercel deploy ID: <vercel-deploy-id>
- Verification steps completed: list
- Notes: anything unexpected
```

NEVER log the full key. First-4-chars is enough to confirm in a future audit that "yes, the key in Vercel matches the one we rotated to."

---

## 7. What's NOT in this playbook

- **Stripe rotation procedure** - documented when Stripe goes live.
- **OAuth client secret rotation** - no third-party OAuth wired today.
- **GitHub access token rotation** - if you use a personal access token for git push, rotate via GitHub Settings. Out of scope.
- **DB user password rotation** - Supabase manages this internally; not a manual surface.
- **Server-side TLS cert rotation** - Vercel manages automatic Let's Encrypt cert rotation. Don't touch.

---

## 8. Maintenance

Update this playbook when:
- A new secret is added to the platform - add a per-service section.
- A rotation surfaces a procedure gap - patch the section.
- A service changes its rotation UX (e.g., Supabase changes the dashboard flow) - update the steps.
- Scheduled rotation cadence changes - update Section 5.

Re-audit annually OR after every emergency rotation.
