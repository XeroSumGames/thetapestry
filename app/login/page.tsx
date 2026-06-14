'use client'
import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { logEvent, logFirstEvent } from '../../lib/events'

// Safe-redirect guard: only accept single-slash relative paths so we don't
// become an open-redirect vector. Rejects `//example.com`, `http://...`,
// null/empty, and anything else.
function readSafeRedirect(): string | null {
  if (typeof window === 'undefined') return null
  const target = new URLSearchParams(window.location.search).get('redirect')
  if (!target || !target.startsWith('/') || target.startsWith('//')) return null
  return target
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [redirect, setRedirect] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // When sign-in fails because the account hasn't confirmed its email,
  // we surface a Resend button. Storing the email on the dedicated state
  // (separate from `error`) lets the inline button know which address to
  // resend to without re-reading the form.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [showResend, setShowResend] = useState(false)
  // Turnstile state mirrors /signup. The widget is mounted invisibly off-
  // screen; a token is auto-solved on page load and cached. We read the
  // cached token on submit (calling execute() conflicts with Managed mode
  // and hangs).
  const widgetIdRef = useRef<string | null>(null)
  const cachedTokenRef = useRef<string | null>(null)
  const widgetErroredRef = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  // Capture `?redirect=/path` from the URL on mount so the invite/deep-link
  // target survives the login round-trip. Rendering is null on first render
  // (matches SSR) and populated after mount; no hydration mismatch.
  useEffect(() => { setRedirect(readSafeRedirect()) }, [])

  // Surface ?error=... from /auth/callback. Code-exchange failures land
  // back here with a hint about what went wrong instead of silently
  // bouncing back to the form.
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error')
    if (err === 'missing_code') { setError('Confirmation link was incomplete.'); setShowResend(true) }
    else if (err === 'callback_failed') setError('Confirmation link expired or was already used. Sign in normally if your account is confirmed.')
  }, [])

  function mountTurnstile() {
    const ts = (window as any).turnstile
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!ts || !sitekey || widgetIdRef.current) return
    widgetIdRef.current = ts.render('#turnstile-container-login', {
      sitekey,
      callback: (token: string) => { cachedTokenRef.current = token; widgetErroredRef.current = false },
      'expired-callback': () => { cachedTokenRef.current = null },
      'error-callback': () => { cachedTokenRef.current = null; widgetErroredRef.current = true },
    })
  }

  // Returns the cached token (widget already solved on page load).
  // Resets + re-solves if expired, with an 8s timeout. Returns null if
  // the widget isn't mounted (env var missing, script blocked).
  function getToken(): Promise<string | null> {
    const ts = (window as any).turnstile
    if (!ts || !widgetIdRef.current) return Promise.resolve(null)
    const existing = cachedTokenRef.current
    if (existing) return Promise.resolve(existing)
    return new Promise(resolve => {
      const tid = setTimeout(() => resolve(null), 8000)
      const orig = (window as any).__turnstileLoginCb
      ;(window as any).__turnstileLoginCb = (token: string) => {
        clearTimeout(tid)
        cachedTokenRef.current = token
        ;(window as any).__turnstileLoginCb = orig
        resolve(token)
      }
      ts.reset(widgetIdRef.current!)
    })
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      // Turnstile (soft gate). When the widget produces a token we verify
      // server-side and hard-block on rejection. When it doesn't (ad
      // blocker, blocked CDN, fast submit before mount) we fall through.
      // captchaToken is still forwarded to signInWithPassword below so a
      // future Supabase dashboard toggle can tighten server-side without
      // forcing every ad-blocker user to disable. Hard-fail variant lives
      // in git history (5dfd9d5/e751d6e) if spam volume requires it.
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

      // Forwarded to Supabase's server-side CAPTCHA verifier when Bot
      // and Abuse Protection is enabled in the dashboard. Omitted when
      // siteKey isn't configured (dev mode) so local login still works.
      const { error: loginError } = await supabase.auth.signInWithPassword(
        tsToken
          ? { email, password, options: { captchaToken: tsToken } }
          : { email, password }
      )
      if (loginError) {
        console.error('[Login] auth error:', loginError.message)
        // Reset the token - Turnstile tokens are single-use, so a failed
        // login (wrong password) used the token. Force a fresh challenge
        // for the next attempt.
        cachedTokenRef.current = null
        if (widgetIdRef.current && (window as any).turnstile) {
          (window as any).turnstile.reset(widgetIdRef.current)
        }
        // Supabase returns "Email not confirmed" verbatim when the user
        // exists but hasn't clicked the confirmation link. Surface a
        // friendlier copy + offer Resend instead of dumping the raw
        // error string.
        const isUnconfirmed = /email\s*not\s*confirmed/i.test(loginError.message)
        if (isUnconfirmed) {
          setUnconfirmedEmail(email)
          setError('')
        } else {
          setUnconfirmedEmail(null)
          setError(loginError.message)
        }
        return
      }
      logEvent('login')
      logFirstEvent('first_login')
      router.push(redirect ?? '/dashboard')
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

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/distemper-dogsign-logo.png" alt="Distemper" style={{ width: '100px', height: '100px', objectFit: 'contain', marginBottom: '1.5rem' }} />
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            The Tapestry
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px' }}>
            Sign in to continue
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input placeholder="Email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} required />
          <input placeholder="Password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={inp} required />

          {error && (
            <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px' }}>
              {error}
            </div>
          )}

          {showResend && !unconfirmedEmail && (
            <div style={{ fontSize: '13px', color: '#cce0f5', padding: '10px 12px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', lineHeight: 1.5 }}>
              <div style={{ marginBottom: '8px' }}>
                Enter your email above then click below to get a fresh confirmation link.
              </div>
              <button
                type="button"
                disabled={!email}
                onClick={async () => {
                  const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email,
                    options: {
                      emailRedirectTo: `${window.location.origin}/auth/callback${redirect ? `?next=${encodeURIComponent(redirect)}` : ''}`,
                    },
                  })
                  if (error) alert(`Resend failed: ${error.message}`)
                  else { alert('Confirmation email resent - check your inbox.'); setShowResend(false); setError('') }
                }}
                style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #5a4a1b', borderRadius: '3px', color: email ? '#EF9F27' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: email ? 'pointer' : 'default' }}>
                Resend Confirmation Email
              </button>
            </div>
          )}

          {unconfirmedEmail && (
            <div style={{ fontSize: '13px', color: '#cce0f5', padding: '10px 12px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', lineHeight: 1.5 }}>
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: '#EF9F27' }}>Email not confirmed yet.</strong>
                {' '}Check the inbox for{' '}
                <strong style={{ color: '#f5f2ee' }}>{unconfirmedEmail}</strong>{' '}
                and click the confirmation link before signing in.
              </div>
              <button
                type="button"
                onClick={async () => {
                  const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email: unconfirmedEmail,
                    options: {
                      emailRedirectTo: `${window.location.origin}/auth/callback${redirect ? `?next=${encodeURIComponent(redirect)}` : ''}`,
                    },
                  })
                  if (error) alert(`Resend failed: ${error.message}`)
                  else alert('Confirmation email resent.')
                }}
                style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Resend Confirmation Email
              </button>
            </div>
          )}

          <button type="submit" disabled={submitting}
            style={{ marginTop: '4px', padding: '10px', background: submitting ? '#7a1f16' : '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.8 : 1 }}>
            {submitting ? 'Verifying...' : 'Log In'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
          No account?{' '}
          <a href={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup'} style={{ color: '#d4cfc9', textDecoration: 'none' }}>Sign up</a>
        </p>

      </div>
    </main>
    {/* Invisible Turnstile widget - rendered off-screen, executed on submit */}
    <div id="turnstile-container-login" style={{ position: 'absolute', left: '-9999px' }} />
    </>
  )
}
