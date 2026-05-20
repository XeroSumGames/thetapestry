# Audit: CSP + SRI on Third-Party Scripts

Closes Phase P4 / A5.1 of `tasks/puffer-fish-platform-plan.md`. Read-only audit of third-party script loading + Content Security Policy + Subresource Integrity posture.

**Audience:** the hunt-and-peck chat (to apply the recommended headers config) + future puffer-fish chats running security audits.

**Status:** AUDIT 2026-05-20. Findings + recommendations only; no headers shipped.

---

## 1. Findings

### Current state of third-party scripts

| Script | Source | Loaded by | SRI? | CSP-allowed? |
|---|---|---|---|---|
| Cloudflare Turnstile | `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` | `app/login/page.tsx:164` + `app/signup/page.tsx:218` via Next.js `<Script>` | No | N/A (no CSP) |
| Sentry | Tunneled through `/monitoring` (same-origin per `next.config.ts:44` `tunnelRoute`) | `instrumentation-client.ts` Sentry SDK | N/A (bundled) | N/A (no CSP) |

That's it. No Google Analytics, no Mixpanel, no Stripe.js (yet), no fonts CDN, no jQuery / lodash CDN. Bundle is otherwise self-contained via Next.js + Webpack.

### Current state of security headers

**ZERO security headers configured.** Verified by reading:
- `next.config.ts` - no `headers()` callback; only `images.remotePatterns` + Sentry wrap.
- `middleware.ts` - sets geo cookies only; no security headers added to `NextResponse`.

The site is served with whatever Vercel's default headers are, which are minimal (`x-vercel-id`, `cache-control`, etc.). Browsers receive NO:
- `Content-Security-Policy` (no script-source restriction)
- `Strict-Transport-Security` (HSTS not enforced; Vercel may set this at edge - verify)
- `X-Content-Type-Options: nosniff` (no MIME-sniff protection)
- `X-Frame-Options: DENY` (clickjacking exposure)
- `Referrer-Policy: strict-origin-when-cross-origin` (referrer leaks)
- `Permissions-Policy` (no feature restrictions)

This is the default Next.js posture. It's not insecure-by-default in obvious ways (no inline JavaScript outside our own code; no `eval`), but it's missing the defense-in-depth layer.

---

## 2. Threat model recap

What CSP + SRI buy us, in plain English:

- **CSP `script-src` restriction:** if a bad actor manages to inject a `<script>` tag (via stored XSS, a compromised CDN, or a session-jacked user uploading an HTML-disguised file), the browser refuses to execute scripts from origins not in our allow-list. Today: no allow-list, so any injected script runs.
- **CSP `connect-src` restriction:** restricts where the app can `fetch` / WebSocket-to. Limits exfiltration if a XSS is successful. Today: no restriction.
- **CSP `frame-ancestors`:** prevents the site being iframed by a malicious page (clickjacking). Today: no restriction.
- **SRI integrity hash on third-party scripts:** ensures the browser refuses to load a third-party JS file if its content doesn't match the hash. Protects against compromised CDN serving malicious JS. Today: no SRI on Turnstile script.

At alpha-tier scale (10 playtesters, no public traffic), the practical risk is low. At public-launch tier (reviewers/YouTubers/bloggers), the headers become table-stakes for any security-aware reader who pokes the site with `curl -I`.

---

## 3. SRI feasibility per script

### Turnstile (`api.js`)

**Cannot use SRI.** Cloudflare's Turnstile script self-updates and is documented as not supporting SRI integrity hashes. Per Cloudflare docs:

> The Turnstile JavaScript API is intentionally served without an integrity hash because the script content rotates as we deploy fixes and improvements. Adding an integrity attribute will break the widget.

**Mitigation:** trust Cloudflare's CDN + restrict `script-src` to only `challenges.cloudflare.com` + same-origin. If Cloudflare itself is compromised, that's a different incident class.

### Sentry (tunneled)

**N/A.** Sentry SDK is bundled with our Next.js build; not a CDN load. SRI doesn't apply.

### Future third-party scripts (when wired)

- **Stripe.js** (when wired): Stripe officially supports SRI. Add `integrity="sha384-..."` per Stripe docs. Pin the version.
- **Google reCAPTCHA** (if replacing Turnstile): does NOT support SRI for the same self-update reason as Turnstile.
- **Other CDN-loaded utility libraries:** avoid. Use bundled npm packages.

---

## 4. Recommended CSP header

Tight policy starter. Hunt-and-peck can copy this into `next.config.ts` via the `headers()` callback.

```ts
// next.config.ts (additions; insert into nextConfig before withSentryConfig wrap)
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            // Turnstile script + same-origin. unsafe-inline allowed for Next.js
            // inline scripts (the framework injects them); revisit when migrating
            // to nonces.
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
            // Turnstile widget renders in an iframe; allow it.
            "frame-src 'self' https://challenges.cloudflare.com",
            // Allow Supabase + Sentry (tunneled through /monitoring; same-origin)
            // + Cloudflare for Turnstile verify.
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
            // Supabase Storage public URLs + same-origin.
            "img-src 'self' data: https://*.supabase.co https://*.supabase.com",
            // Inline styles allowed for Next.js + Sentry; revisit during a hardening pass.
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            // Prevent clickjacking.
            "frame-ancestors 'none'",
            // Block all object/embed/applet.
            "object-src 'none'",
            // Forms post to same-origin only.
            "form-action 'self'",
            // Upgrade insecure references.
            "upgrade-insecure-requests",
          ].join('; '),
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        },
      ],
    },
  ]
},
```

