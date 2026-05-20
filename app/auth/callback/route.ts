// Auth callback - handles the redirect that comes back from Supabase
// after the user clicks an email-confirmation link, OR an OAuth/PKCE
// flow returns. The two flows arrive with different query params and
// require different exchange APIs:
//
//   - Email confirmation:  ?token_hash=<...>&type=signup  → verifyOtp()
//   - OAuth / magic link:  ?code=<...>                    → exchangeCodeForSession()
//
// First version of this file only handled the OAuth shape, which broke
// every email-confirmation link silently - Supabase actually sends
// token_hash on the email link, not code. Real-world signup tested
// 2026-05-08 and got "Invalid login credentials" because the email
// was never marked confirmed.
//
// Optional `?next=/path` survives both flows - invite links can
// preserve "land on /join/<code>" through the confirmation round-trip.
// Falls back to /dashboard.
//
// On any failure (missing params, expired token, exchange error) we
// redirect to /login with a helpful ?error param. The login page
// surfaces it as a friendly message.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { SURVIVOR } from '../../../lib/auth/roles'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  // Same single-slash relative-path guard as the login/signup pages so a
  // tampered confirmation link can't open-redirect us to evil.com.
  const next = (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//'))
    ? nextParam
    : '/dashboard'

  if (!tokenHash && !code) {
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

  // Branch 1 - email confirmation / password recovery / email change.
  // verifyOtp marks the email confirmed (or completes the recovery /
  // change flow) AND sets a session in one shot.
  let userId: string | null = null
  let userEmail: string | null = null
  let userMetadataUsername: string | null = null
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      console.error('[auth/callback] verifyOtp error:', error.message)
      return NextResponse.redirect(`${origin}/login?error=callback_failed`)
    }
    userId = data.user?.id ?? null
    userEmail = data.user?.email ?? null
    userMetadataUsername = (data.user?.user_metadata?.username as string | undefined) ?? null
  } else if (code) {
    // Branch 2 - OAuth / magic-link / PKCE flows. Different API, same
    // outcome (sets a session cookie on the response).
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message)
      return NextResponse.redirect(`${origin}/login?error=callback_failed`)
    }
    userId = data.user?.id ?? null
    userEmail = data.user?.email ?? null
    userMetadataUsername = (data.user?.user_metadata?.username as string | undefined) ?? null
  }

  // Belt-and-suspenders profile upsert. The handle_new_user() trigger
  // (SECURITY DEFINER) normally creates the profile row when auth.users
  // gets inserted, but the trigger swallows errors (per the EXCEPTION
  // block in sql/handle-new-user-hardened.sql) - so a username collision
  // or a newly-added NOT NULL column would silently leave the user with
  // no profile. Doing the upsert here, post-verify, runs while
  // auth.uid() == user.id so the RLS policy accepts it; if the trigger
  // already inserted the row, ON CONFLICT (id) makes it a no-op.
  if (userId) {
    const username = userMetadataUsername
      ?? userEmail?.split('@')[0]
      ?? 'survivor'
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      username,
      email: userEmail,
      role: SURVIVOR,
      onboarded: false,
    }, { onConflict: 'id' })
    if (profileError) {
      // Profile setup failure here is non-fatal - the user has a session,
      // they can still navigate; we just log so a missing-profile bug
      // doesn't go unnoticed.
      console.error('[auth/callback] profile upsert error:', profileError.message)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
