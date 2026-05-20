# Security Audit Log

Weekly autonomous deep-scan (Tuesdays 16:23 UTC). Newest first. Silent runs (clean) are NOT logged here - absence = clean.

This is wider than the 3-hour health-pulse (tasks/health-pulse.md) - includes dev-dep audits, file-upload paths, secret-exposure scans, SQL/XSS pattern checks, dependency drift, RLS gap scan, API rate-limit surface.

When you see a new entry: triage via debug-handoff.md Sec. 4. Most findings will be advisory, not urgent.

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
