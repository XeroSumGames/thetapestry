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

      const { data: attData } = await supabase
        .from('session_attachments')
        .select('*')
        .in('session_id', (sessData ?? []).map(s => s.id))
      setAttachments(attData ?? [])

      setLoading(false)
    }
    load()
  }, [id])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
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
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.map(s => {
            const isExpanded = expandedId === s.id
            const sessAttachments = attachments.filter(a => a.session_id === s.id)
            const hasContent = s.gm_summary || s.next_session_notes || sessAttachments.length > 0

            return (
              <div key={s.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', overflow: 'hidden' }}>
                {/* Session header — always visible */}
                <div
                  onClick={() => hasContent && setExpandedId(isExpanded ? null : s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', cursor: hasContent ? 'pointer' : 'default', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (hasContent) e.currentTarget.style.background = '#242424' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: s.ended_at ? '#1a2e10' : '#2a1210', border: `2px solid ${s.ended_at ? '#2d5a1b' : '#c0392b'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: s.ended_at ? '#7fc458' : '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{s.session_number}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
                      Session {s.session_number}
                    </div>
                    <div style={{ fontSize: '10px', color: '#5a5550' }}>
                      {formatDate(s.started_at)}
                      {s.ended_at && <> — {duration(s.started_at, s.ended_at)}</>}
                    </div>
                  </div>
                  {!s.ended_at && (
                    <span style={{ fontSize: '9px', padding: '2px 6px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', flexShrink: 0 }}>Active</span>
                  )}
                  {sessAttachments.length > 0 && (
                    <span style={{ fontSize: '9px', color: '#5a5550' }}>📎 {sessAttachments.length}</span>
                  )}
                  {hasContent && (
                    <span style={{ fontSize: '14px', color: '#5a5550', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid #2e2e2e' }}>
                    {s.gm_summary && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>What Happened</div>
                        <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.gm_summary}</div>
                      </div>
                    )}
                    {s.next_session_notes && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Notes for Next Session</div>
                        <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.next_session_notes}</div>
                      </div>
                    )}
                    {sessAttachments.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Attachments</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {sessAttachments.map(a => (
                            <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', textDecoration: 'none', color: '#d4cfc9', fontSize: '12px', transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#2e2e2e')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#242424')}
                            >
                              <span>{getFileIcon(a.file_type)}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</span>
                              <span style={{ fontSize: '10px', color: '#5a5550', flexShrink: 0 }}>Open</span>
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
