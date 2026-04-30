'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { captureCampaignSnapshot, restoreCampaignSnapshot, cloneSnapshotIntoCampaign, CampaignSnapshot } from '../lib/campaign-snapshot'

interface SnapshotRow {
  id: string
  name: string
  description: string | null
  includes_character_states: boolean
  snapshot: CampaignSnapshot
  created_at: string
}

export default function CampaignSnapshots({ campaignId, isGM }: { campaignId: string; isGM: boolean }) {
  const supabase = createClient()
  const [rows, setRows] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [includeStates, setIncludeStates] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => { load() }, [campaignId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('campaign_snapshots')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
    setRows((data ?? []) as SnapshotRow[])
    setLoading(false)
  }

  async function handleSave() {
    if (!newName.trim()) return
    setSaving(true)
    setStatus(null)
    try {
      const snap = await captureCampaignSnapshot(supabase, campaignId, { includesCharacterStates: includeStates })
      const { user } = await getCachedAuth()
      const { error } = await supabase.from('campaign_snapshots').insert({
        campaign_id: campaignId,
        name: newName.trim(),
        description: newDesc.trim() || null,
        snapshot: snap,
        includes_character_states: includeStates,
        created_by: user?.id ?? null,
      })
      if (error) throw new Error(error.message)
      const counts = `${snap.npcs.length} NPCs · ${snap.pins.length} pins · ${snap.scenes.length} scenes · ${snap.notes.length} notes`
      setStatus(`✓ Saved snapshot (${counts})`)
      setNewName(''); setNewDesc(''); setIncludeStates(false)
      load()
    } catch (err: any) {
      setStatus(`Error: ${err?.message ?? 'unknown'}`)
    }
    setSaving(false)
  }

  async function handleRestore(row: SnapshotRow) {
    const lines = [
      `Restore campaign state to "${row.name}"?`,
      '',
      'This will:',
      '  • Wipe all current NPCs, pins, scenes, tactical tokens, and notes.',
      '  • Re-insert the content from the snapshot.',
      '  • Clear initiative, roll log, and chat messages.',
    ]
    if (row.includes_character_states) lines.push('  • Restore character states (WP/RP/stress/insight).')
    else lines.push('  • Leave character states UNTOUCHED (this snapshot did not include them).')
    lines.push('', 'After restore: you\'ll be taken straight to the table to play the snapshotted state.', '', 'This cannot be undone. Players at the table will see the reset.')
    if (!confirm(lines.join('\n'))) return
    setRestoring(row.id)
    setStatus(null)
    const res = await restoreCampaignSnapshot(supabase, campaignId, row.snapshot)
    setStatus(res.ok ? `✓ Restored "${row.name}" — launching table…` : `Partial restore — errors:\n${res.errors.join('\n')}`)
    setRestoring(null)
    if (res.ok) {
      // Auto-launch the table view so the GM lands in the freshly-
      // restored campaign instead of stranded on the edit page.
      // Hard-load (not router.push) so every state slice rehydrates
      // from the restored DB — same approach the GM Tools → Reload
      // shortcut uses on the table page itself. Tiny delay lets the
      // ✓ status message render before navigation.
      setTimeout(() => { window.location.href = `/stories/${campaignId}/table` }, 600)
    }
  }

  async function handleDelete(row: SnapshotRow) {
    if (!confirm(`Delete snapshot "${row.name}"? (The campaign itself is unaffected.)`)) return
    const { error } = await supabase.from('campaign_snapshots').delete().eq('id', row.id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setRows(prev => prev.filter(r => r.id !== row.id))
  }

  // Download a snapshot as a JSON file. Used to share a campaign's content
  // state with another user — they import it into their own new campaign
  // via the Import button below.
  function handleDownload(row: SnapshotRow) {
    const blob = new Blob([JSON.stringify(row.snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${row.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.tapestry-snapshot.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Import a snapshot file INTO this campaign (which should be empty —
  // typically a freshly-created blank campaign the player made in their
  // own account). Validates shape, then calls cloneSnapshotIntoCampaign
  // to populate npcs/pins/scenes/tokens/notes under the current campaign_id.
  // Requires the caller to be GM of this campaign (enforced by RLS).
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  async function handleImportFile(file: File) {
    setImporting(true)
    setStatus(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as CampaignSnapshot
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.npcs) || !Array.isArray(parsed.pins) || !Array.isArray(parsed.scenes) || !Array.isArray(parsed.notes)) {
        throw new Error('Not a valid Tapestry snapshot file.')
      }
      if (!confirm(`Import snapshot into this campaign?\n\n${parsed.npcs.length} NPCs · ${parsed.pins.length} pins · ${parsed.scenes.length} scenes · ${parsed.notes.length} notes\n\nContent will ADD to whatever's already here. For a clean import, use an empty campaign.`)) {
        setImporting(false)
        return
      }
      const res = await cloneSnapshotIntoCampaign(supabase, campaignId, parsed)
      setStatus(res.ok ? `✓ Imported (${parsed.npcs.length} NPCs, ${parsed.pins.length} pins, ${parsed.scenes.length} scenes, ${parsed.notes.length} notes)` : `Partial import — errors:\n${res.errors.join('\n')}`)
    } catch (err: any) {
      setStatus(`Error: ${err?.message ?? 'unknown'}`)
    }
    setImporting(false)
  }

  if (!isGM) return null
  if (loading) return <div style={{ color: '#cce0f5', fontSize: '13px' }}>Loading snapshots…</div>

  const lbl: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Carlito, sans-serif' }
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Snapshots</div>
      <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '12px', lineHeight: 1.4 }}>
        Save the current state of this campaign — NPCs, pins, scenes, tactical tokens, handouts — to a named snapshot.
        Restore any snapshot later to rewind in place. Same campaign, same invite code, same players.
      </div>

      {/* Save new snapshot */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '12px', marginBottom: '12px' }}>
        <label style={lbl}>Snapshot name</label>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Arena act 1 pre-playtest" style={{ ...inp, marginBottom: '8px' }} />
        <label style={lbl}>Description (optional)</label>
        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} style={{ ...inp, marginBottom: '8px', resize: 'vertical' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', marginBottom: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeStates} onChange={e => setIncludeStates(e.target.checked)} />
          <span>Also include party character states (WP, RP, stress, insight, morality). Leave off to preserve progression across resets.</span>
        </label>
        <button onClick={handleSave} disabled={saving || !newName.trim()}
          style={{ padding: '8px 20px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: saving ? 'wait' : 'pointer', fontWeight: 700, opacity: saving || !newName.trim() ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Snapshot'}
        </button>
      </div>

      {/* Import snapshot file — populate this campaign from a JSON snapshot
          shared by another GM. Intended for "my GM sent me their campaign,
          let me run it" workflow: make an empty campaign, come here, import. */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Import Snapshot</div>
        <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px', lineHeight: 1.4 }}>
          Load a <code>.tapestry-snapshot.json</code> file into this campaign. Use this to receive a shared campaign from another GM — NPCs, pins, scenes, tactical tokens, and handouts will populate here. Best run in a brand-new empty campaign.
        </div>
        <input type="file" accept="application/json,.json" ref={fileInputRef} style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleImportFile(f)
            e.target.value = ''
          }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={importing}
          style={{ padding: '8px 20px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: importing ? 'wait' : 'pointer', fontWeight: 700, opacity: importing ? 0.5 : 1 }}>
          {importing ? 'Importing…' : 'Choose File…'}
        </button>
      </div>

      {/* Status */}
      {status && (
        <div style={{ marginBottom: '10px', fontSize: '13px', color: status.startsWith('✓') ? '#7fc458' : '#f5a89a', fontFamily: 'Carlito, sans-serif', whiteSpace: 'pre-wrap' }}>
          {status}
        </div>
      )}

      {/* List */}
      {rows.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
          No snapshots yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.map(r => (
            <div key={r.id} style={{ padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.name}</div>
                {r.description && <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px', fontFamily: 'Barlow, sans-serif' }}>{r.description}</div>}
                <div style={{ fontSize: '13px', color: '#5a5550', marginTop: '4px', fontFamily: 'Carlito, sans-serif' }}>
                  {new Date(r.created_at).toLocaleString()} · {r.snapshot?.npcs?.length ?? 0} NPCs · {r.snapshot?.pins?.length ?? 0} pins · {r.snapshot?.scenes?.length ?? 0} scenes · {r.snapshot?.notes?.length ?? 0} notes
                  {r.includes_character_states && <span style={{ color: '#EF9F27', marginLeft: '6px' }}>+ party states</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => handleRestore(r)} disabled={!!restoring}
                  style={{ padding: '4px 12px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: restoring ? 'wait' : 'pointer', opacity: restoring ? 0.5 : 1 }}>
                  {restoring === r.id ? 'Restoring…' : 'Restore'}
                </button>
                <button onClick={() => handleDownload(r)}
                  title="Download the snapshot as a JSON file so another GM can import it into their own campaign"
                  style={{ padding: '4px 12px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Download
                </button>
                <button onClick={() => handleDelete(r)} disabled={!!restoring}
                  style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#c0392b', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
