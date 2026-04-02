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

      {/* Character links */}
      {[
        { href: '/characters/new', label: 'Backstory Generation', accent: '#c0392b' },
        { href: '/characters', label: 'My Characters', accent: '#3a3a3a' },
      ].map(({ href, label, accent }) => (
        <a key={label} href={href} style={{ display: 'block', padding: '10px 14px', color: '#f5f2ee', textDecoration: 'none', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: `3px solid ${accent}`, marginBottom: '2px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {label}
        </a>
      ))}
      <a href="/characters/quick" style={{ display: 'block', padding: '10px 14px', color: '#f5f2ee', textDecoration: 'none', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid #3a3a3a', marginBottom: '2px' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        Quick Character
      </a>
      <a href="/characters/random" style={{ display: 'block', padding: '10px 14px', color: '#f5f2ee', textDecoration: 'none', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid #3a3a3a', marginBottom: '2px' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        Random Character
      </a>
      <a href="#" style={{ display: 'block', padding: '10px 14px', color: '#5a5550', textDecoration: 'none', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid transparent', marginBottom: '2px' }}>
        Paradigms <span style={{ fontSize: '9px', color: '#5a5550' }}>&mdash; soon</span>
      </a>

      <div style={{ height: '1px', background: '#2e2e2e', margin: '8px 0' }} />

      {/* Map */}
      <a href="/map" style={{ display: 'block', padding: '10px 14px', color: '#f5f2ee', textDecoration: 'none', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid #c0392b', marginBottom: '2px' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        World Map
      </a>

      {/* Moderation â€” thrivers only */}
      {userRole === 'thriver' && (
        <a href="/moderate" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', color: '#f5f2ee', textDecoration: 'none', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid #EF9F27', marginBottom: '2px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          Moderation Queue
          {pendingCount > 0 && <span style={{ background: '#c0392b', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '3px' }}>{pendingCount}</span>}
        </a>
      )}

      <a href="/welcome" style={{ display: 'block', padding: '10px 14px', color: '#b0aaa4', textDecoration: 'none', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid #3a3a3a', marginBottom: '2px' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        About The Tapestry
      </a>
      <div style={{ height: '1px', background: '#2e2e2e', margin: '8px 0' }} />

      {/* Coming soon */}
      {[
        { href: '#', label: 'Rules' },
        { href: '#', label: 'Equipment Catalog' },
        { href: '#', label: 'Forums' },
        { href: '#', label: 'Looking for Group' },
      ].map(({ href, label }) => (
        <a key={label} href={href} style={{ display: 'block', padding: '10px 14px', color: '#b0aaa4', textDecoration: 'none', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid transparent', marginBottom: '2px' }}>
          {label} <span style={{ fontSize: '9px', color: '#5a5550' }}>â€” soon</span>
        </a>
      ))}

    </div>
  )
}
