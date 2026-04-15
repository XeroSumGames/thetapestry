'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

interface Attachment {
  name: string
  url: string
  size: number
  type: string
  path: string
}

interface Note {
  id: string
  title: string
  content: string
  created_at: string
  attachments: Attachment[]
  shared: boolean
}

export default function GmNotes({ campaignId }: { campaignId: string }) {
  const supabase = createClient()
  const [notes, setNotes] = useState<Note[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingNoteId, setUploadingNoteId] = useState<string | null>(null)

  useEffect(() => { load() }, [campaignId])

  async function load() {
    const { data } = await supabase
      .from('campaign_notes')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
    setNotes((data ?? []).map((n: any) => ({ ...n, attachments: n.attachments ?? [], shared: n.shared ?? false })))
  }

  async function uploadFiles(noteId: string, files: File[]): Promise<Attachment[]> {
    const uploaded: Attachment[] = []
    for (const file of files) {
      const path = `${campaignId}/${noteId}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('note-attachments').upload(path, file, { contentType: file.type })
      if (upErr) { console.error('[GmNotes] upload error:', upErr.message); continue }
      const { data: urlData } = supabase.storage.from('note-attachments').getPublicUrl(path)
      uploaded.push({ name: file.name, url: urlData.publicUrl, size: file.size, type: file.type, path })
    }
    return uploaded
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    // 1. Insert the note row to get an id.
    const { data: inserted, error } = await supabase.from('campaign_notes').insert({
      campaign_id: campaignId,
      title: title.trim(),
      content: content.trim(),
      attachments: [],
    }).select('id').single()
    if (error || !inserted) { console.error('[GmNotes] insert error:', error?.message); setSaving(false); return }
    // 2. Upload any attached files into a folder keyed by the new note id.
    let attachments: Attachment[] = []
    if (pendingFiles.length > 0) {
      attachments = await uploadFiles(inserted.id, pendingFiles)
      if (attachments.length > 0) {
        await supabase.from('campaign_notes').update({ attachments }).eq('id', inserted.id)
      }
    }
    setTitle('')
    setContent('')
    setPendingFiles([])
    setShowAdd(false)
    await load()
    setSaving(false)
  }

  async function handleAddAttachments(note: Note, files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingNoteId(note.id)
    const newOnes = await uploadFiles(note.id, Array.from(files))
    if (newOnes.length > 0) {
      const merged = [...note.attachments, ...newOnes]
      await supabase.from('campaign_notes').update({ attachments: merged }).eq('id', note.id)
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, attachments: merged } : n))
    }
    setUploadingNoteId(null)
  }

  async function handleDeleteAttachment(note: Note, att: Attachment) {
    if (!confirm(`Delete "${att.name}"?`)) return
    await supabase.storage.from('note-attachments').remove([att.path])
    const remaining = note.attachments.filter(a => a.path !== att.path)
    await supabase.from('campaign_notes').update({ attachments: remaining }).eq('id', note.id)
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, attachments: remaining } : n))
  }

  async function handleDelete(note: Note) {
    if (!confirm('Delete this note?')) return
    // Clean up any storage objects first so the bucket doesn't accumulate orphans.
    if (note.attachments.length > 0) {
      await supabase.storage.from('note-attachments').remove(note.attachments.map(a => a.path))
    }
    await supabase.from('campaign_notes').delete().eq('id', note.id)
    setNotes(prev => prev.filter(n => n.id !== note.id))
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  function isImage(att: Attachment): boolean {
    return att.type.startsWith('image/')
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
    boxSizing: 'border-box',
  }

  const chipBtn: React.CSSProperties = {
    padding: '4px 10px', background: 'transparent', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#7ab3d4', fontSize: '11px',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', cursor: 'pointer',
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
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={inp} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Content" rows={6} style={{ ...inp, resize: 'vertical' }} />
          {/* File picker for new note */}
          <label style={{ ...chipBtn, display: 'inline-block', alignSelf: 'flex-start', cursor: 'pointer' }}>
            + Attach Files
            <input type="file" multiple onChange={e => { if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = '' }} style={{ display: 'none' }} />
          </label>
          {pendingFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {pendingFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name} <span style={{ color: '#5a5550' }}>({fmtSize(f.size)})</span></span>
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#c0392b', fontSize: '14px', cursor: 'pointer', padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>
          )}
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
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee' }}>
              {n.title}
              {n.shared && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#7fc458' }}>SHARED</span>}
              {n.attachments.length > 0 && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#7ab3d4' }}>📎 {n.attachments.length}</span>}
            </span>
            <span style={{ fontSize: '11px', color: '#5a5550' }}>{expanded.has(n.id) ? '▲' : '▼'}</span>
          </div>
          {expanded.has(n.id) && (
            <div style={{ padding: '0 10px 10px', borderTop: '1px solid #2e2e2e' }}>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: '1.5', margin: '10px 0' }}>
                {n.content}
              </pre>

              {/* Attachments list */}
              {n.attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                  {n.attachments.map(att => (
                    <div key={att.path} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      {isImage(att) && (
                        <a href={att.url} target="_blank" rel="noreferrer" style={{ display: 'block', flexShrink: 0 }}>
                          <img src={att.url} alt="" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '2px' }} />
                        </a>
                      )}
                      <a href={att.url} target="_blank" rel="noreferrer"
                        style={{ flex: 1, fontSize: '12px', color: '#7ab3d4', fontFamily: 'Barlow, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                        {att.name} <span style={{ color: '#5a5550' }}>({fmtSize(att.size)})</span>
                      </a>
                      <button onClick={() => handleDeleteAttachment(n, att)}
                        style={{ background: 'none', border: '1px solid #7a1f16', borderRadius: '2px', color: '#c0392b', fontSize: '11px', padding: '0 6px', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={async () => {
                  const next = !n.shared
                  await supabase.from('campaign_notes').update({ shared: next }).eq('id', n.id)
                  setNotes(prev => prev.map(x => x.id === n.id ? { ...x, shared: next } : x))
                }}
                  style={{ padding: '4px 10px', background: n.shared ? '#1a2e10' : 'transparent', border: `1px solid ${n.shared ? '#2d5a1b' : '#7ab3d4'}`, borderRadius: '3px', color: n.shared ? '#7fc458' : '#7ab3d4', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {n.shared ? '✓ Shared' : 'Share'}
                </button>
                <label style={{ ...chipBtn, display: 'inline-block', cursor: uploadingNoteId === n.id ? 'wait' : 'pointer', opacity: uploadingNoteId === n.id ? 0.6 : 1 }}>
                  {uploadingNoteId === n.id ? 'Uploading...' : '+ Attach'}
                  <input type="file" multiple disabled={uploadingNoteId === n.id} onChange={e => { handleAddAttachments(n, e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
                </label>
                <button onClick={() => handleDelete(n)}
                  style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#c0392b', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Delete Note
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
