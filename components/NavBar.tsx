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
      display: 'flex', alignItems: 'center', gap: '12px',
      background: '#0f0f0f', borderBottom: '1px solid #c0392b',
      padding: '10px 16px', flexShrink: 0,
      fontFamily: 'Barlow Condensed, sans-serif',
    }}>
      <a href="/dashboard" style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee', textDecoration: 'none', flexShrink: 0 }}>
        The Tapestry
      </a>
      <span style={{ fontSize: '13px', color: '#b0aaa4', letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>
        DistemperVerse v1.0
      </span>

      {/* Center logos */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
        <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer">
          <img src="/XeroSumGamesLogoV13.png" alt="Xero Sum Games" style={{ height: '32px', objectFit: 'contain', opacity: 0.85 }} />
        </a>
        <a href="https://www.xerosumstudio.com" target="_blank" rel="noreferrer">
          <img src="/XeroSumStudioLogoV13.png" alt="Xero Sum Studio" style={{ height: '32px', objectFit: 'contain', opacity: 0.85 }} />
        </a>
      </div>

      <a href="/dashboard" style={navLink}>Dashboard</a>
      <a href="/characters" style={navLink}>Characters</a>
      <a href="/map" style={navLink}>The World</a>
      <a href="#" style={navLink}>The Campfire</a>
      {userRole === 'thriver' && (
        <a href="/moderate" style={{ ...navLink, borderColor: '#EF9F27', color: '#EF9F27' }}>Moderation</a>
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
