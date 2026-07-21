# Security Audit Log

Weekly autonomous deep-scan (Tuesdays 16:23 UTC). Newest first. Silent runs (clean) are NOT logged here - absence = clean.

This is wider than the 3-hour health-pulse (tasks/health-pulse.md) - includes dev-dep audits, file-upload paths, secret-exposure scans, SQL/XSS pattern checks, dependency drift, RLS gap scan, API rate-limit surface.

When you see a new entry: triage via debug-handoff.md Sec. 4. Most findings will be advisory, not urgent.

---

## 2026-07-21 16:23 UTC — weekly audit

**Sections with findings:** npm audit (2 NEW HIGH + 3 carry-overs), rate-limit / DoS (carry-over), dependency drift

**Sections clean this cycle:** auth/role gates (guardrail: 353 files, 0 violations), RLS gaps (all mutated tables have matching RLS SQL files in `sql/_baseline/`), file uploads (avatar: 5MB cap + image-only + resize-to-JPEG; war-stories: 10MB cap via `prepareUpload` + filename sanitization + contentType check; tactical-maps + session-attachments: size + MIME validated per stability-audit M1 2026-05-30), secrets exposure (no committed .env files, no hardcoded tokens in source), injection/XSS (`dangerouslySetInnerHTML` in `app/layout.tsx:56` is a static inline script — not user input; `innerHTML` in `app/stories/[id]/table/page.tsx:7958` sets a hardcoded static string on image error — not user input), permission boundaries (moderate pages gate on `roleIsThriver(profile)` from `lib/auth/roles.ts`; `isGM` computed as `gm_user_id === user.id` is a UI-display pattern, not a server boundary — RLS is the actual security layer).

### npm audit (moderate+)

**NEW HIGH (both have non-breaking fixes available):**
- `brace-expansion` 1.1.13 — HIGH — CVSS 5.3 — "DoS via exponential-time expansion of consecutive non-expanding {} groups" — transitive (via eslint / typescript-eslint chain) — fix: non-breaking bump available (`fix=True`)
- `js-yaml` 4.2.0 — HIGH — CVSS 7.5 — "YAML merge-key chains can force quadratic CPU consumption" — transitive — fix: non-breaking bump available (`fix=True`)

**CARRY-OVER (unchanged):**
- `postcss` 8.4.31 — moderate — CVSS 6.1 — XSS via unescaped `</style>` in CSS stringify — transitive via `next` — fix: blocked on next major upgrade — low runtime risk (build-time only)
- `next` — moderate — isDirect: true — via postcss chain — fix: breaking major downgrade advisory (spurious; hold)
- `@sentry/nextjs` >=6.3.6 — moderate — isDirect: true — via next chain — fix: breaking downgrade advisory (spurious; hold)

### Rate-limit / DoS

- `app/api/health/route.ts` — GET, unauthenticated — DB ping cached 10s — **no HTTP-level rate limit — 9th consecutive audit carry-over** — Upstash sliding window (10 req/min per IP) needed before paid launch.

### Dependency drift

(`npm outdated` returned results with N/A current versions — sandbox build; versions from lockfile where available.)

- `@supabase/supabase-js` — 2.100.1 installed → ~2.110.8 latest — **9th consecutive audit carry-over** — auth-adjacent; changelog review before bump.
- `@supabase/ssr` — 0.9.0 installed → 0.12.0 latest — **9th consecutive audit carry-over** — auth-adjacent staleness rising.
- `@sentry/nextjs` — 10.x installed → 10.67.0 latest — bump clears advisory chain.
- `@upstash/ratelimit` — 2 major versions behind per `npm outdated` — rate-limit-adjacent; review before bump.

