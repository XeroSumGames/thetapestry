'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { useRouter } from 'next/navigation'
export default function NavBar() {
  const [userRole, setUserRole] = useState<'survivor' | 'thriver' | null>(null)
  const router = useRouter()
  const supabase = createClient()
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile) setUserRole((profile.role as string).toLowerCase() as 'survivor' | 'thriver')
    }
    load()
  }, [])
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }
  return (
    <nav style={{
      display: 'flex', alignItems: 'flex-end', gap: '12px',
      background: '#0f0f0f', borderBottom: '1px solid #c0392b',
      padding: '10px 16px', flexShrink: 0,
      fontFamily: 'Barlow Condensed, sans-serif',
    }}>
      {/* Logo + title grouped together */}
      <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer" style={{ flexShrink: 0, paddingBottom: '4px' }}>
        <img src="/XeroSumGamesLogoV13.png" alt="Xero Sum Games" style={{ height: '24px', objectFit: 'contain', opacity: 0.85, display: 'block' }} />
      </a>
      <a href="/dashboard" style={{ fontSize: '28px', fontFamily: 'Distemper, sans-serif', textTransform: 'uppercase', color: '#f5f2ee', textDecoration: 'none', flexShrink: 0, lineHeight: 0.85, marginLeft: '24px' }}>
  The Tapestry
</a>
      <span style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0, marginLeft: '8px' }}>
        DistemperVerse v1.0
      </span>
      <div style={{ flex: 1 }} />
      <a href="/dashboard" style={navLink}>Dashboard</a>
      <a href="/characters" style={navLink}>Characters</a>
      <a href="/map" style={navLink}>The World</a>
      <a href="#" style={navLink}>The Campfire</a>
      {userRole === 'thriver' && (
        <>
          <a href="/admin/dashboard" style={{ ...navLink, borderColor: '#EF9F27', color: '#EF9F27' }}>Dashboard</a>
          <a href="/moderate" style={{ ...navLink, borderColor: '#EF9F27', color: '#EF9F27' }}>Moderation</a>
          <a href="/logging" style={{ ...navLink, borderColor: '#EF9F27', color: '#EF9F27' }}>Logs</a>
        </>
      )}
      <button onClick={handleLogout} style={{ ...navLink, border: '1px solid #c0392b', color: '#f5a89a', cursor: 'pointer', background: '#242424' }}>
        Log Out
      </button>
    </nav>
  )
}
const navLink: React.CSSProperties = {
  padding: '6px 14px', background: '#242424',
  border: '1px solid #3a3a3a', borderRadius: '3px',
  color: '#f5f2ee', fontSize: '13px',
  letterSpacing: '.06em', textTransform: 'uppercase',
  textDecoration: 'none', fontFamily: 'Barlow Condensed, sans-serif',
}
