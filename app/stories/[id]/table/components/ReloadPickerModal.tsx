'use client'
// ReloadPickerModal - GM-Tools "Reload" snapshot-restore picker. Extracted
// from page.tsx verbatim (table re-arch Step 2). Lists campaign snapshots;
// picking one wipes + re-inserts campaign content via restoreCampaignSnapshot
// then hard-reloads the page. Snapshot list + in-flight id threaded as props;
// restoreCampaignSnapshot is a pure lib call imported directly. Behavior
// unchanged including the confirm() gate and window.location.reload on success.

import { restoreCampaignSnapshot } from '../../../../../lib/campaign-snapshot'

interface ReloadPickerModalProps {
  open: boolean
  onClose: () => void
  snapshots: any[]
  reloadingSnapshotId: string | null
  setReloadingSnapshotId: React.Dispatch<React.SetStateAction<string | null>>
  supabase: any
  campaignId: string
}

export function ReloadPickerModal({
  open, onClose, snapshots, reloadingSnapshotId, setReloadingSnapshotId, supabase, campaignId,
}: ReloadPickerModalProps) {
  if (!open) return null
  return (
    <div onClick={() => !reloadingSnapshotId && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Reload</div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '0.5rem' }}>Restore from snapshot</div>
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.4, marginBottom: '12px' }}>
          Pick a snapshot - its NPCs, pins, scenes, tactical tokens, and notes replace the current state. Initiative, roll log, and chat clear. Players at the table will see the reset.
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
          {snapshots.length === 0 ? (
            <div style={{ color: '#cce0f5', fontSize: '13px', textAlign: 'center', padding: '1rem', fontFamily: 'Carlito, sans-serif' }}>No snapshots yet for this campaign. Create one in Campaign edit → Snapshots.</div>
          ) : (
            snapshots.map(s => (
              <div key={s.id}
                style={{ padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '6px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{s.name}</div>
                {s.description && <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px', fontFamily: 'Carlito, sans-serif' }}>{s.description}</div>}
                <div style={{ fontSize: '13px', color: '#5a5550', marginTop: '4px', fontFamily: 'Carlito, sans-serif' }}>
                  {new Date(s.created_at).toLocaleString()}
                  {' · '}{(s.snapshot as any)?.npcs?.length ?? 0} NPCs
                  {' · '}{(s.snapshot as any)?.pins?.length ?? 0} pins
                  {' · '}{(s.snapshot as any)?.scenes?.length ?? 0} scenes
                  {' · '}{(s.snapshot as any)?.notes?.length ?? 0} notes
                  {s.includes_character_states && <span style={{ color: '#EF9F27', marginLeft: '6px' }}>+ party states</span>}
                </div>
                <button onClick={async () => {
                  const lines = [
                    `Restore campaign state to "${s.name}"?`,
                    '',
                    'This will:',
                    '  • Wipe all current NPCs, pins, scenes, tactical tokens, and notes.',
                    '  • Re-insert the content from the snapshot.',
                    '  • Clear initiative, roll log, and chat messages.',
                  ]
                  if (s.includes_character_states) lines.push('  • Restore character states (WP/RP/stress/insight).')
                  else lines.push('  • Leave character states UNTOUCHED.')
                  lines.push('', 'This cannot be undone. Players at the table will see the reset.')
                  if (!confirm(lines.join('\n'))) return
                  setReloadingSnapshotId(s.id)
                  const res = await restoreCampaignSnapshot(supabase, campaignId, s.snapshot)
                  setReloadingSnapshotId(null)
                  onClose()
                  if (res.ok) {
                    // Hard-reload the page so every state slice (entries,
                    // initiative, mapTokens, chat, rolls feed) refetches
                    // from the now-restored DB. Cheaper and more
                    // reliable than threading a re-mount across all the
                    // hooks here.
                    window.location.reload()
                  } else {
                    alert(`Partial restore - errors:\n${res.errors.join('\n')}`)
                  }
                }} disabled={!!reloadingSnapshotId}
                  style={{ marginTop: '8px', padding: '4px 12px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: reloadingSnapshotId ? 'wait' : 'pointer', opacity: reloadingSnapshotId ? 0.5 : 1 }}>
                  {reloadingSnapshotId === s.id ? 'Reloading…' : 'Reload this snapshot'}
                </button>
              </div>
            ))
          )}
        </div>
        <button onClick={onClose} disabled={!!reloadingSnapshotId}
          style={{ padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: reloadingSnapshotId ? 'not-allowed' : 'pointer', opacity: reloadingSnapshotId ? 0.5 : 1 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
