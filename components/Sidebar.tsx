'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import NotificationBell from './NotificationBell'

export default function Sidebar() {
  const [username, setUsername] = useState('')
  const [userRole, setUserRole] = useState<'survivor' | 'thriver' | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoaded(true); return }
      const { data: profile } = await supabase.from('profiles').select('username, role').eq('id', user.id).single()
      if (!profile) { setLoaded(true); return }
      setUsername(profile.username)
      setUserRole((profile.role as string).toLowerCase() as 'survivor' | 'thriver')
      if (profile.role === 'thriver') {
        const { count } = await supabase.from('map_pins').select('*', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending')
        setPendingCount(count ?? 0)
      }
      setLoaded(true)
    }
    load()
  }, [])

  if (!loaded) return null
  const isGuest = !username

  const linkStyle = (accent: string) => ({
    display: 'block' as const, padding: '10px 14px', color: '#f5f2ee',
    textDecoration: 'none', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase' as const,
    borderLeft: `3px solid ${accent}`, marginBottom: '2px',
  })

  const soonStyle = {
    display: 'block' as const, padding: '10px 14px', color: '#cce0f5',
    textDecoration: 'none', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase' as const,
    borderLeft: '3px solid transparent', marginBottom: '2px',
  }

  const sectionHeading = {
    padding: '10px 14px 6px', fontSize: '15px', color: '#f5f2ee',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em',
    textTransform: 'uppercase' as const, fontWeight: 700,
  }

  const divider = <div style={{ height: '1px', background: '#2e2e2e', margin: '8px 0' }} />

  function hover(e: React.MouseEvent<HTMLAnchorElement>, on: boolean) {
    e.currentTarget.style.background = on ? '#242424' : 'transparent'
  }

  return (
    <div style={{ width: '220px', flexShrink: 0, background: '#1a1a1a', borderRight: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {/* Branding */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #c0392b', textAlign: 'center' }}>
        <a href="/dashboard" style={{ textDecoration: 'none' }}>
          <img src="/DistemperLogoRedv5.png" alt="Distemper" style={{ height: '28px', objectFit: 'contain', marginBottom: '4px' }} />
          <div style={{ fontFamily: 'Distemper, sans-serif', fontSize: '18px', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1 }}>The Tapestry</div>
        </a>
        <div style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: '2px' }}>DistemperVerse v1.0</div>
      </div>

      {/* User header */}
      <div style={{ padding: '10px 14px 8px', fontSize: '13px', color: '#f5f2ee', letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', borderBottom: '1px solid #2e2e2e', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
        {isGuest ? (
          <span style={{ flex: 1, color: '#7fc458' }}>Ghost <span style={{ fontSize: '13px', color: '#7fc458' }}>— You Don&apos;t Exist</span></span>
        ) : (
          <>
            <span style={{ flex: 1 }}>
              {username}
              {userRole === 'thriver'
                ? <span style={{ marginLeft: '6px', background: '#c0392b', color: '#fff', fontSize: '13px', padding: '1px 5px', borderRadius: '2px' }}>thriver</span>
                : <span style={{ marginLeft: '6px', background: '#2d5a1b', color: '#7fc458', fontSize: '13px', padding: '1px 5px', borderRadius: '2px' }}>Survivor</span>
              }
            </span>
            <NotificationBell />
          </>
        )}
      </div>

{/* The Tapestry section */}
      <div style={sectionHeading}>The Tapestry</div>
      <a href="/welcome" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Welcome to the Tapestry</a>
<a href="/map" target="_blank" rel="noreferrer" style={linkStyle('#c0392b')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>The World</a>
<a href="/campaigns" target="_blank" rel="noreferrer" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>My Stories</a>
<a href="#" style={soonStyle}>The Campfire <span style={{ fontSize: '9px', color: '#cce0f5' }}>&mdash; soon</span></a>

      {divider}

      {/* Thriver tools */}
      {userRole === 'thriver' && (
        <>
          <a href="/moderate" style={{ ...linkStyle('#EF9F27'), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
            Moderation Queue
            {pendingCount > 0 && <span style={{ background: '#c0392b', color: '#fff', fontSize: '13px', padding: '1px 6px', borderRadius: '3px' }}>{pendingCount}</span>}
          </a>
          <a href="/logging" style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Logs</a>
        </>
      )}

      {divider}

      {/* Survivors section */}
      <div style={sectionHeading}>Survivors</div>
      <a href="/creating-a-character" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Creating a Survivor</a>
      <a href="/characters" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>My Survivors</a>
      <a href="/characters/new" style={linkStyle('#c0392b')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Backstory Generation</a>
      <a href="/characters/quick" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Quick Character</a>
      <a href="/characters/random" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Random Character</a>
      <a href="#" style={soonStyle}>Paradigms <span style={{ fontSize: '9px', color: '#cce0f5' }}>&mdash; soon</span></a>

      {divider}

      {/* Coming soon */}
      {[
        { href: '#', label: 'Rules' },
        { href: '#', label: 'Equipment Catalog' },
        { href: '#', label: 'Forums' },
        { href: '#', label: 'Looking for Group' },
      ].map(({ href, label }) => (
        <a key={label} href={href} style={soonStyle}>
          {label} <span style={{ fontSize: '13px', color: '#cce0f5' }}>&mdash; soon</span>
        </a>
      ))}

      {/* Spacer + bottom section */}
      <div style={{ flex: 1 }} />

      <div style={{ padding: '8px 14px', borderTop: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isGuest ? (
          <>
            <a href="/signup" style={{ display: 'block', width: '100%', padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
              Create Account
            </a>
            <a href="/login" style={{ display: 'block', width: '100%', padding: '8px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
              Sign In
            </a>
          </>
        ) : (
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ width: '100%', padding: '8px', background: 'none', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Log Out
          </button>
        )}
      </div>

      <div style={{ padding: '8px 14px 12px', textAlign: 'center' }}>
        <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer">
          <img src="/XeroSumGamesLogoV13.png" alt="Xero Sum Games" style={{ height: '18px', objectFit: 'contain', opacity: 0.6 }} />
        </a>
      </div>

    </div>
  )
}
