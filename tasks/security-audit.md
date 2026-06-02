# Security Audit Log

Weekly autonomous deep-scan (Tuesdays 16:23 UTC). Newest first. Silent runs (clean) are NOT logged here - absence = clean.

This is wider than the 3-hour health-pulse (tasks/health-pulse.md) - includes dev-dep audits, file-upload paths, secret-exposure scans, SQL/XSS pattern checks, dependency drift, RLS gap scan, API rate-limit surface.

When you see a new entry: triage via debug-handoff.md Sec. 4. Most findings will be advisory, not urgent.

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
