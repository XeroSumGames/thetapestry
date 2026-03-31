'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('../../components/MapView'), { ssr: false })

interface Pin {
  id: string
  title: string
  notes: string
  lat: number
  lng: number
  status: string
  pin_type: string
  created_at: string
  profiles?: { username: string }
}

export default function DashboardPage() {
  const [username, setUsername] = useState('')
  const [userRole, setUserRole] = useState<'survivor' | 'thriver'>('survivor')
  const [loading, setLoading] = useState(true)
  const [pendingPins, setPendingPins] = useState<Pin[]>([])
  const [acting, setActing] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('username, role').eq('id', user.id).single()
      if (profile) {
        setUsername(profile.username)
        setUserRole(profile.role as 'survivor' | 'thriver')
        if (profile.role === 'thriver') {
          const { data: rumors } = await supabase
            .from('map_pins')
            .select('*, profiles(username)')
            .eq('pin_type', 'rumor')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
          setPendingPins(rumors ?? [])
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleAction(id: string, action: 'approved' | 'rejected') {
    setActing(id)
    await supabase.from('map_pins').update({ status: action }).eq('id', id)
    setPendingPins(prev => prev.filter(p => p.id !== id))
    setActing(null)
  }

  if (loading) return (
    <div style={{ flex: 1, background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* Left panel */}
      <div style={{ width: '220px', flexShrink: 0, background: '#1a1a1a', borderRight: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '16px 14px 8px', fontSize: '9px', color: '#5a5550', letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', borderBottom: '1px solid #2e2e2e', marginBottom: '8px' }}>
          Welcome, {username}
          {userRole === 'thriver' && <span style={{ marginLeft: '6px', background: '#c0392b', color: '#fff', fontSize: '8px', padding: '1px 5px', borderRadius: '2px' }}>Thriver</span>}
        </div>

        {[
          { href: '/characters/new', label: 'Backstory Generation', accent: '#c0392b' },
          { href: '/characters', label: 'My Characters', accent: '#3a3a3a' },
        ].map(({ href, label, accent }) => (
          <a key={label} href={href} style={{ display: 'block', padding: '10px 14px', color: '#f5f2ee', textDecoration: 'none', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: `3px solid ${accent}`, marginBottom: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {label}
          </a>
        ))}

        <div style={{ height: '1px', background: '#2e2e2e', margin: '8px 0' }} />

        <a href="/map" style={{ display: 'block', padding: '10px 14px', color: '#f5f2ee', textDecoration: 'none', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid #c0392b', marginBottom: '2px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          World Map
        </a>

        {userRole === 'thriver' && (
          <a href="/moderate" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', color: '#f5f2ee', textDecoration: 'none', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid #EF9F27', marginBottom: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Moderation Queue
            {pendingPins.length > 0 && <span style={{ background: '#c0392b', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '3px' }}>{pendingPins.length}</span>}
          </a>
        )}

        <div style={{ height: '1px', background: '#2e2e2e', margin: '8px 0' }} />

        {[
          { href: '#', label: 'Rules' },
          { href: '#', label: 'Equipment Catalog' },
          { href: '#', label: 'Forums' },
          { href: '#', label: 'Looking for Group' },
        ].map(({ href, label }) => (
          <a key={label} href={href} style={{ display: 'block', padding: '10px 14px', color: '#5a5550', textDecoration: 'none', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', borderLeft: '3px solid transparent', marginBottom: '2px' }}>
            {label} <span style={{ fontSize: '9px', color: '#3a3a3a' }}>— soon</span>
          </a>
        ))}
      </div>

      {/* Center — map */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <MapView embedded />
      </div>

      {/* Right panel — Thrivers only */}
      {userRole === 'thriver' && (
        <div style={{ width: '280px', flexShrink: 0, background: '#1a1a1a', borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #2e2e2e', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', fontWeight: 600, color: '#EF9F27', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Rumor Queue {pendingPins.length > 0 && <span style={{ background: '#c0392b', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '3px', marginLeft: '6px' }}>{pendingPins.length}</span>}
          </div>

          {pendingPins.length === 0 && (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '12px', color: '#5a5550' }}>
              No pending rumors.
            </div>
          )}

          <div style={{ padding: '8px' }}>
            {pendingPins.map(p => (
              <div key={p.id} style={{ background: '#242424', border: '1px solid #2e2e2e', borderLeft: '3px solid #EF9F27', borderRadius: '3px', padding: '10px', marginBottom: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', marginBottom: '2px' }}>{p.title}</div>
                <div style={{ fontSize: '10px', color: '#5a5550', marginBottom: '6px' }}>
                  {p.profiles?.username ?? 'unknown'} · {p.lat.toFixed(3)}, {p.lng.toFixed(3)}
                </div>
                {p.notes && <div style={{ fontSize: '11px', color: '#b0aaa4', marginBottom: '8px', lineHeight: 1.5 }}>{p.notes}</div>}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => handleAction(p.id, 'approved')} disabled={acting === p.id}
                    style={{ flex: 1, padding: '5px', background: 'none', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '10px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    Approve
                  </button>
                  <button onClick={() => handleAction(p.id, 'rejected')} disabled={acting === p.id}
                    style={{ flex: 1, padding: '5px', background: 'none', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '10px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 14px', borderTop: '1px solid #2e2e2e', borderBottom: '1px solid #2e2e2e', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', fontWeight: 600, color: '#b0aaa4', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 'auto' }}>
            The Campfire
          </div>
          <div style={{ padding: '1rem', fontSize: '12px', color: '#5a5550', lineHeight: 1.6 }}>
            Forums, session announcements, and community news coming soon.
          </div>
        </div>
      )}

    </div>
  )
}