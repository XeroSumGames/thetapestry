# L-3 KV-Backed Rate Limiter - Test Plan + Operator Setup (2026-05-20)

Closes L-3 from the 2026-05-19 stability audit. Replaces the per-instance in-memory bucket on `app/api/auth/verify-turnstile/route.ts` with an Upstash Redis sliding-window limiter (distributed across all Vercel instances). Xero pre-approved per `launch-plan-2026-06-15.md:246`.

**Effort:** ~45 min including audit + tests + doc (puffer-fish queue estimated ~1 session).

---

## Pre-flight (already verified)

- [x] `npx vitest run tests/lib/` - 473/473 pass.
- [x] `npx tsc --noEmit` - clean.
- [x] `node scripts/check-em-dashes.mjs` + font-sizes + role-literals - clean.
- [x] `@upstash/redis@^1.38.0` + `@upstash/ratelimit@^2.0.8` added. `@vercel/kv` NOT used (deprecated v3 per Vercel's npm warning).

---

## OPERATOR SETUP (Xero, one-time, before prod traffic uses this code)

### 1. Create the Upstash Redis database

a. Vercel dashboard -> Storage -> Create Database.
b. Pick Redis (Upstash). Region: match the Vercel project's deploy region. Tier: Free (10K commands/day; ~2 commands per signup attempt = covers ~5K signups/day).
c. Name it `tapestry-ratelimit`. Create.

### 2. Link to the Vercel project

a. In the Upstash database overview, click Connect Project.
b. Pick `thetapestry`. Environment: Production + Preview + Development.
c. Connect. Three env vars auto-inject:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `UPSTASH_REDIS_REST_READONLY_TOKEN` (unused, but Vercel injects)

### 3. Redeploy

Trigger a redeploy from Vercel dashboard (or push any commit). The auto-injected env vars only take effect on next deploy.

### 4. Verify

After redeploy:
- Hit `/signup`, submit Turnstile.
- Upstash dashboard for `tapestry-ratelimit` Commands tab shows 2 commands per signup attempt.

---

## Manual smoke - prod path (after operator setup)

1. Open `/signup`. Submit valid Turnstile. Expect `ok: true`.
2. Loop 31 POSTs in under 60 seconds via curl/devtools:
   ```sh
   for i in {1..31}; do
     curl -X POST https://thetapestry.distemperverse.com/api/auth/verify-turnstile \
       -H 'Content-Type: application/json' -d '{"token":"test"}' \
       -w '\nstatus: %{http_code}\n'
   done
   ```
3. First 30 return 403 (bogus token); 31st returns **429** with `Retry-After: <seconds>`.
4. Wait 60s, submit again. Expect 403 (sliding window rolled).

---

## Manual smoke - dev fallback (local, no Upstash env vars)

1. `npm run dev` locally without `UPSTASH_REDIS_REST_URL`.
2. Loop 31 POSTs to `http://localhost:3000/api/auth/verify-turnstile`.
3. Same per-instance behavior as pre-KV (first 30 OK + 31st = 429).
4. Restart dev server. Fresh 30-request budget (bucket reset on process restart).

---

## Manual smoke - prod misconfiguration

1. Vercel dashboard: temporarily UNSET `UPSTASH_REDIS_REST_URL`.
2. Redeploy.
3. Hit `/api/auth/verify-turnstile`.
4. Expect 503 + `{ ok: false, error: 'rate limiter not configured' }`. Loud failure.
5. Restore env var + redeploy. Verify normal.

---

## Manual smoke - Upstash transient error

Route catches Upstash errors + falls through. To verify the log fires:

1. Upstash dashboard: rotate `UPSTASH_REDIS_REST_TOKEN`.
2. Deploy WITHOUT updating the Vercel env var.
3. Hit the endpoint.
4. Request succeeds. Vercel function logs show `[verify-turnstile] upstash error - allowing request: ...`.
5. Update env var + redeploy.

---

## Cost monitoring

Free tier = 10K commands/day. Rate limiter uses 2 commands per signup attempt. 5K signups/day fits comfortably.

Set Upstash dashboard cost alert at $5/mo - any spike past that = abuse or code bug.

---

## Rollback

```sh
git -C /c/TheTapestry revert <l3-commit> --no-edit
git -C /c/TheTapestry push origin main
```

Revert reinstates the in-memory bucket. Vercel env vars can stay (harmless if unused).

---

## NOT in this commit

- Upstash database creation (operator step).
- Env var injection in Vercel (operator step).
- The `signup-invites` table for the invite-code gate (separate spec).
- Alerting / Sentry breadcrumbs on the upstash-error path (could add post-launch if signup-failure spikes happen).
