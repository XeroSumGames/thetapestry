'use client'
import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { logEvent } from '../../lib/events'

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
  // Honeypot — real users never see or fill this field (positioned off-screen).
  // Bots that auto-fill all inputs will populate it; we silently drop the request.
  const [honeypot, setHoneypot] = useState('')
  const widgetIdRef = useRef<string | null>(null)
  const tokenResolverRef = useRef<((t: string) => void) | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Capture `?redirect=/path` so an invite link that bounces a logged-out
  // user through signup ends at the original target, not `/firsttimers`.
  // Users invited to a specific campaign skip the generic welcome page.
  useEffect(() => { setRedirect(readSafeRedirect()) }, [])

  // Register the global Turnstile callback so the invisible widget can
  // hand the token back to the pending submit promise.
  useEffect(() => {
    (window as any).__turnstileCb = (token: string) => {
      tokenResolverRef.current?.(token)
      tokenResolverRef.current = null
    }
  }, [])

  function mountTurnstile() {
    const ts = (window as any).turnstile
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!ts || !sitekey || widgetIdRef.current) return
    widgetIdRef.current = ts.render('#turnstile-container', {
      sitekey,
      callback: '__turnstileCb',
      size: 'invisible',
    })
  }

  // Returns a promise that resolves with the Turnstile token.
  // If the widget isn't available (local dev without secret configured),
  // resolves immediately with an empty string so signup isn't blocked.
  function getToken(): Promise<string> {
    const ts = (window as any).turnstile
    if (!ts || !widgetIdRef.current) return Promise.resolve('')
    return new Promise(resolve => {
      tokenResolverRef.current = resolve
      ts.execute(widgetIdRef.current!)
    })
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Honeypot — if filled, it's a bot. Silently succeed to avoid tipping off scrapers.
    if (honeypot) { router.push(redirect ?? '/dashboard'); return }

    // Username sanity — block machine-generated random strings.
    if (looksRandom(username)) {
      setError('Username looks randomly generated — please choose a recognizable name.')
      return
    }

    // Turnstile — get an invisible challenge token and verify it server-side
    // before ever touching Supabase auth.
    // If the sitekey is configured but the widget never mounted (missing
    // NEXT_PUBLIC_TURNSTILE_SITE_KEY in Vercel env, ad blocker, slow CDN),
    // block instead of failing open.
    const sitekeyConfigured = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    const tsToken = await getToken()
    if (sitekeyConfigured && !tsToken) {
      setError('Security check failed to load - please refresh and try again.')
      return
    }
    if (tsToken) {
      const check = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tsToken }),
      })
      if (!check.ok) {
        const ts = (window as any).turnstile
        if (ts && widgetIdRef.current) ts.reset(widgetIdRef.current)
        setError('Bot check failed - please try again.')
        return
      }
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    })
    if (signUpError) {
      console.error('[Signup] auth error:', signUpError.message)
      setError(signUpError.message)
      return
    }
    // Create profile row if it doesn't already exist (trigger may handle this, but belt-and-suspenders)
    if (signUpData.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        username,
        email,
        role: 'Survivor',
        onboarded: false,
      }, { onConflict: 'id' })
      if (profileError) {
        console.error('[Signup] profile creation error:', profileError.message)
        setError(`Account created but profile setup failed: ${profileError.message}`)
        return
      }
    }
    logEvent('signup', { username })
    // Invite flow: land on the target path (e.g. /join/<code>) so the user
    // can accept the invite without losing context.
    // No redirect: go straight to /dashboard for now.
    // `/firsttimers` is DISABLED as a landing until the site is ready to
    // onboard new users (see tasks/todo.md Long-term / Post-launch). The
    // page still exists and is reachable if needed; we just don't force
    // new signups through it.
    router.push(redirect ?? '/dashboard')
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
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            Create Account
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px' }}>
            Join the DistemperVerse
          </div>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Honeypot — visually off-screen, never filled by real users.
              Not display:none (bots detect that) — use position:absolute + clip. */}
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

          <button type="submit"
            style={{ marginTop: '4px', padding: '10px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Sign Up
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
          Already have an account?{' '}
          <a href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'} style={{ color: '#d4cfc9', textDecoration: 'none' }}>Log in</a>
        </p>

      </div>
    </main>
    {/* Invisible Turnstile widget — rendered off-screen, executed on submit */}
    <div id="turnstile-container" style={{ position: 'absolute', left: '-9999px' }} />
    </>
  )
}