'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

interface Note {
  id: string
  title: string
  content: string
  created_at: string
}

export default function GmNotes({ campaignId }: { campaignId: string }) {
  const supabase = createClient()
  const [notes, setNotes] = useState<Note[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [campaignId])

  async function load() {
    const { data } = await supabase
      .from('campaign_notes')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
    setNotes(data ?? [])
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('campaign_notes').insert({
      campaign_id: campaignId,
      title: title.trim(),
      content: content.trim(),
    })
    if (!error) {
      setTitle('')
      setContent('')
      setShowAdd(false)
      await load()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return
    await supabase.from('campaign_notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
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
      {/* Add note button */}
      <button onClick={() => setShowAdd(!showAdd)}
        style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start' }}>
        {showAdd ? 'Cancel' : '+ Add Note'}
      </button>

      {/* Add note form */}
      {showAdd && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
            style={inp} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Content" rows={6}
            style={{ ...inp, resize: 'vertical' }} />
          <button onClick={handleSave} disabled={saving || !title.trim()}
            style={{ padding: '6px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 && !showAdd && (
        <div style={{ color: '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', padding: '2rem' }}>
          No notes yet
        </div>
      )}
      {notes.map(n => (
        <div key={n.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
          <div onClick={() => toggle(n.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', cursor: 'pointer' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee' }}>{n.title}</span>
            <span style={{ fontSize: '11px', color: '#5a5550' }}>{expanded.has(n.id) ? '▲' : '▼'}</span>
          </div>
          {expanded.has(n.id) && (
            <div style={{ padding: '0 10px 10px', borderTop: '1px solid #2e2e2e' }}>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: '1.5', margin: '10px 0' }}>
                {n.content}
              </pre>
              <button onClick={() => handleDelete(n.id)}
                style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#c0392b', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
