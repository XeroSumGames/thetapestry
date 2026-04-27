'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import NoteAttachmentsView, { NoteAttachment } from './NoteAttachmentsView'
import { openPopout } from '../lib/popout'
import { renderRichText } from '../lib/rich-text'

interface PlayerNote {
  id: string
  title: string | null
  content: string
  submitted_to_summary: boolean
  submitted_at: string | null
  created_at: string
}

interface SharedNote {
  id: string
  title: string
  content: string
  attachments: NoteAttachment[]
}

export default function PlayerNotes({ campaignId }: { campaignId: string }) {
  const supabase = createClient()
  const [notes, setNotes] = useState<PlayerNote[]>([])
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitOnSave, setSubmitOnSave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    })()
    load()
    loadShared()
    // Live-refresh shared GM notes.
    // postgres_changes alone isn't enough: when the GM un-shares a note, the
    // UPDATE transitions the row OUT of the player's RLS-visible set, so
    // Supabase often drops the event on this client. GmNotes emits an
    // explicit broadcast on every share toggle as a reliable fallback.
    const channel = supabase.channel(`gm_notes_share_${campaignId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_notes', filter: `campaign_id=eq.${campaignId}` }, () => loadShared())
      .on('broadcast', { event: 'gm_notes_updated' }, () => loadShared())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  async function load() {
    const { data } = await supabase
      .from('player_notes')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
    setNotes(data ?? [])
  }

  async function loadShared() {
    const { data } = await supabase
      .from('campaign_notes')
      .select('id, title, content, attachments')
      .eq('campaign_id', campaignId)
      .eq('shared', true)
      .order('created_at', { ascending: true })
    setSharedNotes((data ?? []).map((n: any) => ({ ...n, attachments: n.attachments ?? [] })))
  }

  async function handleSave() {
    if (!content.trim() || !userId) return
    setSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('player_notes').insert({
      campaign_id: campaignId,
      user_id: userId,
      title: title.trim() || null,
      content: content.trim(),
      submitted_to_summary: submitOnSave,
      submitted_at: submitOnSave ? now : null,
    })
    if (error) console.error('[PlayerNotes] insert error:', error.message)
    else {
      setTitle('')
      setContent('')
      setSubmitOnSave(false)
      setShowAdd(false)
      await load()
    }
    setSaving(false)
  }

  async function toggleSubmit(note: PlayerNote) {
    const next = !note.submitted_to_summary
    const update: any = { submitted_to_summary: next }
    update.submitted_at = next ? new Date().toISOString() : null
    const { error } = await supabase.from('player_notes').update(update).eq('id', note.id)
    if (error) { console.error('[PlayerNotes] toggleSubmit error:', error.message); return }
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, ...update } : n))
  }

  async function handleDelete(note: PlayerNote) {
    if (!confirm('Delete this note?')) return
    await supabase.from('player_notes').delete().eq('id', note.id)
    setNotes(prev => prev.filter(n => n.id !== note.id))
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'auto', flex: 1 }}>
      <button onClick={() => setShowAdd(!showAdd)}
        style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start' }}>
        {showAdd ? 'Cancel' : '+ Add Note'}
      </button>

      {showAdd && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" style={inp} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Your notes for this session..." rows={6} style={{ ...inp, resize: 'vertical' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: submitOnSave ? '#7fc458' : '#7ab3d4', cursor: 'pointer', padding: '4px 2px' }}>
            <input type="checkbox" checked={submitOnSave} onChange={e => setSubmitOnSave(e.target.checked)}
              style={{ width: '14px', height: '14px', accentColor: '#7fc458', cursor: 'pointer' }} />
            Append to GM's session summary
          </label>
          <button onClick={handleSave} disabled={saving || !content.trim()}
            style={{ padding: '6px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {sharedNotes.length > 0 && (
        <>
          <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 0' }}>GM Handouts</div>
          {sharedNotes.map(n => (
            <div key={`shared-${n.id}`} style={{ background: '#1a1a1a', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
              <div onClick={() => toggle(`shared-${n.id}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', cursor: 'pointer' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.title}
                  {n.attachments.length > 0 && <span style={{ marginLeft: '8px', fontSize: '13px', color: '#7ab3d4' }}>📎 {n.attachments.length}</span>}
                </span>
                <span style={{ fontSize: '13px', color: '#5a5550' }}>{expanded.has(`shared-${n.id}`) ? '▲' : '▼'}</span>
              </div>
              {expanded.has(`shared-${n.id}`) && (
                <div style={{ padding: '0 10px 10px', borderTop: '1px solid #2e2e2e' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: '1.5', margin: '10px 0' }}>
                    {n.content}
                  </pre>
                  {n.attachments.length > 0 && (
                    <NoteAttachmentsView attachments={n.attachments} />
                  )}
                  <button onClick={() => openPopout(`/handout?id=${n.id}`, `handout-${n.id}`, { w: 800, h: 700 })}
                    style={{ marginTop: '6px', padding: '4px 10px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Popout
                  </button>
                </div>
              )}
            </div>
          ))}
          <div style={{ borderBottom: '1px solid #2e2e2e', margin: '4px 0' }} />
        </>
      )}

      {notes.length === 0 && sharedNotes.length === 0 && !showAdd && (
        <div style={{ color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', padding: '2rem' }}>
          No notes yet
        </div>
      )}
      {notes.map(n => (
        <div key={n.id} style={{ background: '#1a1a1a', border: `1px solid ${n.submitted_to_summary ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px' }}>
          <div onClick={() => toggle(n.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', cursor: 'pointer' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.title || n.content.slice(0, 40) + (n.content.length > 40 ? '…' : '')}
              {n.submitted_to_summary && <span style={{ marginLeft: '6px', fontSize: '13px', color: '#7fc458' }}>✓ SUBMITTED</span>}
            </span>
            <span style={{ fontSize: '13px', color: '#5a5550' }}>{expanded.has(n.id) ? '▲' : '▼'}</span>
          </div>
          {expanded.has(n.id) && (
            <div style={{ padding: '0 10px 10px', borderTop: '1px solid #2e2e2e' }}>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: '1.5', margin: '10px 0' }}>
                {renderRichText(n.content, { linkify: true })}
              </pre>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => toggleSubmit(n)}
                  style={{ padding: '4px 10px', background: n.submitted_to_summary ? '#1a2e10' : 'transparent', border: `1px solid ${n.submitted_to_summary ? '#2d5a1b' : '#7ab3d4'}`, borderRadius: '3px', color: n.submitted_to_summary ? '#7fc458' : '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {n.submitted_to_summary ? '✓ In Session Summary' : '+ Add to Session Summary'}
                </button>
                <button onClick={() => handleDelete(n)}
                  style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#c0392b', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
