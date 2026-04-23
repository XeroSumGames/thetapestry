'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import NoteAttachmentsView, { NoteAttachment } from '../../components/NoteAttachmentsView'

interface Note {
  id: string
  title: string
  content: string
  created_at: string
  attachments: NoteAttachment[]
  shared: boolean
}

export default function HandoutPage() {
  const supabase = createClient()
  const params = useSearchParams()
  const noteId = params.get('id')
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!noteId) { setLoading(false); return }
      const { data } = await supabase.from('campaign_notes').select('*').eq('id', noteId).single()
      if (data) setNote({ ...data, attachments: data.attachments ?? [] })
      setLoading(false)
    }
    load()
  }, [noteId])

  if (loading) return <div style={{ background: '#0f0f0f', color: '#cce0f5', minHeight: '100vh', padding: '2rem', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
  if (!note) return <div style={{ background: '#0f0f0f', color: '#f5a89a', minHeight: '100vh', padding: '2rem', fontFamily: 'Barlow, sans-serif' }}>Handout not found.</div>

  return (
    <div style={{ background: '#0f0f0f', color: '#f5f2ee', minHeight: '100vh', fontFamily: 'Barlow, sans-serif', padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ borderBottom: '2px solid #c0392b', paddingBottom: '12px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
          {note.shared ? 'Handout' : 'GM Note'}
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          {note.title || 'Untitled'}
        </div>
        <div style={{ fontSize: '13px', color: '#5a5550', marginTop: '4px' }}>
          {new Date(note.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <div style={{ fontSize: '16px', color: '#cce0f5', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: '24px' }}>
        {note.content}
      </div>

      {note.attachments.length > 0 && (
        <div>
          <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Attachments</div>
          <NoteAttachmentsView attachments={note.attachments} />
        </div>
      )}
    </div>
  )
}
