# Email-Confirmation Gate - Testplan

**Date:** 2026-05-08
**Files touched:**
- `app/auth/callback/route.ts` (new)
- `app/signup/page.tsx`
- `app/login/page.tsx`

## What's solved

Spam mitigation. With Supabase's "Confirm email" setting on, every new
account has to receive and click a link in a real inbox before it can
sign in. Most disposable-email infrastructure can't receive Supabase
confirmation emails, and most spam bots don't have working email
infrastructure at all. This is the single highest-leverage non-CAPTCHA
defense and adds zero ad-blocker friction.

## What changed

### 1. New `/auth/callback` route handler

`app/auth/callback/route.ts`. When a user clicks the confirmation link
in their email, Supabase redirects there with `?code=<token>`. The
handler:

- Reads the code
- Spins up a server-side Supabase client (`@supabase/ssr` →
  `createServerClient`) with cookie wiring
- Calls `supabase.auth.exchangeCodeForSession(code)` - this sets the
  auth cookie on the response
- Redirects to `?next=<path>` (sanitized to relative paths only) or
  `/dashboard` by default
- Failures redirect back to `/login?error=...` with a hint code

Without this route, clicking confirmation links 404s and users never
get a session.

### 2. `/signup` - `emailRedirectTo` + post-signup state

`app/signup/page.tsx`:

- `signUp` now passes `emailRedirectTo: <origin>/auth/callback?next=<path>`.
  The optional `next` carries an invite-deep-link target through the
  email round-trip so confirmed users land on `/join/<code>` not generic
  `/dashboard`.
- After a successful `signUp`: if `data.session` exists (= "Confirm
  email" is OFF in Supabase) we push to the destination as before. If
  it's null (= "Confirm email" is ON) we render a "Check your email"
  view with the email displayed + a "Resend Confirmation Email" button +
  a "Wrong email? Start over" affordance.
- The new branch uses `supabase.auth.resend({ type: 'signup', email,
  options: { emailRedirectTo } })` to re-trigger the email.

### 3. `/login` - `Email not confirmed` handled gracefully

`app/login/page.tsx`:

- When `signInWithPassword` returns "Email not confirmed", we set a
  separate `unconfirmedEmail` state and render an amber banner with the
  email + a "Resend Confirmation Email" button. Same `auth.resend`
  shape as `/signup`.
- The banner does NOT use the standard red error block; it's a yellow/
  amber notice (#EF9F27 on dark amber) so it reads as
  "fixable issue" not "your password is wrong."
- Other auth errors (wrong password, etc.) still surface in the red
  error block.

### 4. `/login` - surface `?error=...` from callback

If `/auth/callback` fails (missing/expired code, exchange error), it
redirects to `/login?error=...`. Login now reads the param on mount and
shows a matching message in the standard error block.

Hint codes:
- `missing_code` → "Confirmation link was incomplete..."
- `callback_failed` → "Confirmation link expired or was already used..."

## Required Supabase dashboard config

This code is dormant without two settings flipped in the Supabase
dashboard:

### Step 1 - Enable email confirmation
1. Authentication → Sign In / Providers → Email
2. Toggle **Confirm email** ON
3. Save

After this, new signups create the user row but the user can't sign in
until they click the email link.

### Step 2 - Add the callback URL to allowed redirects
1. Authentication → URL Configuration
2. **Site URL** should be `https://thetapestry.distemperverse.com`
3. **Redirect URLs** must include:
   - `https://thetapestry.distemperverse.com/auth/callback`
   - `https://thetapestry.distemperverse.com/auth/callback?next=*`
   (Supabase wildcards)
   - `http://localhost:3000/auth/callback` (dev)
   - `http://localhost:3000/auth/callback?next=*` (dev)
4. Save

Without these in the allowlist, Supabase will refuse to redirect users
back to your site after they click the link, even though the link
itself works.

### Step 3 - Verify email delivery
The signup flow generates an email, but it only lands in inboxes if
Resend (or whichever email provider) is wired in Supabase's SMTP
settings. The 2026-05-08 handoff flagged "Domain verification spot-check
on Resend" as still open - confirm it independently:

1. Sign up with a real personal email address
2. Check inbox + spam folder within ~1 minute
3. If the email never arrives: Supabase Auth → Emails → Logs (or
   Resend dashboard → Logs) for the failed delivery

## Verification - happy path

- [ ] Open `/signup` in incognito. Sign up with a real email address
      you can check. Form submits → "Check Your Email" view appears with
      the email shown.
- [ ] Confirmation email arrives within ~30s. Click the link.
- [ ] Lands back at `/dashboard` (or whatever `?next=` was) with an
      authenticated session.
- [ ] Try `/login` immediately - sign in succeeds.

## Verification - failure paths

- [ ] **Try to log in before confirming.** Sign up but don't click the
      email yet. Try `/login` with the same email/password. Expect amber
      banner: "Email not confirmed yet. Check the inbox for <email>..."
      with a Resend button. Clicking Resend re-fires the email.
- [ ] **Wrong email at signup.** On the "Check Your Email" view, click
      "Start over" - form clears back to empty.
- [ ] **Click old/expired link.** If a user clicks an old link after
      confirming via a newer one, callback redirects to
      `/login?error=callback_failed` and login shows
      "Confirmation link expired or was already used. Sign in normally..."
- [ ] **Resend during cooldown.** Supabase rate-limits resend to 1/60s.
      Click Resend twice fast - second click `alert()`s the rate-limit
      error.

## Verification - invite-link flow

- [ ] Generate a campaign invite link (e.g. `/join/abc123`).
- [ ] Open it in incognito → bounces to `/login?redirect=/join/abc123`.
- [ ] Click "Sign Up" - lands on `/signup?redirect=/join/abc123`.
- [ ] Sign up with a real email. Confirmation email arrives.
- [ ] Click confirmation link → lands at `/join/abc123` (NOT `/dashboard`),
      preserving the invite context through the round-trip.

## Known limitations / follow-ups

1. **Password reset, email change, magic link** - same Confirm-email
   pattern applies. Password reset isn't implemented yet; if/when added,
   it needs a similar `emailRedirectTo` + `/auth/callback` round-trip.
2. **OAuth providers** - none currently. If added, they use the same
   callback route (PKCE flow) so no additional code path needed; just
   add the OAuth redirect URLs to Supabase's allowlist.
3. **Profile row creation** - currently happens in the signup handler
   between `auth.signUp` and the redirect. With confirmation enabled,
   the row is created with the unconfirmed user - fine, since RLS
   policies only check `auth.uid()` which is null until they confirm.
   But the `profiles` row exists even for users who never confirm.
   Trade-off: the row is small (~100 bytes); the alternative is a
   Supabase trigger that creates it on confirm, which is more setup.
   Defer.
4. **Resend rate limit** - Supabase's built-in cooldown surfaces as an
   alert. A nicer UX would suppress the button + show countdown for 60s.
   ~10 min job if it becomes annoying.
