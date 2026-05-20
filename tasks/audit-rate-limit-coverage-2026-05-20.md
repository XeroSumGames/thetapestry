# Audit: Rate-Limit Coverage

Closes Phase P4 / A5.5 of `tasks/puffer-fish-platform-plan.md`. Inventories every client-facing surface that accepts input, maps current rate-limit posture per surface, recommends per-surface action.

**Audience:** the hunt-and-peck chat (for any new limiter wiring) + Xero (for the Supabase-side limits that can only be set in the dashboard).

**Status:** AUDIT 2026-05-20. Recommendations only.

---

## 1. Scope

Two threat classes:

- **Scope A: Server-side routes.** Next.js API routes + edge functions. Anyone with a URL can hit these.
- **Scope B: Client-driven Supabase ops.** Authenticated users running `.from(...).insert/update/delete()` from the browser. Supabase RLS gates *what* they can mutate; rate-limiting gates *how fast*.

Both scopes matter for "platform stability + optimization" - Scope A is the obvious DDoS vector; Scope B is the rarely-discussed "logged-in abuser spams 10K inserts/sec" vector.

---

## 2. Scope A: server-side surfaces

The full inventory is small. 2 Next.js routes + 3 edge functions.

| Route | What it does | Auth required | Rate-limited? | Severity if abused |
|---|---|---|---|---|
| `app/api/auth/verify-turnstile/route.ts` | Verifies Turnstile CAPTCHA token during signup | No (gates signup) | **YES** - Upstash KV sliding window, 30/min/IP (L-3 shipped) | Was HIGH; now MEDIUM after L-3 |
| `app/api/health/route.ts` | DB-reachability check; returns `{status, checks, ms, ts}` | No | **No** - bare GET | LOW (read-only DB ping; minimal cost per hit) |
| `supabase/functions/delete-user/index.ts` | Hard-deletes a user + all their data | Yes (JWT) + Thriver-only OR self-delete | **No** | HIGH if abused; LOW likelihood because JWT-gated AND Thriver-gated |
| `supabase/functions/notify-thriver/index.ts` | Sends notification to Thrivers (moderation events) | Yes (service-role token) | **No** | MEDIUM - notification spam to Thrivers; mitigated by Y2 (caller-auth tightening) |
| `supabase/functions/log-visit/index.ts` | Logs a visitor event | No (lightweight tracking) | **No** | LOW - row-spam on `visitor_logs` table |

### Findings (Scope A)

**A-F1: `/api/health` has no rate limit.** Today: low cost; a flood costs Vercel function invocations + one Supabase round-trip per hit. Long-term: at paid-signup scale, a malicious uptime monitor could rack up Vercel function invocations. Recommendation: add a generous limit (e.g. 120/min/IP) when L-3's Upstash limiter is available. Same infrastructure; ~10 lines of code.

**A-F2: `delete-user` edge function has no rate limit.** Today: JWT + Thriver-only auth means abuse is gated by role. Risk: a compromised Thriver account could mass-delete. Mitigation: add a per-token limit (e.g. 10 deletions/min/user) when an edge-function rate-limit primitive is wired (`@upstash/ratelimit` works in Deno; doable). Lower priority than the data-leak surface from the RLS audit.

**A-F3: `notify-thriver` has no rate limit.** Today: only the database trigger (`call_notify_thriver()`) can call it because of the Y2 caller-auth tightening - the function rejects 403 unless the Authorization header is `Bearer <SUPABASE_SERVICE_ROLE_KEY>`. External callers can't trigger it. **Effectively rate-limited by the DB trigger pace.** No action needed.

**A-F4: `log-visit` has no rate limit.** Lowest-stakes: rows inserted into `visitor_logs`. A spammer can bloat the table but not exfiltrate data or affect users. Recommendation: add 60/min/IP when L-3 limiter is available. Or accept the risk + add a periodic `DELETE FROM visitor_logs WHERE created_at < now() - interval '90 days'` cleanup.

---

## 3. Scope B: client-driven Supabase mutations

Every authenticated user can call `.from('x').insert()` / `.update()` / `.delete()` directly from their browser via `supabase-js`. Per the codebase enumeration in the RLS gap sweep (audit A5.3), 64 distinct tables get accessed. Most are gated by RLS for *who* can mutate. **None are gated for *how fast*.**

### Risk model

A logged-in user can:
- Open browser DevTools, paste a `for` loop calling `supabase.from('roll_log').insert({...})` 10,000 times.
- Hit Supabase API limits (free tier: unspecified RPM; Pro tier: 10K requests/sec per project) before any app-layer alarm fires.
- Bloat tables they have INSERT RLS for.
- Hammer the realtime channel if their insert triggers a broadcast (channel storm to all subscribers in the campaign).

The threat model is: a logged-in playtester who decides to be annoying. Likelihood: very low. Severity: moderate (DB grows, realtime degrades, Supabase free tier could hit quota).

### Findings (Scope B)

**B-F1: No client-side rate limiting anywhere.** App code never throttles a user's own actions. Defense relies entirely on Supabase server-side limits.

**B-F2: Supabase's default per-project request limits are unknown.** Free-tier limits: documented at supabase.com/pricing as "unmetered API requests" but rate-limited via undocumented thresholds. Pro tier: 10K req/sec per project. **No app-layer awareness of these limits.**

