'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

async function handleSignup(e: React.FormEvent) {
  e.preventDefault()
  setError('')
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  })
  if (signUpError) { setError(signUpError.message); return }
  router.push('/welcome')
}

  return (
    <main style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto', fontFamily: 'monospace' }}>
      <h1>Create account</h1>
      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }} required />
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }} required />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }} required />
        <button type="submit" style={{ padding: '0.5rem', fontSize: '1rem', cursor: 'pointer' }}>
          Sign up
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}
      </form>
      <p style={{ marginTop: '1rem' }}>Already have an account? <a href="/login">Log in</a></p>
    </main>
  )
}