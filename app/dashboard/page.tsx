'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      if (profile) setUsername(profile.username)
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <main style={{ padding: '2rem', fontFamily: 'monospace' }}>Loading...</main>

  return (
    <main style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Welcome, {username}</h1>
      <p style={{ marginTop: '1rem', color: '#888' }}>The Tapestry dashboard — coming soon.</p>
      <button onClick={handleLogout}
        style={{ marginTop: '2rem', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1rem' }}>
        Log out
      </button>
    </main>
  )
}