'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) { setError(loginError.message); return }
    router.push('/dashboard')
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto', fontFamily: 'monospace' }}>
      <h1>Log in</h1>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }} required />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }} required />
        <button type="submit" style={{ padding: '0.5rem', fontSize: '1rem', cursor: 'pointer' }}>
          Log in
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
      <p style={{ marginTop: '1rem' }}>No account? <a href="/signup">Sign up</a></p>
    </main>
  )
}