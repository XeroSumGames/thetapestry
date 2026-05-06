'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import NoteAttachmentsView, { NoteAttachment } from './NoteAttachmentsView'
import { openPopout } from '../lib/popout'
import { renderRichText } from '../lib/rich-text'

type Attachment = NoteAttachment

interface Note {
  id: string
  title: string
  content: string
  created_at: string
  attachments: Attachment[]
  shared: boolean
  sort_order: number | null
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
  // HTML5 drag-and-drop reorder state. dragId is the note being
  // dragged; dragOverId is the row currently being hovered as the drop
  // target; dropPosition tells the indicator (and reorder logic) whether
  // releasing here means "above the target" or "below the target".
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'above' | 'below'>('above')

  useEffect(() => { load() }, [campaignId])

  async function load() {
    // sort_order ASC, NULLS LAST so any post-migration row that lands
    // without an order still gets a stable spot at the bottom; ties
    // (NULL or duplicate sort_order) resolve by created_at ASC.
    const { data } = await supabase
      .from('campaign_notes')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    setNotes((data ?? []).map((n: any) => ({
      ...n,
      attachments: n.attachments ?? [],
      shared: n.shared ?? false,
      sort_order: n.sort_order ?? null,
    })))
  }

  // Reorder helper. Drops the dragged note above or below the target
  // based on where the cursor was released, renumbers every note 1..N,
  // and persists. N is small (a few notes per campaign), so an O(N)
  // batch update is cheaper than fractional-index math.
  async function reorderNote(srcId: string, dstId: string, placeBelow: boolean) {
    if (srcId === dstId) return
    const srcIdx = notes.findIndex(n => n.id === srcId)
    const dstIdx = notes.findIndex(n => n.id === dstId)
    if (srcIdx < 0 || dstIdx < 0) return
    const next = [...notes]
    const [moved] = next.splice(srcIdx, 1)
    // After splice, the destination index may have shifted by one.
    // Recompute against the post-splice array, then apply above/below.
    const newDstIdx = next.findIndex(n => n.id === dstId)
    const insertAt = placeBelow ? newDstIdx + 1 : newDstIdx
    next.splice(insertAt, 0, moved)
    // No-op if dropping back into the same visual slot.
    if (next.every((n, i) => n.id === notes[i].id)) return
    // Optimistic local update — write through to DB after.
    const renumbered = next.map((n, i) => ({ ...n, sort_order: i + 1 }))
    setNotes(renumbered)
    // Persist in parallel. If sort_order is missing the alert points
    // to the migration; otherwise we revert to server truth.
    const results = await Promise.all(
      renumbered.map(n =>
        supabase.from('campaign_notes').update({ sort_order: n.sort_order }).eq('id', n.id)
      )
    )
    const firstErr = results.find(r => r.error)?.error
    if (firstErr) {
      const msg = firstErr.message || ''
      if (msg.includes('sort_order') || msg.includes('column')) {
        alert(
          'Reorder failed: the sort_order column is missing.\n\n' +
            'Run sql/campaign-notes-sort-order.sql in the Supabase SQL Editor, then try again.',
        )
      } else {
        alert(`Reorder failed: ${msg}`)
      }
      await load() // revert to server truth
    }
  }

