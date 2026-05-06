'use client'
import { useEffect, useState } from 'react'
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
  const router = useRouter()
  const supabase = createClient()

  // Capture `?redirect=/path` from the URL on mount so the invite/deep-link
  // target survives the login round-trip. Rendering is null on first render
  // (matches SSR) and populated after mount; no hydration mismatch.
  useEffect(() => { setRedirect(readSafeRedirect()) }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) { console.error('[Login] auth error:', loginError.message); setError(loginError.message); return }
    logEvent('login')
    logFirstEvent('first_login')
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

          <button type="submit"
            style={{ marginTop: '4px', padding: '10px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Log In
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
          No account?{' '}
          <a href={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup'} style={{ color: '#d4cfc9', textDecoration: 'none' }}>Sign up</a>
        </p>

      </div>
    </main>
  )
}