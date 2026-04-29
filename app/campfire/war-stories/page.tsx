'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'

// /campfire/war-stories — post memorable session moments, legendary rolls,
// character beats. Cross-campaign feed: anyone signed in can read; authors
// manage their own posts. Optional campaign tag surfaces which story each
// came from.

interface Attachment {
  name: string
  path: string
  url: string
  size?: number
  type?: string
}

interface Story {
  id: string
  author_user_id: string
  campaign_id: string | null
  title: string
  body: string
  attachments: Attachment[]
  created_at: string
  updated_at: string
}

interface StoryWithMeta extends Story {
  author_username: string
  campaign_name: string | null
}

const BUCKET = 'war-stories'
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i

export default function WarStoriesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [myId, setMyId] = useState<string | null>(null)
  const [stories, setStories] = useState<StoryWithMeta[]>([])
  const [myCampaigns, setMyCampaigns] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ title: string; body: string; campaign_id: string }>({
    title: '', body: '', campaign_id: '',
  })
  // Composer attachment state. `newFiles` = picks waiting to upload on save;
  // `existingAttachments` = files already saved on the story being edited
  // (so the editor can remove them). Fresh-post flow only uses newFiles.
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)
      // Campaigns the user is a member of (GM or player) — used as the
      // optional campaign-tag dropdown on the composer. Pulled via
      // campaign_members to include campaigns where the user is a player,
      // not just those they GM.
      const { data: memberRows } = await supabase
        .from('campaign_members')
        .select('campaign_id, campaigns:campaign_id(id, name)')
        .eq('user_id', user.id)
      const camps = ((memberRows ?? []) as any[])
        .map(r => r.campaigns as { id: string; name: string } | null)
        .filter((c): c is { id: string; name: string } => !!c && !!c.id && !!c.name)
      // Dedupe (user could appear as both GM and player on the same row
      // shape in theory).
      const seen = new Set<string>()
      setMyCampaigns(camps.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true }))
      await loadStories()
    }
    init()
  }, [])

  async function loadStories() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('war_stories')
      .select('*')
      .order('updated_at', { ascending: false })
    const list = (rows ?? []) as Story[]
    if (list.length === 0) { setStories([]); setLoading(false); return }

    const authorIds = Array.from(new Set(list.map(s => s.author_user_id)))
    const campaignIds = Array.from(new Set(list.map(s => s.campaign_id).filter((x): x is string => !!x)))

    const [profRes, campRes] = await Promise.all([
      supabase.from('profiles').select('id, username').in('id', authorIds),
      campaignIds.length > 0
        ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
        : Promise.resolve({ data: [] }),
    ])
    const nameMap = Object.fromEntries((profRes.data ?? []).map((p: any) => [p.id, p.username]))
    const campMap = Object.fromEntries((campRes.data ?? []).map((c: any) => [c.id, c.name]))

    setStories(list.map(s => ({
      ...s,
      attachments: Array.isArray(s.attachments) ? s.attachments : [],
      author_username: nameMap[s.author_user_id] ?? 'Unknown',
      campaign_name: s.campaign_id ? (campMap[s.campaign_id] ?? null) : null,
    })))
    setLoading(false)
  }

  function startCompose() {
    setEditingId(null)
    setDraft({ title: '', body: '', campaign_id: '' })
    setNewFiles([])
    setExistingAttachments([])
    setComposing(true)
  }

  function startEdit(s: StoryWithMeta) {
    setEditingId(s.id)
    setDraft({ title: s.title, body: s.body, campaign_id: s.campaign_id ?? '' })
    setNewFiles([])
    setExistingAttachments(Array.isArray(s.attachments) ? s.attachments : [])
    setComposing(true)
  }

  async function handleSave() {
    if (!myId || !draft.title.trim() || !draft.body.trim() || saving) return
    setSaving(true)
    const payload = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      campaign_id: draft.campaign_id || null,
    }

    // Determine the story id we'll upload attachments under. For edits the
    // id is known; for new posts we insert first and take the returned id.
    let storyId: string
    if (editingId) {
      const { error } = await supabase.from('war_stories').update(payload).eq('id', editingId)
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
      storyId = editingId
    } else {
      const { data, error } = await supabase.from('war_stories')
        .insert({ ...payload, author_user_id: myId, attachments: [] })
        .select('id').single()
      if (error || !data) { alert('Error: ' + (error?.message ?? 'unknown')); setSaving(false); return }
      storyId = data.id
    }

    // Upload each picked file to <author>/<story>/<filename>. upsert:true
    // lets an editor overwrite a same-named file instead of erroring.
    const uploaded: Attachment[] = []
    for (const file of newFiles) {
      const path = `${myId}/${storyId}/${file.name}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
      if (upErr) { alert(`Upload failed for ${file.name}: ${upErr.message}`); continue }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      uploaded.push({ name: file.name, path, url: urlData.publicUrl, size: file.size, type: file.type })
    }

    // Merge existing (minus any the editor removed) + newly-uploaded.
    const merged = [...existingAttachments, ...uploaded]
    const { error: patchErr } = await supabase.from('war_stories')
      .update({ attachments: merged })
      .eq('id', storyId)
    if (patchErr) { alert('Failed to save attachments: ' + patchErr.message) }

    setSaving(false)
    setComposing(false)
    setEditingId(null)
    setNewFiles([])
    setExistingAttachments([])
    await loadStories()
  }

  // When editing, let the author drop an attachment. Removes from the
  // bucket first, then from the local `existingAttachments` list — the
  // subsequent save writes the updated list to the attachments column.
  async function removeExistingAttachment(att: Attachment) {
    if (!confirm(`Remove "${att.name}" from this story?`)) return
    const { error } = await supabase.storage.from(BUCKET).remove([att.path])
    if (error) { alert('Error: ' + error.message); return }
    setExistingAttachments(prev => prev.filter(a => a.path !== att.path))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this War Story?')) return
    // Best-effort cleanup of the bucket folder. Stories whose attachments
    // column is already empty just skip this. We do this BEFORE the row
    // delete so RLS still sees the author as the owner.
    const story = stories.find(s => s.id === id)
    if (story && Array.isArray(story.attachments) && story.attachments.length > 0) {
      const paths = story.attachments.map(a => a.path).filter(Boolean)
      if (paths.length > 0) {
        await supabase.storage.from(BUCKET).remove(paths)
      }
    }
    const { error } = await supabase.from('war_stories').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await loadStories()
  }

  function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee',
    fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '13px', color: '#cce0f5',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', marginBottom: '4px',
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
            War Stories
          </div>
          <div style={{ fontSize: '14px', color: '#5a8a40', lineHeight: 1.6 }}>
            Session highlights, legendary rolls, character moments — share what happened at your table.
          </div>
        </div>
        {!composing && (
          <button onClick={startCompose}
            style={{ padding: '9px 16px', background: '#3a2516', border: '1px solid #b87333', borderRadius: '3px', color: '#b87333', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + New Story
          </button>
        )}
      </div>

      {/* Composer */}
      {composing && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #b87333', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 600, color: '#b87333', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            {editingId ? 'Edit Story' : 'New Story'}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>Title</label>
            <input style={inp} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="e.g. That time we talked the raiders down" />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>The Story</label>
            <textarea style={{ ...inp, minHeight: '200px', resize: 'vertical', fontFamily: 'Barlow, sans-serif', lineHeight: 1.55 }} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
              placeholder="Tell the table what happened." />
          </div>
          {myCampaigns.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={lbl}>From Campaign (optional)</label>
              <select value={draft.campaign_id} onChange={e => setDraft(d => ({ ...d, campaign_id: e.target.value }))}
                style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                <option value="">— None —</option>
                {myCampaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Attachments (optional)</label>
            {/* Existing (edit-only). Each row has a × to remove; removal
                deletes from the bucket immediately so the on-save merge
                picks up the new list correctly. */}
            {existingAttachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '6px' }}>
                {existingAttachments.map(att => {
                  const isImg = IMAGE_RE.test(att.name)
                  return (
                    <div key={att.path} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      {isImg && <img src={att.url} alt="" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '2px' }} />}
                      <a href={att.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: '13px', color: '#b87333', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</a>
                      <button onClick={() => removeExistingAttachment(att)}
                        style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '15px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Picker for new files (staged until save). */}
            <label style={{ display: 'block', padding: '10px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', cursor: 'pointer' }}>
              {newFiles.length > 0
                ? <span style={{ color: '#7fc458' }}>{newFiles.length} file{newFiles.length > 1 ? 's' : ''} staged</span>
                : '+ Add files (images, PDFs, etc.)'}
              <input type="file" multiple hidden onChange={e => {
                if (e.target.files) setNewFiles(prev => [...prev, ...Array.from(e.target.files!)])
                e.target.value = ''
              }} />
            </label>
            {newFiles.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 8px', marginTop: '3px', fontSize: '13px', color: '#cce0f5', background: '#1f1f1f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <button onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '14px', cursor: 'pointer', padding: '0 4px' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleSave} disabled={!draft.title.trim() || !draft.body.trim() || saving}
              style={{ flex: 1, padding: '9px', background: '#3a2516', border: '1px solid #b87333', borderRadius: '3px', color: '#b87333', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'wait' : 'pointer', opacity: (!draft.title.trim() || !draft.body.trim()) ? 0.5 : 1 }}>
              {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Post Story')}
            </button>
            <button onClick={() => { setComposing(false); setEditingId(null) }}
              style={{ padding: '9px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Story list */}
      {loading ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : stories.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          No stories yet. Be the first to post one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {stories.map(s => {
            const isMine = s.author_user_id === myId
            return (
              <div key={s.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #b87333', borderRadius: '4px', padding: '1rem 1.25rem' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  {s.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: '#cce0f5' }}>by {s.author_username}</span>
                  <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                  <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTimestamp(s.updated_at)}</span>
                  {s.campaign_name && (
                    <>
                      <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                      <span style={{ padding: '1px 8px', background: '#3a2516', border: '1px solid #b87333', borderRadius: '3px', fontSize: '13px', color: '#b87333', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {s.campaign_name}
                      </span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: (s.attachments.length > 0 || isMine) ? '12px' : 0 }}>
                  {s.body}
                </div>
                {/* Attachments. Images render as clickable thumbnails
                    (open full-size in new tab); non-images show as a
                    download-link pill. The 240px max width keeps a row of
                    thumbnails tidy when there are several. */}
                {s.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: isMine ? '12px' : 0 }}>
                    {s.attachments.map(att => {
                      const isImg = IMAGE_RE.test(att.name)
                      return isImg ? (
                        <a key={att.path} href={att.url} target="_blank" rel="noreferrer" title={att.name}
                          style={{ display: 'block', width: '240px', maxWidth: '100%', border: '1px solid #2e2e2e', borderRadius: '4px', overflow: 'hidden', background: '#0f0f0f' }}>
                          <img src={att.url} alt={att.name} style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '360px', objectFit: 'contain' }} />
                        </a>
                      ) : (
                        <a key={att.path} href={att.url} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b87333', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                          📎 {att.name}
                        </a>
                      )
                    })}
                  </div>
                )}
                {isMine && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => startEdit(s)}
                      style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(s.id)}
                      style={{ padding: '5px 12px', background: '#242424', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Delete
                    </button>
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