**B-F3: Realtime broadcast amplification.** Some client-driven mutations fan out via realtime (e.g., a single `roll_log` insert broadcasts to every campaign member's tab). One spammer = N consumers per insert. At alpha scale (10 playtesters), this is bounded; at public scale, a single bad actor could ratchet realtime channel load up disproportionately.

### Recommended action (Scope B)

| Priority | Action | Effort |
|---|---|---|
| LOW (defer to paid-signup window) | Add client-side throttle to write-heavy hot paths: roll insertion, scene token move, chat messages. Use `lodash.throttle` or a custom debounce. | 1-2 sessions |
| LOW | Add SQL-side check constraints + per-user-per-minute rate triggers on the highest-risk tables (`roll_log`, `scene_tokens`, `chat_messages`). Server-side enforcement. | 1 session per table |
| LOW | Add Supabase-tier monitoring (currently absent). Alert when project request volume crosses N/min. Sentry can do this via custom metrics. | 1 session |

**Today's recommendation:** none required at alpha scale. Document the risk; revisit when paid-signups open OR when a single bad actor surfaces.

---

## 4. Summary table (per surface)

| Surface | Scope | Rate-limit today | Recommended | Priority |
|---|---|---|---|---|
| `/api/auth/verify-turnstile` | A | YES (Upstash KV, 30/min/IP) | Keep | Done |
| `/api/health` | A | None | 120/min/IP via Upstash | LOW |
| `delete-user` edge fn | A | None (auth-gated) | 10/min/user when feasible | MEDIUM |
| `notify-thriver` edge fn | A | None (service-role-gated) | Skip - DB trigger is the gate | Done |
| `log-visit` edge fn | A | None | 60/min/IP OR periodic table cleanup | LOW |
| `roll_log` writes (client) | B | None | Defer client throttle + SQL check | LOW |
| `scene_tokens` writes (client) | B | None | Defer | LOW |
| `chat_messages` writes (client) | B | None | Defer | LOW |
| Other 60+ tables (client) | B | None | Skip - not write-heavy | None |

---

## 5. Migration plan

### Phase RL1: harvest the L-3 Upstash limiter infrastructure (hunt-and-peck, ~1 session)

The L-3 ship by the other chat (2026-05-20) added `@upstash/ratelimit` + `@upstash/redis` deps. The `getRatelimit()` helper in `app/api/auth/verify-turnstile/route.ts` is the canonical instantiation pattern.

Extract a shared `lib/rate-limit.ts` exposing a reusable `makeRateLimit(prefix, limit, window)` helper. Wire `/api/health` + future routes through it.

**Gate:** verify-turnstile still works after the refactor; /api/health emits 429 after exceeding the limit.

### Phase RL2: `/api/health` limiter (~0.5 session)

Apply the shared helper at `/api/health/route.ts`. Generous limit (120/min/IP) since legitimate uptime monitors poll at 60/min max.

### Phase RL3: `log-visit` edge function (~0.5 session)

Edge functions run in Deno; `@upstash/ratelimit` works there too. Same pattern. 60/min/IP.

### Phase RL4: `delete-user` edge function (~0.5 session)

Per-user limit using `auth.uid()` as the key instead of IP. 10/min/user. Defense-in-depth against a compromised Thriver token.

### Phase RL5: defer Scope B (revisit when paid-signups open)

Don't ship client-side throttles or SQL check constraints yet. Document the risk + revisit when actual abuse surfaces or at the paid-signup window.

---

## 6. Risks

### RL-R1: Upstash quota exhaustion

The L-3 Upstash limiter has a daily-quota limit (10K commands on free tier). Each rate-limit check is 1-2 Redis commands. At alpha scale, well within the limit. At launch scale, monitor.

**Mitigation:** the verify-turnstile route already has a graceful fallback if Upstash errors (logs the error + allows the request). The new routes should follow the same pattern.

### RL-R2: limiter on `/api/health` breaks uptime monitors

A misconfigured uptime monitor polling at 200/min would hit the 120/min limit.

**Mitigation:** start with a high ceiling (120/min) + log all 429s. Adjust based on operational data.

### RL-R3: edge function Upstash dependency adds cold-start cost

Each invocation may need to instantiate the Redis client. Cold-start tax is ~50-100ms.

**Mitigation:** use the `Redis.fromEnv()` + module-level singleton pattern (same as verify-turnstile). The L-3 ship already does this.

### RL-R4: Scope B is deferred indefinitely

This audit explicitly defers Scope B. If a bad actor spams a write path tomorrow, the response is reactive (block the user manually). Risk accepted.

---

## 7. What this audit does NOT cover

- **Vercel-level rate limits** (DDoS protection, edge limits). Vercel applies its own throttling at the edge; documented per their plan tier. Out of scope.
- **Cloudflare-level rate limits.** Turnstile + DNS sit in front of Vercel; Cloudflare can apply Page Rules / Bot Management. Out of scope; revisit if abuse surfaces.
- **Supabase auth rate limits** (signup, login, password reset). Supabase applies these by default; documented at the dashboard. Out of scope.
- **Storage upload rate limits.** Storage has its own quota model. Covered by the bucket policy audit (A5.2) at the dashboard level.

---

## 8. Maintenance

Update this audit when:
- A new API route or edge function ships - add to Section 2.
- An abuse incident surfaces - document the lesson + tighten the relevant limit.
- Upstash tier changes - update Section 6.

Re-audit annually OR after any major route/edge-function addition OR after a documented abuse incident.
