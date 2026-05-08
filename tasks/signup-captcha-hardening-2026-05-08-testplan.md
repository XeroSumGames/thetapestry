# Signup CAPTCHA Hardening — Testplan

**Date:** 2026-05-08
**Files touched:** `app/signup/page.tsx`

## What was wrong

The previous Turnstile flow on `/signup` failed-open silently when no token
was returned by the widget:

```ts
const tsToken = await getToken()
if (tsToken) {            // ← skipped entirely when null
  const check = await fetch('/api/auth/verify-turnstile', ...)
  if (!check.ok) { ... }
}
```

`getToken()` returns `null` when:
- `(window as any).turnstile` is undefined (script blocked, ad blocker, CDN
  issue, no JS at all)
- The widget mount hadn't completed yet (very fast submit)
- The 8-second internal timeout fires waiting for a token

Result: ad-blocker users **and** automated bots (curl, headless without
running JS, scripts that race the mount) both bypassed verification entirely.
The honeypot + consonant-run username check were the only gate, and a bot
using a normal-looking name with auto-fill skip evades both.

## What changed

Three layers, all in `handleSignup`:

1. **Layer 1 (unchanged) — honeypot.** Bot fills hidden `name="website"` →
   silent redirect to `/dashboard` (no error tip-off).
2. **Layer 2 (unchanged) — `looksRandom(username)`.** 6+ consecutive
   consonants → block.
3. **Layer 3 (NEW) — hard-fail Turnstile gate.** When
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is configured, a valid server-verified
   token is now **required**. No more silent fall-through.
4. **Layer 4 (NEW) — `captchaToken` forwarded to `supabase.auth.signUp`.**
   When Supabase Bot and Abuse Protection is enabled in the dashboard, the
   auth call itself is rejected without a valid token — even by clients that
   bypass the page entirely.

## Required Supabase dashboard config

For Layer 4 to actually enforce, you must enable CAPTCHA in the Supabase
dashboard. **This is a one-time config, outside the codebase.**

1. Open the Supabase dashboard for the production project.
2. Navigate to **Authentication → Settings → Bot and Abuse Protection**.
3. Toggle **Enable CAPTCHA protection**.
4. Provider: **Cloudflare Turnstile**.
5. Secret key: paste `TURNSTILE_SECRET_KEY` (same value already in Vercel
   env). Available in Cloudflare → Application Security → Turnstile → "The
   Tapestry" widget.
6. Save.

**Side-effect:** once enabled, CAPTCHA is also required for `signInWithPassword`,
`signInWithOtp`, and password recovery. `/login` uses `signInWithPassword`
and currently does NOT pass a captchaToken — enabling Supabase CAPTCHA
without first wiring Turnstile into `/login` will lock out all logins.

**Recommended order of operations:**
1. Ship this commit (signup tightened).
2. Verify signup still works on production with the new gate.
3. Wire Turnstile into `/login` (port the same widget mount pattern).
4. Then flip the Supabase dashboard toggle.

If you skip step 3, every login will fail with "captcha verification process
failed" once step 4 is applied.

## Verification — happy path

- [ ] Open `/signup` in a normal browser (no ad blocker). Fill form
      legitimately. Sign up succeeds, lands on `/dashboard`.
- [ ] Browser DevTools → Network: confirm `POST /api/auth/verify-turnstile`
      fires before the auth call and returns `200 {ok:true}`.

## Verification — failure paths

- [ ] **Ad blocker.** Enable uBlock Origin / Privacy Badger that blocks
      `challenges.cloudflare.com`. Try to sign up. Expect:
      *"Bot check unavailable. Disable any ad blockers for this site and
      refresh."* No account created. Verify by checking auth.users in the
      Supabase table editor — no new row.
- [ ] **No JS.** Use a tool like `curl` to POST to `/signup` (form action).
      Doesn't trigger the React form handler, but if anyone wired a direct
      POST to Supabase auth: would fail at Supabase once dashboard CAPTCHA
      is enabled.
- [ ] **Timeout.** Throttle network in DevTools to "Slow 3G", reload, click
      submit before the widget mounts (within ~1s). Expect: *"Bot check
      timed out. Refresh and try again."*
- [ ] **Tampered token.** In DevTools console, run:
      `fetch('/api/auth/verify-turnstile', { method: 'POST', headers:
      {'Content-Type':'application/json'}, body: JSON.stringify({ token:
      'fake-token' }) }).then(r=>r.status)`. Expect `403`.

## Verification — dev mode

- [ ] Run locally without `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set. Signup
      should still work without any CAPTCHA prompt — the gate skips when
      the env var is absent.

## Known limitations / follow-ups

1. **`/login` not yet protected.** Brute-force / credential-stuffing on
   existing accounts isn't blocked by anything. Port the Turnstile widget
   mount pattern to `app/login/page.tsx` and pass `captchaToken` to
   `supabase.auth.signInWithPassword`. ~30 min job.
2. **Magic link / OAuth.** No magic-link or OAuth flows currently exist;
   if added later, both need captchaToken too.
3. **Server-side signup endpoint.** Belt-and-suspenders++ would be a
   `/api/auth/signup` route that uses the Supabase service role to create
   the account, with mandatory Turnstile verification first. Then the
   client form posts to that route instead of calling
   `supabase.auth.signUp` directly. Defers cleanly to a future hardening
   pass.
4. **Invite-code gate.** `tasks/scaling-plan-tier-abc.md` flags a
   `signup_codes` table for invite-only signup. Cleanest way to stop spam
   entirely if open signup isn't required for MVP.

## Fingerprint

`grep -n 'siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY' app/signup/page.tsx`
should return one match (line ~127). The old fail-open `if (tsToken)` gate
is gone.
