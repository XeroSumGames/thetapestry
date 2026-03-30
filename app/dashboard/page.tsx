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
       <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <a href="/map" style={{ padding: '12px 20px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', color: '#f5f2ee', textDecoration: 'none', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          The Tapestry — World Map →
        </a>
        <a href="/characters" style={{ padding: '12px 20px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #3a3a3a', borderRadius: '4px', color: '#f5f2ee', textDecoration: 'none', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          My Characters →
        </a>
        <a href="/characters/new" style={{ padding: '12px 20px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #2d5a1b', borderRadius: '4px', color: '#f5f2ee', textDecoration: 'none', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          Create New Character →
        </a>
      </div>
      <button onClick={handleLogout}
        style={{ marginTop: '2rem', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1rem' }}>
        Log out
      </button>
    </main>
  )
}