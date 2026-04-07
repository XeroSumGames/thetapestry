'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { logEvent } from '../../lib/events'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
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
    router.push('/firsttimers')
  }

  const inp: React.CSSProperties = {
    padding: '10px 12px', fontSize: '14px',
    background: '#1a1a1a', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#f5f2ee',
    fontFamily: 'Barlow, sans-serif',
    width: '100%', boxSizing: 'border-box',
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '2rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            Create Account
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px' }}>
            Join the DistemperVerse
          </div>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={inp} required />
          <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} required />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} required />

          {error && (
            <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px' }}>
              {error}
            </div>
          )}

          <button type="submit"
            style={{ marginTop: '4px', padding: '10px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Sign Up
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#d4cfc9', textDecoration: 'none' }}>Log in</a>
        </p>

      </div>
    </main>
  )
}