'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'

interface Session {
  id: string
  session_number: number
  started_at: string
  ended_at: string | null
  gm_summary: string | null
  next_session_notes: string | null
}

interface Attachment {
  id: string
  session_id: string
  file_url: string
  file_name: string
  file_type: string
}

export default function SessionHistoryPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const [sessions, setSessions] = useState<Session[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [campaignName, setCampaignName] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: camp } = await supabase.from('campaigns').select('name, gm_user_id').eq('id', id).single()
      if (!camp || camp.gm_user_id !== user.id) { router.push('/dashboard'); return }
      setCampaignName(camp.name)

      const { data: sessData } = await supabase
        .from('sessions')
        .select('*')
        .eq('campaign_id', id)
        .order('session_number', { ascending: false })
      setSessions(sessData ?? [])

      const sessIds = (sessData ?? []).map(s => s.id)
      if (sessIds.length > 0) {
        const { data: attData } = await supabase
          .from('session_attachments')
          .select('*')
          .in('session_id', sessIds)
        setAttachments(attData ?? [])
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function deactivateSession(sessionId: string) {
    setDeactivating(sessionId)
    await supabase.from('sessions').update({ ended_at: new Date().toISOString() }).eq('id', sessionId)
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ended_at: new Date().toISOString() } : s))
    // Also set campaign to idle if this was the active session
    await supabase.from('campaigns').update({ session_status: 'idle', session_started_at: null }).eq('id', id)
    setDeactivating(null)
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('Delete this session record? This cannot be undone.')) return
    setDeleting(sessionId)
    await supabase.from('session_attachments').delete().eq('session_id', sessionId)
    await supabase.from('sessions').delete().eq('id', sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    setAttachments(prev => prev.filter(a => a.session_id !== sessionId))
    setDeleting(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function duration(start: string, end: string) {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    const rem = mins % 60
    return `${hrs}h ${rem}m`
  }

  function getFileIcon(type: string) {
    if (type.startsWith('image/')) return '🖼'
    if (type === 'application/pdf') return '📄'
    if (type.includes('word')) return '📝'
    return '📎'
  }

  if (loading) return (
    <div style={{ padding: '2rem', color: '#5a5550', fontFamily: 'Barlow, sans-serif' }}>Loading sessions...</div>
  )

  return (
    <div style={{ padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <a href={`/campaigns/${id}/table`}
          style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Back to Table
        </a>
        <div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            Session History
          </div>
          <div style={{ fontSize: '12px', color: '#5a5550' }}>{campaignName} — {sessions.length} session{sessions.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div style={{ color: '#5a5550', fontSize: '14px', textAlign: 'center', padding: '2rem' }}>No sessions recorded yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
          {sessions.map(s => {
            const isExpanded = expandedId === s.id
            const sessAttachments = attachments.filter(a => a.session_id === s.id)
            const hasContent = s.gm_summary || s.next_session_notes || sessAttachments.length > 0
            const isActive = !s.ended_at

            return (
              <div key={s.id} style={{ background: '#1a1a1a', border: `1px solid ${isActive ? '#c0392b' : '#2e2e2e'}`, borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Card header */}
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isActive ? '#2a1210' : '#1a2e10', border: `2px solid ${isActive ? '#c0392b' : '#2d5a1b'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: isActive ? '#c0392b' : '#7fc458', fontFamily: 'Barlow Condensed, sans-serif' }}>{s.session_number}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
                      Session {s.session_number}
                    </div>
                    <div style={{ fontSize: '9px', color: '#5a5550' }}>
                      {formatDate(s.started_at)} {formatTime(s.started_at)}
                      {s.ended_at && <> — {duration(s.started_at, s.ended_at)}</>}
                    </div>
                  </div>
                  {isActive && (
                    <span style={{ fontSize: '8px', padding: '1px 5px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', flexShrink: 0 }}>Active</span>
                  )}
                  {sessAttachments.length > 0 && (
                    <span style={{ fontSize: '9px', color: '#5a5550', flexShrink: 0 }}>📎{sessAttachments.length}</span>
                  )}
                </div>

                {/* Summary preview */}
                {s.gm_summary && (
                  <div style={{ padding: '0 12px 8px', fontSize: '11px', color: '#5a5550', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: isExpanded ? 999 : 2, WebkitBoxOrient: 'vertical' as const }}>
                    {s.gm_summary}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ marginTop: 'auto', padding: '0 12px 10px', display: 'flex', gap: '4px' }}>
                  {hasContent && (
                    <button onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      style={{ flex: 1, padding: '5px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  )}
                  {isActive && (
                    <button onClick={() => deactivateSession(s.id)} disabled={deactivating === s.id}
                      style={{ padding: '5px 10px', background: 'none', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: deactivating === s.id ? 'not-allowed' : 'pointer', opacity: deactivating === s.id ? 0.5 : 1 }}>
                      {deactivating === s.id ? '...' : 'Deactivate'}
                    </button>
                  )}
                  <button onClick={() => deleteSession(s.id)} disabled={deleting === s.id}
                    style={{ padding: '5px 10px', background: 'none', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: deleting === s.id ? 'not-allowed' : 'pointer', opacity: deleting === s.id ? 0.5 : 1 }}>
                    {deleting === s.id ? '...' : 'Delete'}
                  </button>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ padding: '0 12px 12px', borderTop: '1px solid #2e2e2e' }}>
                    {s.gm_summary && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '9px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>What Happened</div>
                        <div style={{ fontSize: '12px', color: '#d4cfc9', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.gm_summary}</div>
                      </div>
                    )}
                    {s.next_session_notes && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '9px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>Notes for Next Session</div>
                        <div style={{ fontSize: '12px', color: '#d4cfc9', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.next_session_notes}</div>
                      </div>
                    )}
                    {sessAttachments.length > 0 && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '9px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Attachments</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {sessAttachments.map(a => (
                            <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', textDecoration: 'none', color: '#7ab3d4', fontSize: '11px', transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#2e2e2e')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#242424')}
                            >
                              <span>{getFileIcon(a.file_type)}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</span>
                              <span style={{ fontSize: '9px', color: '#5a5550', flexShrink: 0 }}>Open ↗</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