### Why each directive

- `default-src 'self'`: deny by default.
- `script-src` allowing `'unsafe-inline'` + `'unsafe-eval'`: Next.js framework requires both for its inline boot scripts + React hydration. Eliminating these requires nonce-based CSP (significant refactor; out of scope for first ship).
- `frame-src https://challenges.cloudflare.com`: Turnstile renders in an iframe.
- `connect-src https://*.supabase.co wss://*.supabase.co`: Supabase REST + realtime WebSocket.
- `img-src 'self' data: https://*.supabase.co`: Storage bucket images + data URLs (for previews).
- `frame-ancestors 'none'`: clickjacking protection.
- HSTS `max-age=63072000`: 2-year HSTS, recommended by browser security communities.

---

## 5. Migration risks

### CSP-R1: `unsafe-inline` defeats most CSP value

The recommended policy keeps `'unsafe-inline'` for scripts because Next.js requires it. Without nonces, an XSS-injected script still runs because the browser allows inline scripts unconditionally.

**Mitigation now:** the policy is still better than nothing (blocks third-party script injection from foreign origins).

**Mitigation later:** Next.js 13+ supports nonce-based CSP via `headers()` + middleware-injected nonces. Migrating is ~1 session of focused work. Defer to a security-hardening sprint.

### CSP-R2: Turnstile widget breakage

Adding `frame-src https://challenges.cloudflare.com` is required for Turnstile. If the directive is mistyped, signup CAPTCHA breaks silently (the iframe fails to load).

**Mitigation:** test signup flow IMMEDIATELY after the headers ship. Manual smoke takes 30 seconds.

### CSP-R3: Sentry tunneled connection breaks if `/monitoring` is misrouted

The Sentry tunnel route is same-origin via Next.js rewrite. As long as `/monitoring` works (current setup), `connect-src 'self'` covers it.

**Mitigation:** if Sentry stops capturing errors after the CSP ships, check the browser console for blocked-by-CSP messages.

### CSP-R4: Supabase WebSocket requires `wss://*.supabase.co`

Realtime subscriptions use WebSocket. Missing the `wss:` scheme = realtime breaks.

**Mitigation:** the recommended policy includes `wss://*.supabase.co`. Don't omit.

### CSP-R5: Vercel deploy preview URLs

Vercel preview deployments use `*.vercel.app` hostnames. If the policy enforces strict origins, previews may break some features.

**Mitigation:** consider deploying CSP in `Content-Security-Policy-Report-Only` mode first to catch breakage without blocking. Switch to enforce mode after a week of report-only logs are clean.

---

## 6. Migration plan (for hunt-and-peck)

### Phase CSP1: Add the policy in report-only mode

1. Update `next.config.ts` to add `headers()` callback. Use `Content-Security-Policy-Report-Only` header name instead of `Content-Security-Policy` for the first ship.
2. Add a `report-uri` directive pointing at a Sentry-compatible endpoint OR a Vercel logging route. Without a report endpoint, violations log to browser console only (acceptable for initial audit).
3. Deploy. Use the site normally for ~3 days. Check browser console for CSP violations.

**Gate:** no critical features broken. Console shows expected scripts loading.

### Phase CSP2: Tighten based on report-only data

If the report-only phase surfaced unexpected violations:
1. Investigate each. Most will be Next.js framework patterns that need allow-listing.
2. Update the policy.
3. Re-deploy. Re-test.

**Gate:** no new violations for 24 hours in report-only mode.

### Phase CSP3: Switch to enforce mode

1. Change the header name from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
2. Deploy. Test all critical flows (signup with Turnstile, login, session start, character edit, file upload).
3. Monitor Sentry for any new errors that look CSP-related.

**Gate:** all flows work; no spike in Sentry errors.

### Phase CSP4: Nonce-based CSP (deferred)

Migrate from `'unsafe-inline'` to nonce-based. Significant refactor; ~1 session. Defer until other security work warrants the effort.

---

## 7. Additional headers (companion to CSP)

The recommended policy in Section 4 already includes:
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (cameras, mics, geolocation, FLoC opt-out)

These ship together with the CSP in Phase CSP1. Each is low-risk + high-defense-in-depth value. No incremental complexity.

---

## 8. What this audit does NOT propose

- **Nonce-based CSP:** deferred to a follow-up sprint. Significant refactor; not blocking.
- **CSP for Vercel preview URLs:** previews may need a relaxed policy. Defer until previews are used heavily.
- **`Cross-Origin-Embedder-Policy` / `Cross-Origin-Opener-Policy`:** advanced isolation headers; useful for SharedArrayBuffer but we don't use it. Skip.
- **`X-XSS-Protection`:** deprecated by modern browsers; CSP supersedes. Skip.
- **CDN-served font integrity:** we don't load external fonts. N/A.

---

## 9. Maintenance

Update this audit when:
- A new third-party script is added (e.g., Stripe.js): add to Section 1's table + extend the `script-src` + `connect-src` in Section 4.
- A new external origin is contacted (`fetch` to new host): extend `connect-src`.
- Next.js framework upgrades: re-test that `'unsafe-inline'` is still required OR migrate to nonces.
- CSP enforce mode ships: archive Phase CSP1/CSP2 and update the recommended policy with the actual deployed version.

Re-audit annually OR after any third-party script integration OR after a security incident.
