'use client'
// CdpModal - GM-Tools "Award CDP" dialog. Extracted from page.tsx verbatim
// (table re-arch Step 2). Presentational + self-contained submit handler;
// state (amount / recipients) still lives in page.tsx and is threaded as
// props for now - it migrates into useGmTools later in Step 2. Behavior is
// unchanged: pick recipients, pick amount, write character_states.cdp +
// progression-log entries + a roll_log row, broadcast, then onAwarded()
// (which reloads entries + the feed).

import { OUTCOME } from '../../../../../lib/roll-outcomes'
import { insertRollLog } from '../../../../../lib/data/roll-log'

interface CdpModalProps {
  open: boolean
  onClose: () => void
  entries: any[]
  cdpAmount: number
  setCdpAmount: React.Dispatch<React.SetStateAction<number>>
  cdpRecipients: Set<string>
  setCdpRecipients: React.Dispatch<React.SetStateAction<Set<string>>>
  supabase: any
  campaignId: string
  userId: string | null
  channelRef: { current: any }
  onAwarded: () => void | Promise<unknown>
}

export function CdpModal({
  open, onClose, entries, cdpAmount, setCdpAmount, cdpRecipients, setCdpRecipients,
  supabase, campaignId, userId, channelRef, onAwarded,
}: CdpModalProps) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '360px' }}>
        <div style={{ fontSize: '13px', color: '#7ab3d4', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Award CDP</div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px' }}>Character Development Points</div>

        {/* Amount */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>Amount</span>
          <button onClick={() => setCdpAmount(Math.max(1, cdpAmount - 1))} style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', cursor: 'pointer' }}>-</button>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', minWidth: '24px', textAlign: 'center' }}>{cdpAmount}</span>
          <button onClick={() => setCdpAmount(Math.min(10, cdpAmount + 1))} style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', cursor: 'pointer' }}>+</button>
        </div>

        {/* Recipients */}
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Award to</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
          {entries.map(e => (
            <label key={e.stateId} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: cdpRecipients.has(e.stateId) ? '#1a1a2e' : '#111', border: `1px solid ${cdpRecipients.has(e.stateId) ? '#2e2e5a' : '#2e2e2e'}`, borderRadius: '3px', cursor: 'pointer', fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
              <input type="checkbox" checked={cdpRecipients.has(e.stateId)} onChange={() => {
                setCdpRecipients(prev => { const n = new Set(prev); n.has(e.stateId) ? n.delete(e.stateId) : n.add(e.stateId); return n })
              }} style={{ accentColor: '#7ab3d4' }} />
              {e.character.name} <span style={{ color: '#f5f2ee', fontWeight: 400 }}>({e.liveState?.cdp ?? 0} CDP)</span>
            </label>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
          <button onClick={async () => {
            if (cdpRecipients.size === 0) return
            const names: string[] = []
            for (const stateId of cdpRecipients) {
              const entry = entries.find(e => e.stateId === stateId)
              if (!entry?.liveState) continue
              const newCdp = Math.min(10, (entry.liveState.cdp ?? 0) + cdpAmount)
              await supabase.from('character_states').update({ cdp: newCdp, updated_at: new Date().toISOString() }).eq('id', stateId)
              // Auto-log to progression log
              const charData = entry.character.data ?? {}
              const progLog = charData.progression_log ?? []
              await supabase.from('characters').update({ data: { ...charData, progression_log: [{ date: new Date().toISOString(), type: 'cdp', text: `+${cdpAmount} CDP awarded` }, ...progLog] } }).eq('id', entry.character.id)
              names.push(entry.character.name)
            }
            const cdpNoun = cdpAmount === 1 ? 'Character Development Point' : 'Character Development Points'
            await insertRollLog({
              campaign_id: campaignId, user_id: userId, character_name: 'System',
              label: `📚 +${cdpAmount} ${cdpNoun} awarded to ${names.join(', ')}`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.cdp,
            })
            channelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
            await onAwarded()
            onClose()
          }} disabled={cdpRecipients.size === 0}
            style={{ flex: 2, padding: '10px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: cdpRecipients.size === 0 ? 'not-allowed' : 'pointer', opacity: cdpRecipients.size === 0 ? 0.5 : 1 }}>
            Award +{cdpAmount} CDP
          </button>
        </div>
      </div>
    </div>
  )
}
