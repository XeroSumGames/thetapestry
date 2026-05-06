'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'

// /tools/migrate-character-photos — Thriver-only one-shot migration.
// characters.data.photoDataUrl currently holds base64-encoded JPEGs
// inline. That bloats every characters SELECT (a single 256x256 JPEG
// can be 20-40KB; rendering 30 character cards pulls the lot down
// every time). This moves each base64 blob into the
// character-portraits Storage bucket and replaces the value with the
// public URL.
//
// Idempotent — only processes rows whose photoDataUrl starts with
// 'data:'. Re-running after a successful pass is a no-op.

interface CharacterRow {
  id: string
  user_id: string
  name: string
  data: any
}

const panel: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }
const h1Style: React.CSSProperties = { fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '26px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', lineHeight: 1.1 }
const subLabel: React.CSSProperties = { fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }
const btnPrimary: React.CSSProperties = { padding: '8px 18px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }

// Convert a "data:image/jpeg;base64,XXX" URL into a Blob that
// supabase.storage can upload. Returns { blob, mime } or null if the
// string doesn't parse as a data URL.
function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const mime = match[1]
  const b64 = match[2]
  try {
    const bin = atob(b64)
    const len = bin.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
    return { blob: new Blob([bytes], { type: mime }), mime }
  } catch {
    return null
  }
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

export default function MigrateCharacterPhotosPage() {
  const supabase = createClient()
  const [authChecked, setAuthChecked] = useState(false)
  const [isThriver, setIsThriver] = useState(false)
  const [rows, setRows] = useState<CharacterRow[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; current: string }>({ done: 0, total: 0, current: '' })
  const [results, setResults] = useState<{ ok: number; skipped: number; failed: { name: string; error: string }[] }>({ ok: 0, skipped: 0, failed: [] })

  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) { setAuthChecked(true); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const thriver = (profile?.role ?? '').toString().toLowerCase() === 'thriver'
      setIsThriver(thriver)
      setAuthChecked(true)
      if (thriver) void loadCandidates()
    })()
  }, [])

  async function loadCandidates() {
    setLoading(true)
    // Pull every character with a photoDataUrl, then filter client-side
    // for the data: prefix. Doing it server-side would require a JSON
    // path operator the supabase client doesn't expose cleanly.
    const { data } = await supabase
      .from('characters')
      .select('id, user_id, name, data')
      .not('data->photoDataUrl', 'is', null)
    const candidates = ((data ?? []) as CharacterRow[]).filter(c => {
      const u = c.data?.photoDataUrl
      return typeof u === 'string' && u.startsWith('data:')
    })
    setRows(candidates)
    setLoading(false)
  }

  async function runMigration() {
    if (running || rows.length === 0) return
    setRunning(true)
    setProgress({ done: 0, total: rows.length, current: '' })
    const out: typeof results = { ok: 0, skipped: 0, failed: [] }

    for (let i = 0; i < rows.length; i++) {
      const c = rows[i]
      setProgress({ done: i, total: rows.length, current: c.name })
      const dataUrl = c.data?.photoDataUrl as string | undefined
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        out.skipped++
        continue
      }
      const decoded = dataUrlToBlob(dataUrl)
      if (!decoded) {
        out.failed.push({ name: c.name, error: 'Could not parse base64' })
        continue
      }
      const ext = extFromMime(decoded.mime)
      const path = `${c.user_id}/${c.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('character-portraits')
        .upload(path, decoded.blob, { contentType: decoded.mime, upsert: true })
      if (upErr) {
        out.failed.push({ name: c.name, error: `Upload: ${upErr.message}` })
        continue
      }
      const { data: urlData } = supabase.storage.from('character-portraits').getPublicUrl(path)
      const newUrl = urlData.publicUrl
      // Update characters.data.photoDataUrl in place. Preserve every
      // other key on data; just swap the photo URL.
      const newData = { ...c.data, photoDataUrl: newUrl }
      const { error: updErr } = await supabase.from('characters').update({ data: newData }).eq('id', c.id)
      if (updErr) {
        out.failed.push({ name: c.name, error: `Row update: ${updErr.message}` })
        continue
      }
      out.ok++
      setResults({ ...out })
    }

    setProgress({ done: rows.length, total: rows.length, current: '' })
    setResults(out)
    setRunning(false)
    void loadCandidates() // refresh; ok rows should drop out of the list
  }

  if (!authChecked) return null
  if (!isThriver) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Carlito, sans-serif', color: '#cce0f5', textAlign: 'center' }}>
      Thriver access only.
    </div>
  )

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Carlito, sans-serif', color: '#f5f2ee' }}>
      <div style={h1Style}>Migrate Character Photos</div>

      <div style={panel}>
        <div style={{ ...subLabel, marginBottom: '6px' }}>What this does</div>
        <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '12px' }}>
          Moves character portraits from inline base64 (in <code>characters.data.photoDataUrl</code>) to the
          <code> character-portraits</code> Storage bucket, replacing the value with the public URL. Reduces
          per-character row weight by 20–40 KB. Idempotent — re-runs are no-ops.
        </div>
        <div style={{ fontSize: '14px', color: '#cce0f5', marginBottom: '12px' }}>
          {loading ? 'Counting candidates…' : `${rows.length} character${rows.length === 1 ? '' : 's'} with inline base64 photos.`}
        </div>
        <button onClick={runMigration} disabled={running || loading || rows.length === 0}
          style={{ ...btnPrimary, opacity: running || loading || rows.length === 0 ? 0.5 : 1 }}>
          {running ? `Migrating ${progress.done + 1} / ${progress.total}…` : `Migrate ${rows.length} Character${rows.length === 1 ? '' : 's'}`}
        </button>
        {running && progress.current && (
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
            Current: {progress.current}
          </div>
        )}
      </div>

      {(results.ok > 0 || results.skipped > 0 || results.failed.length > 0) && (
        <div style={{ ...panel, background: results.failed.length === 0 ? '#1a2e10' : '#2a1210', border: `1px solid ${results.failed.length === 0 ? '#2d5a1b' : '#7a1f16'}` }}>
          <div style={{ ...subLabel, color: results.failed.length === 0 ? '#7fc458' : '#f5a89a', marginBottom: '6px' }}>
            {results.failed.length === 0 ? 'Done' : 'Done with errors'}
          </div>
          <div style={{ fontSize: '14px', color: '#f5f2ee', lineHeight: 1.6 }}>
            Migrated: {results.ok} · Skipped: {results.skipped} · Failed: {results.failed.length}
          </div>
          {results.failed.length > 0 && (
            <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '13px', color: '#f5a89a', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {results.failed.map(f => `${f.name}: ${f.error}`).join('\n')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
