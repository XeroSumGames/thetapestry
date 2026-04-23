'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import JSZip from 'jszip'

interface Counts {
  pins: number
  npcs: number
  scenes: number
  handouts: number
}

interface Errors {
  pins?: string
  npcs?: string
  scenes?: string
  handouts?: string
}

export default function ImportGmKitPage() {
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [settingKey, setSettingKey] = useState('arena')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ counts: Counts; errors: Errors } | null>(null)
  const [error, setError] = useState<string>('')

  async function readJson<T = any>(zip: JSZip, name: string): Promise<T | null> {
    const f = zip.file(name)
    if (!f) return null
    const txt = await f.async('string')
    try { return JSON.parse(txt) as T } catch { return null }
  }

  async function handleImport() {
    if (!file || !settingKey.trim() || running) return
    setRunning(true)
    setError('')
    setResult(null)
    const setting = settingKey.trim()

    try {
      const zip = await JSZip.loadAsync(file)
      const manifest = await readJson(zip, 'manifest.json')
      const pins = (await readJson<any[]>(zip, 'pins.json')) ?? []
      const npcs = (await readJson<any[]>(zip, 'npcs.json')) ?? []
      const scenes = (await readJson<any[]>(zip, 'scenes.json')) ?? []
      const handouts = (await readJson<any[]>(zip, 'handouts.json')) ?? []

      // Build a map of pin_id -> pin name so we can label NPC.pin_title for
      // the create-flow's pinMap lookup.
      const pinIdToName: Record<string, string> = {}
      for (const p of pins) if (p?.id && p?.name) pinIdToName[p.id] = p.name

      const errors: Errors = {}
      const counts: Counts = { pins: 0, npcs: 0, scenes: 0, handouts: 0 }

      // ── Pins ───────────────────────────────────────────────
      if (pins.length > 0) {
        const rows = pins.map((p: any, i: number) => ({
          setting,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          notes: p.notes ?? '',
          category: p.category ?? 'location',
          sort_order: p.sort_order ?? i + 1,
        }))
        const { error: e } = await supabase.from('setting_seed_pins').upsert(rows, { onConflict: 'setting,name' })
        if (e) errors.pins = e.message; else counts.pins = rows.length
      }

      // ── NPCs ───────────────────────────────────────────────
      if (npcs.length > 0) {
        const rows = npcs.map((n: any, i: number) => ({
          setting,
          name: n.name,
          reason: n.reason ?? 0,
          acumen: n.acumen ?? 0,
          physicality: n.physicality ?? 0,
          influence: n.influence ?? 0,
          dexterity: n.dexterity ?? 0,
          wp_max: n.wp_max ?? 10,
          rp_max: n.rp_max ?? 6,
          skills: n.skills ?? { entries: [] },
          equipment: n.equipment ?? [],
          notes: n.notes ?? null,
          motivation: n.motivation ?? null,
          portrait_url: n.portrait_url ?? null,
          // Link NPC -> pin by the pin's NAME (the create flow looks up via pinMap[name])
          pin_title: n.campaign_pin_id ? (pinIdToName[n.campaign_pin_id] ?? null) : null,
          npc_type: n.npc_type ?? null,
          sort_order: n.sort_order ?? i + 1,
        }))
        const { error: e } = await supabase.from('setting_seed_npcs').upsert(rows, { onConflict: 'setting,name' })
        if (e) errors.npcs = e.message; else counts.npcs = rows.length
      }

      // ── Scenes ─────────────────────────────────────────────
      if (scenes.length > 0) {
        const rows = scenes.map((s: any) => ({
          setting,
          name: s.name,
          grid_cols: s.grid_cols ?? 20,
          grid_rows: s.grid_rows ?? 15,
          notes: null,
          background_url: s.background_url ?? null,
        }))
        const { error: e } = await supabase.from('setting_seed_scenes').upsert(rows, { onConflict: 'setting,name' })
        if (e) errors.scenes = e.message; else counts.scenes = rows.length
      }

      // ── Handouts ───────────────────────────────────────────
      if (handouts.length > 0) {
        const rows = handouts.map((h: any) => ({
          setting,
          title: h.title,
          content: h.content ?? '',
          // Strip url_local so seed rows match campaign_notes.attachments shape exactly.
          attachments: (Array.isArray(h.attachments) ? h.attachments : []).map((a: any) => ({
            name: a.name, url: a.url, size: a.size, type: a.type, path: a.path,
          })),
        }))
        const { error: e } = await supabase.from('setting_seed_handouts').upsert(rows, { onConflict: 'setting,title' })
        if (e) errors.handouts = e.message; else counts.handouts = rows.length
      }

      setResult({ counts, errors })
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setRunning(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
    boxSizing: 'border-box',
  }

  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em',
    marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif',
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Import GM Kit → Setting Seed
        </div>
        <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '6px', lineHeight: 1.5 }}>
          Upload a <code style={{ color: '#7ab3d4' }}>gm-kit-*.zip</code> from any campaign and write its
          contents into the <code style={{ color: '#7ab3d4' }}>setting_seed_*</code> tables under a
          chosen setting key. Anyone picking that setting on <code>/stories/new</code> will get this
          content as their starting state. Re-importing the same setting key overwrites by
          (setting, name) / (setting, title).
        </div>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', borderLeft: '3px solid #c0392b', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={lbl}>Kit file (.zip)</label>
          <input type="file" accept=".zip,application/zip"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{ ...inp, padding: '6px' }} />
          {file && <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow, sans-serif', marginTop: '4px' }}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</div>}
        </div>

        <div>
          <label style={lbl}>Setting key</label>
          <input type="text" value={settingKey} onChange={e => setSettingKey(e.target.value)}
            placeholder="e.g. arena" style={inp} />
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', marginTop: '4px' }}>
            Must match a key in <code>lib/settings.ts</code> SETTINGS to show up on the create form.
          </div>
        </div>

        <div style={{ background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', padding: '10px 12px', fontSize: '13px', color: '#EF9F27', lineHeight: 1.5 }}>
          <b>Note:</b> NPC portraits, scene backgrounds, and handout attachments are stored as URLs pointing at the source campaign's Supabase bucket. They'll keep working as long as the source campaign's images stay reachable. Delete the source campaign and the seed images will 404.
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', padding: '12px' }}>
            <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Imported</div>
            <div style={{ fontSize: '13px', color: '#f5f2ee', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              <div>Pins: <b>{result.counts.pins}</b>{result.errors.pins && <span style={{ color: '#c0392b' }}> (error: {result.errors.pins})</span>}</div>
              <div>NPCs: <b>{result.counts.npcs}</b>{result.errors.npcs && <span style={{ color: '#c0392b' }}> (error: {result.errors.npcs})</span>}</div>
              <div>Scenes: <b>{result.counts.scenes}</b>{result.errors.scenes && <span style={{ color: '#c0392b' }}> (error: {result.errors.scenes})</span>}</div>
              <div>Handouts: <b>{result.counts.handouts}</b>{result.errors.handouts && <span style={{ color: '#c0392b' }}> (error: {result.errors.handouts})</span>}</div>
            </div>
          </div>
        )}

        <button onClick={handleImport} disabled={!file || !settingKey.trim() || running}
          style={{ padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: !file || !settingKey.trim() || running ? 0.6 : 1 }}>
          {running ? 'Importing…' : 'Import to Seed'}
        </button>
      </div>
    </div>
  )
}
