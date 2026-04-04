'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

interface Pin {
  id: string
  user_id: string
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: string
  status: string
  created_at: string
  profiles?: { username: string }
  attachments?: string[]
}

interface Profile {
  id: string
  username: string
  role: string
  created_at: string
  suspended: boolean
}

export default function ModerationPage() {
  const [section, setSection] = useState<'rumors' | 'users'>('rumors')
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [acting, setActing] = useState<string | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
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

  useEffect(() => {
    if (section === 'users') loadUsers()
  }, [section])

  async function load() {
    setLoading(true)
    const { data: rawData } = await supabase
      .from('map_pins')
      .select('*, profiles!map_pins_user_id_fkey(username)')
      .eq('pin_type', 'rumor')
      .eq('status', filter)
      .order('created_at', { ascending: false })

    const withAttachments = await Promise.all((rawData ?? []).map(async (pin: any) => {
      const { data: files } = await supabase.storage
        .from('pin-attachments')
        .list(`${pin.user_id}/${pin.id}`)
      return { ...pin, attachments: files?.map((f: any) => f.name) ?? [] }
    }))
    setPins(withAttachments)
    setLoading(false)
  }

  async function loadUsers() {
    setUsersLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setUsersLoading(false)
  }

  async function handleRoleChange(id: string, newRole: 'Survivor' | 'Thriver') {
    setActing(id)
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u))
    setActing(null)
  }
async function handleSuspend(id: string, suspended: boolean) {
    setActing(id)
    await supabase.from('profiles').update({ suspended }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, suspended } : u))
    setActing(null)
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Permanently delete this account? This cannot be undone.')) return
    setActing(id)
    await supabase.from('profiles').delete().eq('id', id)
    setUsers(prev => prev.filter(u => u.id !== id))
    setActing(null)
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
          Thriver Console
        </div>
        <div style={{ flex: 1 }} />
        <a href="/map" style={navLink}>Map</a>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
        {(['rumors', 'users'] as const).map(s => (
          <button key={s} onClick={() => setSection(s)}
            style={{
              padding: '7px 16px', border: `1px solid ${section === s ? '#c0392b' : '#3a3a3a'}`,
              background: section === s ? '#2a1210' : '#242424',
              color: section === s ? '#f5a89a' : '#b0aaa4',
              borderRadius: '3px', cursor: 'pointer',
              fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>
            {s === 'rumors' ? 'Rumor Queue' : 'Users'}
          </button>
        ))}
      </div>

      {/* RUMORS SECTION */}
      {section === 'rumors' && (
        <>
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

          {loading && <div style={{ color: '#b0aaa4', fontSize: '13px' }}>Loading...</div>}

          {!loading && pins.length === 0 && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center', fontSize: '13px', color: '#5a5550' }}>
              No {filter} rumors.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pins.map(p => (
              <div key={p.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #EF9F27', borderRadius: '4px', padding: '1rem 1.25rem' }}>
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
                {p.notes && (
                  <div style={{ fontSize: '13px', color: '#b0aaa4', lineHeight: 1.6, marginBottom: '8px', padding: '8px 10px', background: '#242424', borderRadius: '3px', borderLeft: '2px solid #3a3a3a' }}>
                    {p.notes}
                  </div>
                )}
                {p.attachments && p.attachments.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    {p.attachments.map((name: string) => (
                      <div key={name} style={{ fontSize: '12px', color: '#7ab3d4', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                        <span style={{ opacity: 0.7 }}>📎</span>
                        <span>Uploaded file: {name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {filter === 'pending' && (
                    <>
                      <button onClick={() => handleAction(p.id, 'approved')} disabled={acting === p.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                      <button onClick={() => handleAction(p.id, 'rejected')} disabled={acting === p.id} style={actionBtn('#7a1f16', '#f5a89a')}>Reject</button>
                    </>
                  )}
                  {filter === 'approved' && (
                    <button onClick={() => handleAction(p.id, 'rejected')} disabled={acting === p.id} style={actionBtn('#7a1f16', '#f5a89a')}>Revoke</button>
                  )}
                  {filter === 'rejected' && (
                    <button onClick={() => handleAction(p.id, 'approved')} disabled={acting === p.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                  )}
                  <button onClick={() => handleDelete(p.id)} disabled={acting === p.id} style={actionBtn('#2e2e2e', '#5a5550')}>Delete</button>
                  <a href={`https://www.openstreetmap.org/#map=15/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer"
                    style={{ ...actionBtn('#1a3a5c', '#7ab3d4'), textDecoration: 'none', display: 'inline-block' }}>
                    View on map
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* USERS SECTION */}
      {section === 'users' && (
        <>
          <div style={{ fontSize: '12px', color: '#5a5550', marginBottom: '1rem', letterSpacing: '.04em' }}>
            {users.length} registered user{users.length !== 1 ? 's' : ''}
          </div>

          {usersLoading && <div style={{ color: '#b0aaa4', fontSize: '13px' }}>Loading...</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {users.map(u => (
              <div key={u.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${u.role === 'Thriver' ? '#c0392b' : '#3a3a3a'}`, borderRadius: '4px', padding: '10px 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em' }}>
  {u.username}
</div>
<div style={{ fontSize: '10px', color: '#5a5550', marginTop: '2px' }}>
  {(u as any).email && <span style={{ color: '#b0aaa4', marginRight: '8px' }}>{(u as any).email}</span>}
  Joined {formatDate(u.created_at)}
</div>
                </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {u.suspended && (
                    <span style={{ fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px', background: '#2a1a00', color: '#EF9F27', border: '1px solid #EF9F27' }}>
                      Suspended
                    </span>
                  )}
                  <span style={{
                    fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em',
                    textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px',
                    background: u.role === 'Thriver' ? '#2a1210' : '#1a1a2e',
                    color: u.role === 'Thriver' ? '#f5a89a' : '#7ab3d4',
                    border: `1px solid ${u.role === 'Thriver' ? '#c0392b' : '#2e2e5a'}`,
                  }}>
                    {u.role}
                  </span>
                  {u.role === 'Thriver' ? (
                    <button onClick={() => handleRoleChange(u.id, 'Survivor')} disabled={acting === u.id}
                      style={actionBtn('#3a3a3a', '#b0aaa4')}>
                      Make Survivor
                    </button>
                  ) : (
                    <button onClick={() => handleRoleChange(u.id, 'Thriver')} disabled={acting === u.id}
                      style={actionBtn('#c0392b', '#f5a89a')}>
                      Make Thriver
                    </button>
                  )}
                  <button onClick={() => handleSuspend(u.id, !u.suspended)} disabled={acting === u.id}
                    style={actionBtn(u.suspended ? '#2d5a1b' : '#5a3a00', u.suspended ? '#7fc458' : '#EF9F27')}>
                    {u.suspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                  <button onClick={() => handleDeleteUser(u.id)} disabled={acting === u.id}
                    style={actionBtn('#7a1f16', '#f5a89a')}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

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