  async function uploadFiles(noteId: string, files: File[]): Promise<Attachment[]> {
    const uploaded: Attachment[] = []
    const errors: string[] = []
    for (const file of files) {
      const path = `${campaignId}/${noteId}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('note-attachments').upload(path, file, { contentType: file.type })
      if (upErr) {
        console.error('[GmNotes] upload error:', upErr.message)
        errors.push(`${file.name}: ${upErr.message}`)
        continue
      }
      const { data: urlData } = supabase.storage.from('note-attachments').getPublicUrl(path)
      uploaded.push({ name: file.name, url: urlData.publicUrl, size: file.size, type: file.type, path })
    }
    if (errors.length > 0) {
      alert(
        `Upload failed for ${errors.length} file(s):\n\n${errors.join('\n')}\n\n` +
        `If this says "bucket not found" or "row-level security", run these in Supabase SQL Editor:\n` +
        `  sql/gm-notes-attachments.sql\n` +
        `  sql/note-attachments-public.sql`
      )
    }
    return uploaded
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    // New notes go to the end of the list — find the current max
    // sort_order and add 1. If no notes have an order yet (migration
    // not run), sort_order stays null and the new row sorts after
    // existing rows by created_at, which is what users expect.
    const maxOrder = notes.reduce<number>(
      (m, n) => (n.sort_order != null && n.sort_order > m ? n.sort_order : m),
      0,
    )
    // 1. Insert the note row to get an id.
    const { data: inserted, error } = await supabase.from('campaign_notes').insert({
      campaign_id: campaignId,
      title: title.trim(),
      content: content.trim(),
      attachments: [],
      sort_order: maxOrder + 1,
    }).select('id').single()
    if (error || !inserted) {
      console.error('[GmNotes] insert error:', error?.message)
      alert(`Note save failed: ${error?.message ?? 'unknown error'}`)
      setSaving(false)
      return
    }
    // 2. Upload any attached files into a folder keyed by the new note id.
    let attachments: Attachment[] = []
    if (pendingFiles.length > 0) {
      attachments = await uploadFiles(inserted.id, pendingFiles)
      if (attachments.length > 0) {
        const { error: updErr } = await supabase.from('campaign_notes').update({ attachments }).eq('id', inserted.id)
        if (updErr) console.error('[GmNotes] attachments update error:', updErr.message)
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

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif',
    boxSizing: 'border-box',
  }

  const chipBtn: React.CSSProperties = {
    padding: '4px 10px', background: 'transparent', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#7ab3d4', fontSize: '13px',
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', cursor: 'pointer',
  }

  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'auto', flex: 1 }}>
      {/* Add note button */}
      <button onClick={() => setShowAdd(!showAdd)}
        style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start' }}>
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
            <input type="file" multiple accept="image/*,application/pdf"
              onChange={e => {
                const files = e.target.files
                if (files && files.length > 0) {
                  setPendingFiles(prev => [...prev, ...Array.from(files)])
                }
                e.target.value = ''
              }}
              style={{ display: 'none' }} />
          </label>
          {pendingFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {pendingFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name} <span style={{ color: '#5a5550' }}>({fmtSize(f.size)})</span></span>
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#c0392b', fontSize: '14px', cursor: 'pointer', padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={handleSave} disabled={saving || !title.trim()}
            style={{ padding: '6px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 && !showAdd && (
        <div style={{ color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', padding: '2rem' }}>
          No notes yet
        </div>
      )}
      {notes.map(n => {
        const isDragging = dragId === n.id
        const isDropTarget = dragOverId === n.id && dragId !== n.id
        return (
        <div
          key={n.id}
          draggable
          onDragStart={e => {
            setDragId(n.id)
            // dataTransfer is required for Firefox to start a drag.
            e.dataTransfer.effectAllowed = 'move'
            try { e.dataTransfer.setData('text/plain', n.id) } catch {}
          }}
          onDragEnd={() => { setDragId(null); setDragOverId(null) }}
          onDragOver={e => {
            if (!dragId || dragId === n.id) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            // Decide drop position by mouse Y vs row midpoint so the
            // indicator (and the actual reorder) match where the cursor
            // is. Without this, dropping near the bottom edge of a row
            // would still put the note above it.
            const rect = e.currentTarget.getBoundingClientRect()
            const placeBelow = e.clientY > rect.top + rect.height / 2
            setDragOverId(n.id)
            setDropPosition(placeBelow ? 'below' : 'above')
          }}
          onDragLeave={e => {
            // Only clear if leaving this row (not entering a child).
            const related = e.relatedTarget as Node | null
            if (related && e.currentTarget.contains(related)) return
            if (dragOverId === n.id) setDragOverId(null)
          }}
          onDrop={e => {
            if (!dragId || dragId === n.id) return
            e.preventDefault()
            const placeBelow = dropPosition === 'below'
            setDragOverId(null)
            void reorderNote(dragId, n.id, placeBelow)
            setDragId(null)
          }}
          style={{
            background: '#1a1a1a',
            border: '1px solid #2e2e2e',
            borderRadius: '3px',
            opacity: isDragging ? 0.4 : 1,
            // Drop indicator: a 2px green bar above or below the target.
            // Green reads as "go", and matches the SHARED badge accent.
            borderTop:
              isDropTarget && dropPosition === 'above'
                ? '2px solid #7fc458'
                : '1px solid #2e2e2e',
            borderBottom:
              isDropTarget && dropPosition === 'below'
                ? '2px solid #7fc458'
                : '1px solid #2e2e2e',
          }}>
          <div onClick={() => toggle(n.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', cursor: 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#f5f2ee', minWidth: 0, flex: 1 }}>
              {/* Drag handle — purely visual (the whole card is draggable);
                  the grip glyph just signals "this is reorderable" so a GM
                  doesn't have to discover the affordance by accident. */}
              <span title="Drag to reorder" aria-hidden style={{ color: '#5a5550', cursor: 'grab', fontSize: '13px', userSelect: 'none', flexShrink: 0 }}>⋮⋮</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {n.title}
                {n.shared && <span style={{ marginLeft: '6px', fontSize: '13px', color: '#7fc458' }}>SHARED</span>}
                {n.attachments.length > 0 && <span style={{ marginLeft: '8px', fontSize: '13px', color: '#7ab3d4' }}>📎 {n.attachments.length}</span>}
              </span>
            </span>
            <span style={{ fontSize: '13px', color: '#5a5550', flexShrink: 0 }}>{expanded.has(n.id) ? '▲' : '▼'}</span>
          </div>
          {expanded.has(n.id) && (
            <div style={{ padding: '0 10px 10px', borderTop: '1px solid #2e2e2e' }}>
              {/* All actions sit at the TOP of the expanded note so the
                  GM doesn't scroll past long content to reach Popout /
                  Share / Attach / Delete during a session. Single
                  4-button strip; previously a two-row split. */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => openPopout(`/handout?id=${n.id}`, `handout-${n.id}`, { w: 800, h: 700 })}
                  style={{ flex: 1, padding: '4px 10px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Popout
                </button>
                <button onClick={async () => {
                  const next = !n.shared
                  // .select() returns the updated rows — a 0-length array means
                  // RLS silently blocked the write (Supabase doesn't surface an error).
                  const { data, error } = await supabase
                    .from('campaign_notes')
                    .update({ shared: next })
                    .eq('id', n.id)
                    .select('id')
                  if (error) { alert(`Share failed: ${error.message}`); return }
                  if (!data || data.length === 0) {
                    alert('Share did not affect any rows — likely an RLS / permissions issue. Check console.')
                    return
                  }
                  setNotes(prev => prev.map(x => x.id === n.id ? { ...x, shared: next } : x))
                  // Broadcast to players — postgres_changes can drop the UPDATE
                  // event on their client when a row transitions out of their
                  // RLS-visible set (un-share), so we signal explicitly.
                  supabase.channel(`gm_notes_share_${campaignId}`).send({
                    type: 'broadcast', event: 'gm_notes_updated', payload: { id: n.id, shared: next },
                  })
                }}
                  style={{ flex: 1, padding: '4px 10px', background: n.shared ? '#1a2e10' : 'transparent', border: `1px solid ${n.shared ? '#2d5a1b' : '#7ab3d4'}`, borderRadius: '3px', color: n.shared ? '#7fc458' : '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {n.shared ? '✓ Shared' : 'Share'}
                </button>
                <label style={{ ...chipBtn, flex: 1, textAlign: 'center' as const, display: 'inline-block', cursor: uploadingNoteId === n.id ? 'wait' : 'pointer', opacity: uploadingNoteId === n.id ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                  {uploadingNoteId === n.id ? 'Uploading...' : '+ Attach'}
                  <input type="file" multiple disabled={uploadingNoteId === n.id} onChange={e => { handleAddAttachments(n, e.target.files); e.target.value = '' }} style={{ display: 'none' }} />
                </label>
                <button onClick={() => handleDelete(n)}
                  style={{ flex: 1, padding: '4px 10px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#c0392b', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Delete
                </button>
              </div>

              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: '1.5', margin: '0 0 10px' }}>
                {renderRichText(n.content, { linkify: true })}
              </pre>

              {/* Attachments — large inline image previews + lightbox */}
              {n.attachments.length > 0 && (
                <div style={{ marginBottom: '0' }}>
                  <NoteAttachmentsView attachments={n.attachments} onDelete={att => handleDeleteAttachment(n, att)} />
                </div>
              )}
            </div>
          )}
        </div>
        )
      })}
    </div>
  )
}
