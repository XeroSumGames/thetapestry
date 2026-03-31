'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

interface Pin {
  id: string
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: string
  status: string
  user_id: string
  created_at: string
  profiles?: { username: string }
}

export default function ModerationPage() {
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [acting, setActing] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      load()
    }
    check()
  }, [filter])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('map_pins')
      .select('*, profiles(username)')
      .eq('pin_type', 'rumor')
      .eq('status', filter)
      .order('created_at', { ascending: false })
    setPins(data ?? [])
    setLoading(false)
  }

  async function handleAction(id: string, action: 'approved' | 'rejected') {
    setActing(id)
    await supabase.from('map_pins').update({ status: action }).eq('id', id)
    setPins(prev => prev.filter(p => p.id !== id))
    setActing(null)
  }

  async function handleDelete(id: string) {
    setActing(id)
    await supabase.from('map_pins').delete().eq('id', id)
    setPins(prev => prev.filter(p => p.id !== id))
    setActing(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Moderation
        </div>
        <div style={{ fontSize: '11px', color: '#b0aaa4', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Rumor Queue
        </div>
        <div style={{ flex: 1 }} />
        <a href="/map" style={navLink}>Map</a>
        <a href="/dashboard" style={navLink}>Dashboard</a>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
        {(['pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '7px 16px', border: `1px solid ${filter === f ? '#c0392b' : '#3a3a3a'}`,
              background: filter === f ? '#2a1210' : '#242424',
              color: filter === f ? '#f5a89a' : '#b0aaa4',
              borderRadius: '3px', cursor: 'pointer',
              fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && <div style={{ color: '#b0aaa4', fontSize: '13px' }}>Loading...</div>}

      {!loading && pins.length === 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center', fontSize: '13px', color: '#5a5550' }}>
          No {filter} rumors.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {pins.map(p => (
          <div key={p.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #EF9F27', borderRadius: '4px', padding: '1rem 1.25rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: '10px', color: '#5a5550', marginTop: '2px' }}>
                  Submitted by {p.profiles?.username ?? 'unknown'} · {formatDate(p.created_at)}
                </div>
              </div>
              <div style={{ fontSize: '10px', color: '#b0aaa4', fontFamily: 'monospace' }}>
                {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
              </div>
            </div>

            {/* Notes */}
            {p.notes && (
              <div style={{ fontSize: '13px', color: '#b0aaa4', lineHeight: 1.6, marginBottom: '10px', padding: '8px 10px', background: '#242424', borderRadius: '3px', borderLeft: '2px solid #3a3a3a' }}>
                {p.notes}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {filter === 'pending' && (
                <>
                  <button onClick={() => handleAction(p.id, 'approved')} disabled={acting === p.id}
                    style={actionBtn('#2d5a1b', '#7fc458')}>
                    Approve
                  </button>
                  <button onClick={() => handleAction(p.id, 'rejected')} disabled={acting === p.id}
                    style={actionBtn('#7a1f16', '#f5a89a')}>
                    Reject
                  </button>
                </>
              )}
              {filter === 'approved' && (
                <button onClick={() => handleAction(p.id, 'rejected')} disabled={acting === p.id}
                  style={actionBtn('#7a1f16', '#f5a89a')}>
                  Revoke
                </button>
              )}
              {filter === 'rejected' && (
                <button onClick={() => handleAction(p.id, 'approved')} disabled={acting === p.id}
                  style={actionBtn('#2d5a1b', '#7fc458')}>
                  Approve
                </button>
              )}
              <button onClick={() => handleDelete(p.id)} disabled={acting === p.id}
                style={actionBtn('#2e2e2e', '#5a5550')}>
                Delete
              </button>
              <a href={`https://www.openstreetmap.org/#map=15/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer"
                style={{ ...actionBtn('#1a3a5c', '#7ab3d4'), textDecoration: 'none', display: 'inline-block' }}>
                View on map
              </a>
            </div>

          </div>
        ))}
      </div>

    </div>
  )
}

function actionBtn(borderColor: string, color: string): React.CSSProperties {
  return {
    padding: '6px 14px', background: 'none',
    border: `1px solid ${borderColor}`,
    borderRadius: '3px', color, fontSize: '11px',
    cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase',
  }
}

const navLink: React.CSSProperties = {
  padding: '5px 12px', background: '#242424',
  border: '1px solid #3a3a3a', borderRadius: '3px',
  color: '#f5f2ee', fontSize: '11px',
  fontFamily: 'Barlow Condensed, sans-serif',
  letterSpacing: '.06em', textTransform: 'uppercase',
  textDecoration: 'none',
}