**Top 3 priorities:**
1. `brace-expansion` + `js-yaml` — both HIGH with non-breaking fixes available; run `npm audit fix --package-lock-only` and inspect the diff, then `npm install` to pull clean versions. DoS risk at scale.
2. `app/api/health/route.ts` — 9 audits deferred on HTTP rate limit; add Upstash 10/min sliding window before paid launch.
3. `@supabase/supabase-js` 2.100.1 → ~2.110.8 and `@supabase/ssr` 0.9.0 → 0.12.0 — both 9 audits deferred; auth-adjacent staleness is the main accumulating risk.

---

## 2026-07-14 16:23 UTC — weekly audit

**Sections with findings:** npm audit (carry-overs), rate-limit / DoS (1 closed, 1 carry-over), dependency drift

**Closed since last audit (2026-07-07):**
- `supabase/functions/log-visit` — body-size cap confirmed in place (`content-length` guard at line 33 + parse-size recheck). **CLOSED** after multiple audits as carry-over.

**Sections clean this cycle:** auth/role gates (guardrail: 352 files, 0 violations), RLS gaps (all accessed tables have RLS-enable SQL files), file uploads (all paths route through `prepareUpload` — size cap, content-type whitelist, filename sanitization, SVG excluded), secrets exposure (no committed .env files, no hardcoded tokens), injection/XSS (`dangerouslySetInnerHTML` in layout.tsx is a static inline script; `innerHTML` in table/page.tsx sets a hardcoded static string — neither user-controlled), permission boundaries (no novel raw-role-comparison shapes; `app/ape-log/page.tsx` uses `isThriverUser()` from `lib/data/feature-checklist.ts` — server-side DB lookup, more restrictive than the client helper, not a gap).

### npm audit (moderate+)

All three are unchanged carry-overs. No new advisories this cycle.

- `postcss` 8.4.31 — moderate — CVSS 6.1 — XSS via unescaped `</style>` in CSS stringify (GHSA-qx2v-qp2m-jg93) — transitive via `next@16.2.9` — **carry-over; low runtime risk** (build-time only; app does not process user CSS at runtime) — fix: blocked on next major upgrade
- `next` — moderate — isDirect: true — via postcss chain — fix: breaking major downgrade advisory (spurious; hold)
- `@sentry/nextjs` >=6.3.6 — moderate — isDirect: true — via next chain — fix: breaking downgrade advisory (spurious; hold)

### Rate-limit / DoS

- `app/api/health/route.ts` — GET, unauthenticated — DB ping cached 10s — **no HTTP-level rate limit — 8th consecutive audit carry-over** — Upstash sliding window (10 req/min per IP) needed before paid launch.

### Dependency drift

(Lockfile confirmed; `npm outdated` skipped — packages not installed in sandbox.)

- `@sentry/nextjs` — 10.58.0 installed → 10.65.0 latest (7 minor behind) — bump clears advisory chain.
- `@supabase/supabase-js` — 2.100.1 installed → ~2.110.5 latest (10 minor behind) — **8th consecutive audit carry-over** — auth-adjacent; changelog review before bump.
- `@supabase/ssr` — 0.9.0 installed → 0.12.0 latest — **8th consecutive audit carry-over** — auth-adjacent staleness rising.
- `next` — 16.2.9 installed → 16.2.10 latest (1 patch behind) — routine bump available.

**Top 3 priorities:**
1. `app/api/health/route.ts` — 8 audits deferred on HTTP rate limit; add Upstash 10/min sliding window before paid launch.
2. `@supabase/supabase-js` 2.100.1 → ~2.110.5 and `@supabase/ssr` 0.9.0 → 0.12.0 — both 8 audits deferred; auth-adjacent staleness is the main risk vector.
3. `@sentry/nextjs` 10.58.0 → 10.65.0 — bump to clear the moderate advisory chain (postcss/next); minor version, low risk.

---

## 2026-07-07 16:23 UTC — weekly audit

**Sections with findings:** npm audit (carry-overs), rate-limit / DoS (carry-over), dependency drift

