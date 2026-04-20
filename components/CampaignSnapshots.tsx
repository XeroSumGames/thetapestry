'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { captureCampaignSnapshot, restoreCampaignSnapshot, CampaignSnapshot } from '../lib/campaign-snapshot'

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
      const { data: { user } } = await supabase.auth.getUser()
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
    lines.push('', 'This cannot be undone. Players at the table will see the reset.')
    if (!confirm(lines.join('\n'))) return
    setRestoring(row.id)
    setStatus(null)
    const res = await restoreCampaignSnapshot(supabase, campaignId, row.snapshot)
    setStatus(res.ok ? `✓ Restored "${row.name}"` : `Partial restore — errors:\n${res.errors.join('\n')}`)
    setRestoring(null)
  }

  async function handleDelete(row: SnapshotRow) {
    if (!confirm(`Delete snapshot "${row.name}"? (The campaign itself is unaffected.)`)) return
    const { error } = await supabase.from('campaign_snapshots').delete().eq('id', row.id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setRows(prev => prev.filter(r => r.id !== row.id))
  }

  if (!isGM) return null
  if (loading) return <div style={{ color: '#cce0f5', fontSize: '13px' }}>Loading snapshots…</div>

  const lbl: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Barlow Condensed, sans-serif' }
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Snapshots</div>
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
          style={{ padding: '8px 20px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: saving ? 'wait' : 'pointer', fontWeight: 700, opacity: saving || !newName.trim() ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Snapshot'}
        </button>
      </div>

      {/* Status */}
      {status && (
        <div style={{ marginBottom: '10px', fontSize: '13px', color: status.startsWith('✓') ? '#7fc458' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', whiteSpace: 'pre-wrap' }}>
          {status}
        </div>
      )}

      {/* List */}
      {rows.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
          No snapshots yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.map(r => (
            <div key={r.id} style={{ padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.name}</div>
                {r.description && <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px', fontFamily: 'Barlow, sans-serif' }}>{r.description}</div>}
                <div style={{ fontSize: '12px', color: '#5a5550', marginTop: '4px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {new Date(r.created_at).toLocaleString()} · {r.snapshot?.npcs?.length ?? 0} NPCs · {r.snapshot?.pins?.length ?? 0} pins · {r.snapshot?.scenes?.length ?? 0} scenes · {r.snapshot?.notes?.length ?? 0} notes
                  {r.includes_character_states && <span style={{ color: '#EF9F27', marginLeft: '6px' }}>+ party states</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => handleRestore(r)} disabled={!!restoring}
                  style={{ padding: '4px 12px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: restoring ? 'wait' : 'pointer', opacity: restoring ? 0.5 : 1 }}>
                  {restoring === r.id ? 'Restoring…' : 'Restore'}
                </button>
                <button onClick={() => handleDelete(r)} disabled={!!restoring}
                  style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#c0392b', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
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
