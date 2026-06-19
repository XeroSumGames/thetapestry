'use client'
import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { logEvent } from '../../lib/events'
import { SURVIVOR } from '../../lib/auth/roles'

// Safe-redirect guard: only accept single-slash relative paths (no
// open-redirect vector). Same shape as the helper in app/login/page.tsx.
function readSafeRedirect(): string | null {
  if (typeof window === 'undefined') return null
  const target = new URLSearchParams(window.location.search).get('redirect')
  if (!target || !target.startsWith('/') || target.startsWith('//')) return null
  return target
}

// Catches machine-generated usernames like "wEpAfxklFqFikMBdndLxo".
// Real names/handles almost never have 6+ consecutive consonants in a row;
// random base-62 strings do (the spam account that triggered this had a
// run of 8). Treats y/Y as a vowel to avoid flagging names like "Grumpy".
function looksRandom(username: string): boolean {
  const vowels = new Set('aeiouAEIOUyY')
  let run = 0
  for (const ch of username) {
    if (/[a-zA-Z]/.test(ch)) {
      if (vowels.has(ch)) { run = 0 } else { if (++run >= 6) return true }
    } else {
      run = 0
    }
  }
  return false
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [redirect, setRedirect] = useState<string | null>(null)
  // Honeypot - real users never see or fill this field (positioned off-screen).
  // Bots that auto-fill all inputs will populate it; we silently drop the request.
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // When Supabase "Confirm email" is enabled, signUp returns no session.
  // We swap the form view for a "check your email" message instead of
  // pushing to /dashboard (which would just bounce back to /login).
  const [checkEmailFor, setCheckEmailFor] = useState<string | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const cachedTokenRef = useRef<string | null>(null)
  const widgetErroredRef = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  // Capture `?redirect=/path` so an invite link that bounces a logged-out
  // user through signup ends at the original target, not `/firsttimers`.
  // Users invited to a specific campaign skip the generic welcome page.
  useEffect(() => { setRedirect(readSafeRedirect()) }, [])

  function mountTurnstile() {
    const ts = (window as any).turnstile
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!ts || !sitekey || widgetIdRef.current) return
    // Auto-execution: widget solves invisibly as soon as it renders.
    // Token is cached in cachedTokenRef; we read it on submit rather than
    // calling execute() which conflicts with Managed mode and hangs.
    widgetIdRef.current = ts.render('#turnstile-container', {
      sitekey,
      callback: (token: string) => { cachedTokenRef.current = token; widgetErroredRef.current = false },
      'expired-callback': () => { cachedTokenRef.current = null },
      'error-callback': () => { cachedTokenRef.current = null; widgetErroredRef.current = true },
    })
  }

  // Returns the cached token (widget already solved on page load).
  // Resets + re-solves if expired, with an 8s timeout.
  // Returns null if the widget isn't mounted (env var missing, etc.).
  function getToken(): Promise<string | null> {
    const ts = (window as any).turnstile
    if (!ts || !widgetIdRef.current) return Promise.resolve(null)
    const existing = cachedTokenRef.current
    if (existing) return Promise.resolve(existing)
    // Token not ready yet (very fast submit) - wait up to 8s
    return new Promise(resolve => {
      const tid = setTimeout(() => resolve(null), 8000)
      const orig = (window as any).__turnstileCb
      ;(window as any).__turnstileCb = (token: string) => {
        clearTimeout(tid)
        cachedTokenRef.current = token
        ;(window as any).__turnstileCb = orig
        resolve(token)
      }
      ts.reset(widgetIdRef.current!)
    })
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
    // Honeypot - if filled, it's a bot. Silently succeed to avoid tipping off scrapers.
    if (honeypot) { router.push(redirect ?? '/dashboard'); return }

    // Username sanity - block machine-generated random strings.
    if (looksRandom(username)) {
      setError('Username looks randomly generated - please choose a recognizable name.')
      return
    }

    // Turnstile (soft gate). When the widget produces a token we verify
    // server-side and hard-block on rejection. When it doesn't (ad
    // blocker, blocked CDN, fast submit before mount) we fall through -
    // honeypot + looksRandom are first-line defenses, and the captchaToken
    // is forwarded to supabase.auth.signUp so a future dashboard toggle
    // (Authentication → Attack Protection → Enable Captcha) can tighten
    // server-side without requiring all ad-blocker users to disable for
    // the site. If spam volume comes back, switch this to hard-fail (was
    // shipped briefly in 5dfd9d5; reverted in this commit).
    const tsToken = await getToken()
    if (tsToken) {
      const check = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tsToken }),
      })
      if (!check.ok) {
        cachedTokenRef.current = null
        setError('Bot check failed - please try again.')
        return
      }
    }

    // emailRedirectTo points at the auth/callback route handler. After
    // the user clicks the confirmation link, Supabase redirects there
    // with `?code=<token>`, the route exchanges the code for a session,
    // and then bounces them to the original destination (?next=...) so
    // an invite-link signup ends at /join/<code> not generic /dashboard.
    const callbackPath = `/auth/callback${redirect ? `?next=${encodeURIComponent(redirect)}` : ''}`
    const emailRedirectTo = `${window.location.origin}${callbackPath}`

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { username },
        // Harmless when dashboard CAPTCHA is off; activates the server-
        // side gate when it's eventually flipped on.
        ...(tsToken ? { captchaToken: tsToken } : {}),
      },
    })
    if (signUpError) {
      console.error('[Signup] auth error:', signUpError.message)
      setError(signUpError.message)
      return
    }
    // Profile row is created server-side by the handle_new_user() trigger
    // (SECURITY DEFINER, bypasses RLS). The previous client-side upsert
    // here was meant as belt-and-suspenders, but with email-confirm ON
    // there's no session yet - auth.uid() is null on the client, so the
    // upsert hits the profiles RLS "id = auth.uid()" check and rejects
    // with "new row violates row-level security policy."
    //
    // Strategy now:
    //   - When data.session IS present (email confirm OFF): the user is
    //     authenticated, do the upsert here as before.
    //   - When data.session IS null (email confirm ON): skip the upsert,
    //     trust the trigger. /auth/callback runs the same upsert again
    //     after exchangeCodeForSession to cover the rare case where the
    //     trigger failed silently (username collision, etc.).
    if (signUpData.user && signUpData.session) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        username,
        email,
        role: SURVIVOR,
        onboarded: false,
      }, { onConflict: 'id' })
      if (profileError) {
        console.error('[Signup] profile creation error:', profileError.message)
        setError(`Account created but profile setup failed: ${profileError.message}`)
        return
      }
    }
    logEvent('signup', { username })

    // If "Confirm email" is enabled in the Supabase dashboard, signUp
    // returns { user, session: null } - the user is created but can't sign
    // in until they click the email link. Surface that state instead of
    // pushing to /dashboard (where they'd just bounce back to /login).
    //
    // If "Confirm email" is OFF, signUp returns a session immediately and
    // we proceed straight to the destination, same as before.
    if (signUpData.session) {
      router.push(redirect ?? '/dashboard')
    } else {
      setCheckEmailFor(email)
    }
    } finally {
      setSubmitting(false)
    }
  }

  const inp: React.CSSProperties = {
    padding: '10px 12px', fontSize: '14px',
    background: '#1a1a1a', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#f5f2ee',
    fontFamily: 'Carlito, sans-serif',
    width: '100%', boxSizing: 'border-box',
  }

  return (
    <>
    <Script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      onLoad={mountTurnstile}
    />
    <main style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Carlito, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '2rem' }}>

        {checkEmailFor ? (
          // Post-signup state when Supabase "Confirm email" is enabled.
          // Account exists; user has to click the link in the email
          // before they can sign in.
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
                Check Your Email
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#f5f2ee', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              We sent a confirmation link to{' '}
              <strong style={{ color: '#f5f2ee' }}>{checkEmailFor}</strong>.
              Click the link in that email to finish creating your account.
            </div>
            <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Didn't get it? Check your spam folder. Still nothing after a
              few minutes - click below to resend.
            </div>
            <button
              type="button"
              onClick={async () => {
                const { error } = await supabase.auth.resend({
                  type: 'signup',
                  email: checkEmailFor,
                  options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback${redirect ? `?next=${encodeURIComponent(redirect)}` : ''}`,
                  },
                })
                if (error) alert(`Resend failed: ${error.message}`)
                else alert('Confirmation email resent.')
              }}
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Resend Confirmation Email
            </button>
            <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
              Wrong email?{' '}
              <button
                type="button"
                onClick={() => setCheckEmailFor(null)}
                style={{ color: '#f5f2ee', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', padding: 0 }}>
                Start over
              </button>
            </p>
          </>
        ) : (
        <>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            Create Account
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px' }}>
            Join the DistemperVerse
          </div>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Honeypot - visually off-screen, never filled by real users.
              Not display:none (bots detect that) - use position:absolute + clip. */}
          <input
            aria-hidden="true"
            tabIndex={-1}
            autoComplete="off"
            name="website"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
          />
          <input placeholder="Username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} style={inp} required />
          <input placeholder="Email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} required />
          <input placeholder="Password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={inp} required />

          {error && (
            <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting}
            style={{ marginTop: '4px', padding: '10px', background: submitting ? '#7a1f16' : '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.8 : 1 }}>
            {submitting ? 'Verifying...' : 'Sign Up'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
          Already have an account?{' '}
          <a href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'} style={{ color: '#f5f2ee', textDecoration: 'none' }}>Log in</a>
        </p>
        </>
        )}

      </div>
    </main>
    {/* Invisible Turnstile widget - rendered off-screen, executed on submit */}
    <div id="turnstile-container" style={{ position: 'absolute', left: '-9999px' }} />
    </>
  )
}