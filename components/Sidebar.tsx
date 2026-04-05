'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

export default function Sidebar() {
  const [username, setUsername] = useState('')
  const [userRole, setUserRole] = useState<'survivor' | 'thriver' | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('username, role').eq('id', user.id).single()
      if (!profile) return
      setUsername(profile.username)
      setUserRole((profile.role as string).toLowerCase() as 'survivor' | 'thriver')
      if (profile.role === 'thriver') {
        const { count } = await supabase.from('map_pins').select('*', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending')
        setPendingCount(count ?? 0)
      }
    }
    load()
  }, [])

  if (userRole === null) return null

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

      {/* User header */}
      <div style={{ padding: '16px 14px 8px', fontSize: '13px', color: '#f5f2ee', letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', borderBottom: '1px solid #2e2e2e', marginBottom: '8px' }}>
        {username}
        {userRole === 'thriver'
          ? <span style={{ marginLeft: '6px', background: '#c0392b', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '2px' }}>thriver</span>
          : <span style={{ marginLeft: '6px', background: '#2d5a1b', color: '#7fc458', fontSize: '10px', padding: '1px 5px', borderRadius: '2px' }}>Survivor</span>
        }
      </div>

{/* The Tapestry section */}
      <div style={sectionHeading}>The Tapestry</div>
      <a href="/welcome" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Welcome to the Tapestry</a>
<a href="/map" style={linkStyle('#c0392b')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>The World</a>
<a href="/campaigns" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>My Stories</a>
<a href="#" style={soonStyle}>The Campfire <span style={{ fontSize: '9px', color: '#cce0f5' }}>&mdash; soon</span></a>

      {/* Moderation � thrivers only */}
      {userRole === 'thriver' && (
        <a href="/moderate" style={{ ...linkStyle('#EF9F27'), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
          Moderation Queue
          {pendingCount > 0 && <span style={{ background: '#c0392b', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '3px' }}>{pendingCount}</span>}
        </a>
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
          {label} <span style={{ fontSize: '9px', color: '#cce0f5' }}>&mdash; soon</span>
        </a>
      ))}

    </div>
  )
}