**Progress since last audit (2026-06-30):**
- `next` bumped 16.2.6 → 16.2.9 (patch — addressed from last week's item 4).
- `@sentry/nextjs` bumped 10.51.0 → 10.58.0 (4 minor behind now, down from 11).

**Sections clean this cycle:** auth/role gates (guardrail: 347 files, 0 violations), RLS gaps (all accessed tables have RLS-enable SQL files), file uploads (all paths route through `prepareUpload` or canvas-resize pipeline — portrait-bank/npc-portraits upload canvas-processed blobs with hardcoded `image/jpeg`, not raw user files), secrets exposure (no committed .env files, no hardcoded tokens), injection/XSS (both `dangerouslySetInnerHTML` and `innerHTML` hits are static strings — not user-controlled), permission boundaries (all `isThriver` state variables populate via `roleIsThriver(profile)` from `lib/auth/roles.ts`).

### npm audit (moderate+)

All three are unchanged carry-overs. No new advisories this cycle.

- `postcss` 8.4.31 — moderate — CVSS 6.1 — XSS via unescaped `</style>` in CSS stringify — transitive via `next` — **carry-over; low runtime risk** (build-time only; app does not process user CSS at runtime)
- `next` 9.3.4-canary.0–16.3.0-canary.5 — moderate — isDirect: true — via postcss chain — fix: breaking major downgrade — hold
- `@sentry/nextjs` >=6.3.6 — moderate — isDirect: true — via next chain — fix: breaking downgrade to 6.3.5 — hold

### Rate-limit / DoS

- `app/api/health/route.ts` — GET, unauthenticated — DB ping cached 10s (mitigates DB amplification) — **still no HTTP-level rate limit** — a flood of requests still hits Next.js worker threads with no back-pressure — **7th consecutive audit, HTTP-level rate limit still missing** — add Upstash sliding window (10 req/min per IP) before paid launch.
- `supabase/functions/log-visit` — `--no-verify-jwt`, no rate limit, no body-size cap — carry-over (advisory: `content-length` guard, reject >2 KB).

### Dependency drift

(`npm outdated` returned empty — likely registry unreachable in sandbox; versions from lockfile + last known latest.)

- `@sentry/nextjs` — 10.58.0 installed → 10.62.0 latest (4 minor behind) — bump clears advisory residue.
- `@supabase/supabase-js` — 2.100.1 installed → ~2.110.0 latest (10 minor behind) — **7th consecutive audit carry-over** — auth-adjacent; changelog review before bump.
- `@supabase/ssr` — 0.9.0 installed → 0.12.0 latest — **7th consecutive audit carry-over** — review and bump.

**Top 3 priorities:**
1. `app/api/health/route.ts` — 7 audits deferred on HTTP rate limit; DB cache is in place, Upstash 10/min sliding window needed to close the HTTP flood surface before paid launch.
2. `@supabase/supabase-js` 2.100.1 → ~2.110 and `@supabase/ssr` 0.9.0 → 0.12.0 — both 7 audits deferred; auth-adjacent staleness is rising risk.
3. `supabase/functions/log-visit` — add `content-length` guard (reject >2 KB) on the no-auth edge function.

---

## 2026-06-30 16:23 UTC — weekly audit

**Sections with findings:** npm audit (carry-overs), rate-limit / DoS (partial fix landed, HTTP layer still open), dependency drift

**Closed since last audit (2026-06-23):**
- `app/api/health/route.ts` DB amplification — **PARTIALLY RESOLVED** — 10s in-memory success cache added (stability-audit 2026-06-29 M-1, confirmed in code). DB round-trips now collapse to ≤1 per 10s per warm instance. HTTP-level flood at Next.js layer still unthrottled (see below).

**Sections clean this cycle:** auth/role gates (guardrail: 343 files, 0 violations), RLS gaps (all accessed tables have RLS enabled), file uploads (all paths route through `prepareUpload` or canvas-resize with 10 MB guard), secrets exposure (no committed .env files, no hardcoded tokens found), injection/XSS (both `dangerouslySetInnerHTML` hits are static inline scripts — not user-controlled), permission boundaries (no novel raw-role-comparison shapes found outside canonical helpers).

### npm audit (moderate+)

All three are carry-overs. No new advisories this cycle.

- `postcss` <8.5.10 — moderate — CVSS 6.1 — XSS via unescaped `</style>` in CSS stringify — transitive via `next` — **carry-over; low runtime risk** (build-time only; app does not process user CSS at runtime)
- `next` 9.3.4-canary.0–16.3.0-canary.5 — moderate — isDirect: true — via postcss chain — fix: breaking major downgrade — hold
- `@sentry/nextjs` >=6.3.6 — moderate — isDirect: true — via next chain — fix: breaking downgrade to 6.3.5 — hold

### Rate-limit / DoS

- `app/api/health/route.ts` — GET, unauthenticated — **DB ping now cached 10s** (good, partially mitigates) — but **no HTTP-level rate limit**; a flood of requests still hits Next.js worker threads with no back-pressure — **6th consecutive audit, HTTP-level rate limit still missing** — add Upstash sliding window (10 req/min per IP) to complete the fix before paid launch.
- `supabase/functions/log-visit` — `--no-verify-jwt`, no rate limit, no body-size cap — carry-over (advisory: Supabase WAF rule or `content-length` guard, reject >2 KB).

### Dependency drift

- `@sentry/nextjs` — ^10.51.0 installed → 10.62.0 latest (11 minor behind now, up from 9 last audit) — bump clears advisory residue.
- `@supabase/supabase-js` — ^2.100.1 → 2.110.0 (10 minor behind, up from 8 last audit) — auth-adjacent; changelog review before bump.
- `@supabase/ssr` — ^0.9.0 → 0.12.0 — **6th consecutive audit carry-over** — review and bump.
- `next` — ^16.2.6 → 16.2.9 (patch) — routine bump available.

**Top 3 priorities:**
1. `app/api/health/route.ts` — 6 audits deferred on HTTP rate limit; DB cache is in place, add Upstash 10/min sliding window to close the remaining flood surface before paid launch.
2. `supabase/functions/log-visit` — add body-size cap (reject >2 KB via `content-length` header check) on the no-auth edge function.
3. `@supabase/ssr` ^0.9.0 → 0.12.0 — 6 audits deferred; auth-adjacent, rising staleness risk.

---

## 2026-06-23 16:23 UTC — weekly audit

**Sections with findings:** npm audit (carry-overs only), dependency drift, rate-limit / DoS (carry-over + new edge function gap)

**Closed since last audit (2026-06-16):**
- `ws` HIGH CVSS 7.5 (memory exhaustion DoS) — **GONE from npm audit** — resolved (non-breaking fix landed).
- `vite` HIGH (NTLMv2 leak + fs.deny bypass) — **GONE from npm audit** — resolved.
- `@opentelemetry` moderate chain (unbounded memory) — **GONE from npm audit** — resolved (likely via @sentry bump).

### npm audit (moderate+)

All three remaining advisories are **carry-overs** from prior audits. No new advisories this cycle.

- `postcss` <8.5.10 — moderate — CVSS 6.1 — XSS via unescaped `</style>` in CSS stringify — transitive via `next` — fix: breaking major next downgrade — **carry-over, low runtime risk** (build-time CSS processing only; app does not process user-supplied CSS at runtime)
- `next` 9.3.4-canary.0–16.3.0-canary.5 — moderate — isDirect: true — via postcss chain — fix: breaking — hold
- `@sentry/nextjs` >=6.3.6 — moderate — isDirect: true — via next chain — fix: breaking downgrade to 6.3.5 — hold

### Rate-limit / DoS

- `app/api/health/route.ts` — GET, unauthenticated, no rate limit — live DB `SELECT COUNT` on `profiles` on every call — **5th consecutive audit deferred** — at paid-user scale this is a trivial DB amplification vector; add Upstash rate limit (10 req/min per IP) or cache the result in-memory with a 30s TTL before launch.
- `supabase/functions/log-visit` — deployed `--no-verify-jwt` (intentional, Ghost visitors) — **no application-level rate limit or body-size cap** — fields are string-clipped via `clip()` but a flood of POST requests costs Supabase function invocations and `visitor_logs` writes — advisory; add Supabase native rate-limiting or upstream WAF rule.

### Dependency drift

- `@sentry/nextjs` — ^10.51.0 installed → 10.60.0 latest (9 minor versions behind) — bump likely clears any future @opentelemetry advisory re-emergence.
- `@supabase/supabase-js` — ^2.100.1 → 2.108.2 (8 minor versions) — auth-adjacent; changelog review before bump.
- `@supabase/ssr` — ^0.9.0 → 0.12.0 — carry-over 5th audit; changelog review due.
- `next` — ^16.2.6 → 16.2.9 (patch) — routine.

**Top 3 priorities:**
1. `app/api/health/route.ts` — 5 audits deferred; rate-limit it (Upstash sliding window, 10/min) before paid launch — DB amplification is cheap for an attacker.
2. `supabase/functions/log-visit` — add body-size cap (`req.headers.get('content-length')` guard, reject >2 KB) to block oversized-payload abuse against the no-auth endpoint.
3. `@sentry/nextjs` ^10.51.0 → 10.60.0 — minor version bump; low risk, clears advisory chain residue.

---

## 2026-06-16 16:23 UTC - weekly audit

**Sections with findings:** npm audit (new HIGH vulns), rate-limit / DoS (carry-over), dependency drift (carry-over)

**Closed since last audit (2026-06-09):**
- `app/gm-notes-popout/page.tsx:694` dangerouslySetInnerHTML XSS trap - **CONFIRMED FIXED** (static script only, no user HTML in inject path).
- `app/account/page.tsx:102` avatar upload missing pre-flight - **CONFIRMED FIXED** (routes through `prepareUpload('account-avatars', ...)` at line 114; 5 MB cap + image-only + SVG blocked).

### npm audit (moderate+)

**NEW HIGH:**
- `ws` 8.0.0-8.20.1 - HIGH - CVSS 7.5 - "Memory exhaustion DoS from tiny fragments and data chunks" - transitive - fixAvailable: true (non-breaking bump to >=8.21.0) - **action: `npm audit fix` scoped to ws**
- `vite` 8.0.0-8.0.15 - HIGH - two advisories: (1) NTLMv2 hash disclosure via UNC path on Windows (GHSA-v6wh-96g9-6wx3), (2) `server.fs.deny` bypass via alternate paths (GHSA-fx2h-pf6j-xcff) - transitive - fixAvailable: true

**NEW MODERATE:**
- `@opentelemetry/core` <2.8.0 - moderate - CVSS 5.3 - "Unbounded memory allocation in W3C Baggage propagation" - transitive via `@sentry/nextjs` - fix: requires `@sentry/nextjs` major version change (breaking)
- `@sentry/node` 8.0.0-alpha.1 - 10.53.1 - moderate - via @opentelemetry chain - transitive - fix: breaking
- `@opentelemetry/instrumentation-http` <=0.218.0 - moderate - via @opentelemetry/core - transitive - fix: breaking
- `@opentelemetry/resources` 0.8.0-2.7.1 - moderate - via @opentelemetry/core - transitive - fixAvailable: true (non-sentry path)
- `@opentelemetry/sdk-trace-base` <=2.7.1 - moderate - via @opentelemetry chain - transitive - fixAvailable: true (non-sentry path)
- `js-yaml` <=4.1.1 - moderate - CVSS 5.3 - "Quadratic-complexity DoS in merge key handling via repeated aliases" - transitive - fixAvailable: true

**CARRY-OVER (no change):**
- `postcss` <8.5.10 - moderate - CVSS 6.1 - XSS via `</style>` - transitive via `next` - fix: breaking (next major downgrade) - hold
- `next` 9.3.4-canary.0 - 16.3.0-canary.5 - moderate - isDirect: true - via postcss - fix: breaking - hold
- `@sentry/nextjs` >=6.3.6 - moderate - isDirect: true - fix: breaking major downgrade to 6.3.5 - hold

### Rate-limit / DoS

- `app/api/health/route.ts` - GET, unauthenticated, no rate limit - executes live DB query (`SELECT COUNT` on `profiles`) on every call - carry-over from 2026-05-19 (originally flagged LOW, escalating: at 50k users monitoring + external probes this is a trivial DB amplification vector) - add Upstash rate limit or a simple in-memory token bucket

### Dependency drift

- `@supabase/ssr` - 0.9.0 installed vs 0.12.0 latest (3 minor versions, drifting for 4 consecutive audits) - auth-adjacent; changelog review due before bump
- `react` / `react-dom` - 19.2.4 vs 19.2.7 (patch) - carry-over, routine

**Top 3 priorities:**
1. `ws` HIGH CVSS 7.5 - non-breaking fix available; run `npm audit fix` targeted to `ws` to clear without touching `next`. This is an active DoS vector at scale.
2. `vite` HIGH - fs.deny bypass + NTLMv2 leak; non-breaking fix available - run `npm audit fix` for vite.
3. `app/api/health/route.ts` - 4 audits deferred; add a rate limit (10 req/min per IP) before paid launch to prevent DB amplification abuse.

---

## 2026-06-09 16:23 UTC - weekly audit

**Sections with findings:** npm audit (carry-over), XSS pattern (new), file uploads (carry-over), dependency drift

**Closed since last audit (2026-06-02):**
- `app/gm-notes-popout/page.tsx:694` dangerouslySetInnerHTML XSS trap - **FIXED `03453dd` 2026-06-10** (replaced with React fragment children).
- `app/account/page.tsx:102` avatar upload missing pre-flight - **FIXED `03453dd` 2026-06-10** (routes through `prepareUpload('account-avatars', ...)`; 5 MB cap + image-only + SVG blocked).

### npm audit (moderate+)

- `postcss` <8.5.10 — moderate — CVSS 6.1 — "XSS via unescaped `</style>` in CSS stringify output" — transitive via `next` — fix: breaking — **carry-over, low runtime risk** (build-time only; app does not process user-supplied CSS at runtime)
- `next` 9.3.4-canary.0 - 16.3.0-canary.5 — moderate — via postcss — isDirect: true — fix: breaking major downgrade — hold
- `@sentry/nextjs` >=6.3.6 — moderate — via next — isDirect: true — fix: breaking — hold

### Injection / XSS patterns

- `app/gm-notes-popout/page.tsx:694` — **NEW** — `dangerouslySetInnerHTML={{ __html: \`${title} <span ...>\` }}` in `Section` component, `title` is an unescaped prop — all current callers pass static strings ("Plot Beats & Notes", "Tactical Scenes", "NPCs", "Pins") so no live XSS vector today, but component API accepts any string; if any future caller passes a user-sourced DB value (e.g. a note category name) this becomes stored XSS — harden by rendering title as a text node + a separate static span, or sanitize with DOMPurify before HTML interpolation

### File uploads

- `app/account/page.tsx:102` — avatar upload: **carry-over** — no explicit file type/extension whitelist before `resizeImage`; browser `accept="image/*"` is bypassable; canvas render acts as implicit guard but no typed rejection; all other upload paths use `prepareUpload` — low severity (output is always `contentType: 'image/jpeg'`, canvas fails gracefully for non-images, Supabase bucket enforces limits)

### Dependency drift

- `@supabase/ssr` — 0.9.0 → 0.12.0 (3 minor versions behind, was 0.10.3 at last audit — drifting) — advisory, review changelog before bump
- `react` / `react-dom` — 19.2.4 → 19.2.7 (patch) — carry-over, routine

**Top 3 priorities:**
1. `app/gm-notes-popout/page.tsx:694` — dangerouslySetInnerHTML with prop-passed `title`. No live XSS today but the API is a trap. Replace with `<span>{title}</span>` + separate `<span style="color:#f5f2ee"> · {count}</span>` as sibling React elements — eliminates the risk without visual change.
2. `app/account/page.tsx:102` — carry-over: add explicit MIME/extension pre-check before `resizeImage` (e.g. `if (!/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.type)) return`) to match `prepareUpload` pattern used everywhere else.
3. `@supabase/ssr` 0.9.0 → 0.12.0 — 3 minor versions of drift; review changelog and bump in a low-traffic window. Last two audits deferred this.

---

## 2026-06-02 16:23 UTC - weekly audit

**Sections with findings:** npm audit (carry-over), file uploads (minor new), dependency drift

**Closed since last audit (2026-05-26):**
- `app/scene-controls-popout/page.tsx` tactical-maps upload now uses `prepareUpload` (size + MIME + sanitization, per stability-audit M1 2026-05-30) - FIXED

### npm audit (moderate+)

- `postcss` <8.5.10 — moderate — CVSS 6.1 — "XSS via unescaped `</style>` in CSS stringify output" — bundled in `node_modules/next/node_modules/postcss` — fix: breaking (no viable non-breaking path) — **carry-over, low runtime risk** (build-time CSS; no user-supplied CSS processed at runtime)
- `next` 9.3.4-canary.0 - 16.3.0-canary.5 — moderate — via postcss — isDirect: true — fix: breaking major downgrade — hold
- `@sentry/nextjs` >=6.3.6 — moderate — via next — isDirect: true — fix: breaking — hold

### File uploads

- `app/account/page.tsx:102` — avatar upload: no explicit pre-flight size check before calling `resizeImage`. Browser `accept="image/*"` hint is bypassable; canvas resize in `resizeImage` provides implicit guard but no user-visible error for oversized files. All other upload paths use `prepareUpload` with explicit size cap. Inconsistency, low severity (output is always a 256px JPEG, Supabase bucket also enforces limits).

### Dependency drift

- `@supabase/ssr` — 0.9.0 → 0.10.3 (minor; carry-over) — advisory, no known CVEs
- `react` / `react-dom` — 19.2.4 → 19.2.7 (patch) — advisory, routine patch behind

**Top 3 priorities:**
1. `postcss`/`next`/`@sentry/nextjs` moderates — no non-breaking fix path available; monitor next.js releases for postcss 8.5.10+ bundle. Re-check weekly.
2. `app/account/page.tsx:102` — add explicit file size check (e.g. 5 MB cap) + `image/*` content-type pre-validation before calling `resizeImage`, consistent with `prepareUpload` pattern.
3. `@supabase/ssr` 0.9.0 → 0.10.3 — review changelog; minor bump is low risk.

---

## 2026-05-26 16:23 UTC - weekly audit

**Sections with findings:** npm audit, file uploads, dependency drift

**Closed since last audit (2026-05-19):**
- `session-attachments` upload now uses `prepareUpload` (filename + size + type) - FIXED
- `war-stories` upload now uses `prepareUpload` - FIXED
- `rumors` upload now uses `prepareUpload` - FIXED
- `verify-turnstile` now has Upstash distributed rate-limit (30 req/min sliding window) - FIXED
- `brace-expansion` + `ws` moderates cleared from npm audit - FIXED
- `dashboard/page.tsx` raw `.role` state variable removed; now routes through `roleIsThriver(profile)` - FIXED

### npm audit (moderate+)

- `postcss` <8.5.10 — moderate — CVSS 6.1 — "XSS via unescaped `</style>` in CSS stringify output" — transitive via `next` — fix: breaking (downgrade next to 9.3.3, not viable) — **carry-over, low runtime risk** (build-time CSS only; app does not process user-supplied CSS at runtime)
- `next` 9.3.4-canary.0 - 16.3.0-canary.5 — moderate — via postcss — isDirect: true — fix: breaking major downgrade — hold
- `@sentry/nextjs` >=6.3.6 — moderate — via next — isDirect: true — fix: breaking (6.3.5 downgrade) — hold

### File uploads

- `app/scene-controls-popout/page.tsx:316` — `uploadBackground` — tactical-maps bucket: **no size limit, no content-type check** — filename sanitized via regex but any file type accepted — `tactical-maps` bucket not registered in `lib/safe-upload.ts` BUCKETS whitelist — carry-over from 2026-05-19; GM-only page (auth-gated by `gm_user_id === user.id`) so exposure is bounded but inconsistent with `prepareUpload` pattern used everywhere else

### Dependency drift

- `@supabase/ssr` — installed 0.9.0 → latest 0.10.3 (minor; Supabase client API updates) — advisory, no known CVEs

**Top 3 priorities:**
1. `app/scene-controls-popout/page.tsx:316` — add `prepareUpload('tactical-maps', file)` guard + register `tactical-maps` in `lib/safe-upload.ts` with appropriate size/ext limits. Same pattern as war-stories and session-attachments.
2. `postcss` / `next` / `@sentry/nextjs` moderates — no action until next.js has a non-breaking fix path; re-check weekly.
3. `@supabase/ssr` 0.9.0 → 0.10.3 — evaluate changelog before minor bump; low urgency.

---

## 2026-05-19 16:23 UTC - weekly audit

**Sections with findings:** npm audit, file uploads, auth/role gates, rate-limit / DoS

### npm audit (moderate+)

- `brace-expansion` moderate - CVSS 6.5 - "Large numeric range defeats documented max DoS protection" - fix: non-breaking, apply directly
- `ws` moderate - CVSS 4.4 - "Uninitialized memory disclosure" - fix: non-breaking, apply directly
- `postcss` moderate - CVSS 6.1 - "XSS via unescaped </style> in CSS stringify output" (build-time only, low runtime risk) - fix: breaking (via `next` major bump)
- `next` moderate - fix: breaking major version bump (v9.3.3+) - hold, test first
- `@sentry/nextjs` moderate - fix: breaking major version bump (v6.3.5+) - hold, test first

### File uploads

- `app/stories/[id]/table/page.tsx:3414` - session-attachments upload: **no filename sanitization** (path is raw `file.name`), no size limit, no content-type check. Any filetype, any filename.
- `app/scene-controls-popout/page.tsx:307` - tactical-maps upload: no size limit, no content-type check (filename IS sanitized via regex).
- `app/campfire/war-stories/page.tsx:410` - 10 MB size check is client-side only (bypassable); no content-type check.
- `app/rumors/[id]/edit/page.tsx:205` - uses `file.type` as contentType (user-supplied header, not validated); no size check.

### Auth / role gates

- `app/dashboard/page.tsx:52` - `profile.role` accessed directly, lowercased manually, stored as `userRole` state for display. Inconsistent with canonical pattern; not a direct security bypass (actual permission branches use `roleIsThriver(profile)`), but erodes the "never touch .role directly" invariant.

### Rate-limit / DoS

- `app/api/auth/verify-turnstile/route.ts:3` - POST handler: no rate limit, no body-size cap. Turnstile provides CAPTCHA protection but the route itself can be flooded to abuse the Cloudflare verify API or exhaust edge function quota.
- `app/api/health/route.ts:24` - GET handler: unauthenticated, no rate limit (low risk - read-only health probe).

**Top 3 priorities:**
1. `app/stories/[id]/table/page.tsx:3414` - session-attachments: unsanitized `file.name` in storage path + no size/type guard. Highest exploitability of the upload findings.
2. `brace-expansion` + `ws` - non-breaking fixes available; run `npm audit fix` scoped to these two packages to clear without touching `next`.
3. `app/api/auth/verify-turnstile/route.ts:3` - add rate limiting (e.g. Upstash / Vercel rate-limit middleware) before scaling paid signups.

---
