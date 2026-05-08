// Auth callback — handles the redirect that comes back from Supabase
// after a user clicks the email-confirmation link (or any other
// magic-link / OAuth flow that uses PKCE). Supabase appends `?code=<token>`;
// we exchange the code for a session via the server-side SSR client so
// the auth cookie is set on this request before we redirect back to the
// app. Without this route, clicking a confirmation link lands on a 404
// and the user never gets a session.
//
// Optional `?next=/path` is the destination after a successful exchange,
// so an invite link can preserve "land on /join/<code>" through the
// confirmation round-trip. Falls back to /dashboard.
//
// On any failure (missing code, expired code, exchange error) we redirect
// to /login with a helpful error param. The login page surfaces it.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  // Same single-slash relative-path guard as the login/signup pages so a
  // tampered confirmation link can't open-redirect us to evil.com.
  const next = (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//'))
    ? nextParam
    : '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=callback_failed`)
  }

  // Belt-and-suspenders profile upsert. The handle_new_user() trigger
  // (SECURITY DEFINER) normally creates the profile row when auth.users
  // gets inserted, but the trigger swallows errors (per the EXCEPTION
  // block in sql/handle-new-user-hardened.sql) — so a username collision
  // or a newly-added NOT NULL column would silently leave the user with
  // no profile. Doing the upsert here, post-exchange, runs while
  // auth.uid() == user.id so the RLS policy accepts it; if the trigger
  // already inserted the row, ON CONFLICT (id) makes it a no-op.
  const user = exchangeData.user
  if (user) {
    const username = (user.user_metadata?.username as string | undefined)
      ?? user.email?.split('@')[0]
      ?? 'survivor'
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      username,
      email: user.email ?? null,
      role: 'Survivor',
      onboarded: false,
    }, { onConflict: 'id' })
    if (profileError) {
      // Profile setup failure here is non-fatal — the user has a session,
      // they can still navigate; we just log so a missing-profile bug
      // doesn't go unnoticed.
      console.error('[auth/callback] profile upsert error:', profileError.message)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
