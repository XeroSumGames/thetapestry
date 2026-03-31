'use client'
import { createClient } from '../lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function NavBar() {
  const router = useRouter()
  const supabase = createClient()

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
      <a href="/dashboard" style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee', textDecoration: 'none' }}>
        The Tapestry
      </a>
      <span style={{ fontSize: '11px', color: '#b0aaa4', letterSpacing: '.08em', textTransform: 'uppercase' }}>
        DistemperVerse v1.0
      </span>
      <div style={{ flex: 1 }} />
      <a href="/map" style={navLink}>Map</a>
      <a href="/characters" style={navLink}>Characters</a>
      <a href="#" style={navLink}>The Campfire</a>
      <a href="/dashboard" style={navLink}>Dashboard</a>
      <button onClick={handleLogout} style={{ ...navLink, border: '1px solid #c0392b', color: '#f5a89a', cursor: 'pointer', background: '#242424' }}>
        Log Out
      </button>
    </nav>
  )
}

const navLink: React.CSSProperties = {
  padding: '5px 12px', background: '#242424',
  border: '1px solid #3a3a3a', borderRadius: '3px',
  color: '#f5f2ee', fontSize: '11px',
  letterSpacing: '.06em', textTransform: 'uppercase',
  textDecoration: 'none', fontFamily: 'Barlow Condensed, sans-serif',
}