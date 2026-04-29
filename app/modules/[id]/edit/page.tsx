'use client'
// Module edit — author or Thriver can update tagline / description /
// content_tags / session_count_estimate / player_count_recommended,
// and upload a cover image to the `module-covers` storage bucket.
//
// RLS on `modules` already gates UPDATE to author-or-Thriver
// (sql/modules-phase-a.sql:208), so the UI here just mirrors that —
// non-author non-Thrivers see an "access denied" message instead of
// the form.
//
// Cover upload writes to the module-covers bucket (public-read,
// authenticated-write per sql/module-covers-bucket.sql) and stores
// the public URL on modules.cover_image_url. Replacing an existing
// cover deletes the prior file from storage to keep the bucket
// from accumulating orphans.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-browser'
import { getCachedAuth } from '../../../../lib/auth-cache'

interface ModuleRow {
  id: string
  author_user_id: string | null
  name: string
  tagline: string | null
  description: string | null
  cover_image_url: string | null
  content_tags: string[] | null
  session_count_estimate: number | null
  player_count_recommended: number | null
  parent_setting: string | null
  visibility: string
  moderation_status: string
}

const COVERS_BUCKET = 'module-covers'

export default function ModuleEditPage() {
  const params = useParams<{ id: string }>()
  const moduleId = params?.id as string
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [mod, setMod] = useState<ModuleRow | null>(null)
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [sessionEstimate, setSessionEstimate] = useState<string>('')
  const [playerCount, setPlayerCount] = useState<string>('')
  const [coverUrl, setCoverUrl] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!moduleId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { user } = await getCachedAuth()
      if (cancelled) return
      if (!user) { setAccessDenied(true); setLoading(false); return }

      const [{ data: row, error }, { data: profile }] = await Promise.all([
        supabase.from('modules')
          .select('id, author_user_id, name, tagline, description, cover_image_url, content_tags, session_count_estimate, player_count_recommended, parent_setting, visibility, moderation_status')
          .eq('id', moduleId)
          .maybeSingle(),
        supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      ])
      if (cancelled) return

      if (error || !row) {
        setStatus(`Failed to load module: ${error?.message ?? 'not found'}`)
        setLoading(false)
        return
      }

      const isThriver = ((profile?.role ?? '') as string).toLowerCase() === 'thriver'
      const isAuthor = row.author_user_id === user.id
      if (!isThriver && !isAuthor) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      const m = row as ModuleRow
      setMod(m)
      setName(m.name ?? '')
      setTagline(m.tagline ?? '')
      setDescription(m.description ?? '')
      setTagsInput((m.content_tags ?? []).join(', '))
      setSessionEstimate(m.session_count_estimate != null ? String(m.session_count_estimate) : '')
      setPlayerCount(m.player_count_recommended != null ? String(m.player_count_recommended) : '')
      setCoverUrl(m.cover_image_url ?? '')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [moduleId, supabase])

  async function handleCoverUpload(file: File) {
    if (!mod) return
    if (!file.type.startsWith('image/')) {
      setStatus('Cover must be an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus('Cover image too large — max 5 MB.')
      return
    }
    setUploading(true)
    setStatus(null)
    try {
      // Best-effort cleanup of the prior cover so the bucket doesn't
      // accumulate orphans. Failure here is non-fatal — RLS may have
      // changed since upload, or the file may already be gone.
      if (coverUrl) {
        const prefix = `/${COVERS_BUCKET}/`
        const idx = coverUrl.indexOf(prefix)
        if (idx > -1) {
          const oldPath = coverUrl.slice(idx + prefix.length).split('?')[0]
          if (oldPath) {
            await supabase.storage.from(COVERS_BUCKET).remove([oldPath]).catch(() => {})
          }
        }
      }
      // Path: <moduleId>/<timestamp>-<sanitized-name>. The timestamp
      // prevents browser caching of stale covers under the same URL
      // when re-uploaded; the moduleId folder keeps each module's
      // assets isolated for cleanup.
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]+/g, '')
      const safeExt = ext || 'png'
      const path = `${mod.id}/${Date.now()}.${safeExt}`
      const { error: upErr } = await supabase.storage
        .from(COVERS_BUCKET)
        .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false })
      if (upErr) {
        setStatus(`Upload failed: ${upErr.message}`)
        setUploading(false)
        return
      }
      const { data: pub } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path)
      const newUrl = pub.publicUrl
      const { error: updErr } = await supabase
        .from('modules')
        .update({ cover_image_url: newUrl })
        .eq('id', mod.id)
      if (updErr) {
        setStatus(`Saved file but module update failed: ${updErr.message}`)
        setUploading(false)
        return
      }
      setCoverUrl(newUrl)
      setStatus('✓ Cover updated.')
    } catch (err: any) {
      setStatus(`Upload error: ${err?.message ?? 'unknown'}`)
    }
    setUploading(false)
  }

  async function handleRemoveCover() {
    if (!mod || !coverUrl) return
    if (!confirm('Remove the cover image? The module will fall back to the gradient placeholder.')) return
    setUploading(true)
    setStatus(null)
    const prefix = `/${COVERS_BUCKET}/`
    const idx = coverUrl.indexOf(prefix)
    if (idx > -1) {
      const path = coverUrl.slice(idx + prefix.length).split('?')[0]
      if (path) {
        await supabase.storage.from(COVERS_BUCKET).remove([path]).catch(() => {})
      }
    }
    const { error } = await supabase.from('modules').update({ cover_image_url: null }).eq('id', mod.id)
    if (error) {
      setStatus(`Remove failed: ${error.message}`)
    } else {
      setCoverUrl('')
      setStatus('✓ Cover removed.')
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!mod) return
    if (!name.trim()) {
      setStatus('Name is required.')
      return
    }
    setSaving(true)
    setStatus(null)
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
    const sessions = sessionEstimate.trim() === '' ? null : Math.max(0, parseInt(sessionEstimate, 10) || 0)
    const players = playerCount.trim() === '' ? null : Math.max(0, parseInt(playerCount, 10) || 0)
    const { error } = await supabase
      .from('modules')
      .update({
        name: name.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        content_tags: tags.length > 0 ? tags : null,
        session_count_estimate: sessions,
        player_count_recommended: players,
      })
      .eq('id', mod.id)
    if (error) {
      setStatus(`Save failed: ${error.message}`)
    } else {
      setStatus('✓ Saved.')
    }
    setSaving(false)
  }

  if (loading) {
    return <div style={{ padding: '24px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>Loading…</div>
  }
  if (accessDenied) {
    return (
      <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto', color: '#d4cfc9' }}>
        <div style={{ fontSize: '20px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>Access Denied</div>
        <div style={{ fontSize: '14px' }}>Only the module&apos;s author or a Thriver can edit it.</div>
        <Link href="/modules" style={{ display: 'inline-block', marginTop: '16px', color: '#c4a7f0' }}>← Back to /modules</Link>
      </div>
    )
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Barlow Condensed, sans-serif' }

  return (
    <div style={{ padding: '24px 20px', maxWidth: '760px', margin: '0 auto', color: '#d4cfc9' }}>
      <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
        Module Editor
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Edit: {mod?.name}
        </h1>
        <Link href="/modules" style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          ← /modules
        </Link>
        <Link href={`/modules/${moduleId}`} style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          → Public page
        </Link>
      </div>

      {status && (
        <div style={{ marginBottom: '16px', padding: '8px 12px', background: status.startsWith('✓') ? '#1a2e10' : '#2a1210', border: `1px solid ${status.startsWith('✓') ? '#2d5a1b' : '#c0392b'}`, borderRadius: '3px', fontSize: '13px', color: status.startsWith('✓') ? '#7fc458' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {status}
        </div>
      )}

      {/* Cover upload — top of the form because it's the most visible
          marketplace asset and the slowest action (file → bucket). */}
      <div style={{ marginBottom: '24px', padding: '14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
        <div style={lbl}>Cover Image</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{
            width: '180px', height: '120px', flexShrink: 0,
            background: coverUrl
              ? `url(${coverUrl}) center/cover`
              : 'linear-gradient(135deg, #1a1a1a 0%, #2a1a3e 100%)',
            border: '1px solid #2e2e2e', borderRadius: '3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#5a5550', fontSize: '36px',
          }}>
            {!coverUrl && '📦'}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.4 }}>
              Recommended: 16:9, at least 720×400, under 5 MB. PNG or JPG. Visible on the marketplace card and the public module page.
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleCoverUpload(f)
                e.target.value = ''
              }} />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ padding: '6px 14px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.5 : 1, fontWeight: 600 }}>
                {uploading ? 'Uploading…' : coverUrl ? 'Replace Cover' : 'Upload Cover'}
              </button>
              {coverUrl && (
                <button onClick={handleRemoveCover} disabled={uploading}
                  style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.5 : 1 }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metadata fields */}
      <div style={{ marginBottom: '14px' }}>
        <label style={lbl}>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inp} />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label style={lbl}>Tagline</label>
        <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="One-sentence hook for the marketplace card." style={inp} />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label style={lbl}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} placeholder="Longer pitch for the public module page. Markdown not supported yet." style={{ ...inp, resize: 'vertical', fontFamily: 'Barlow, sans-serif' }} />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label style={lbl}>Content Tags</label>
        <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="comma, separated, tags" style={inp} />
        <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>
          Examples: one-shot, horror, road, combat-heavy, sandbox.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Session Estimate</label>
          <input type="number" min={0} value={sessionEstimate} onChange={e => setSessionEstimate(e.target.value)} placeholder="e.g. 3" style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Recommended Players</label>
          <input type="number" min={0} value={playerCount} onChange={e => setPlayerCount(e.target.value)} placeholder="e.g. 4" style={inp} />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ marginTop: '8px', padding: '9px 22px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.5 : 1 }}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}
