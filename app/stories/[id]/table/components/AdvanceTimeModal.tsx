'use client'
// AdvanceTimeModal - GM-Tools "Advance Time" overencumbrance tick. Extracted
// from page.tsx verbatim (table re-arch Step 2). This one DRIVES the canonical
// campaign clock (advanceCampaignClock) plus the encumbrance RP-drain canon,
// so the handler is copied unchanged: preview every overencumbered PC/NPC and
// their RP delta (1 RP/h per point over limit), then on Apply write the RP
// hits (PCs get the incap/auto-Stress pipeline on RP=0), log one summary row,
// optimistically patch local entries + NPCs, broadcast, and tick the clock.
// hours/busy state + the entries/npcs setters are threaded as props (migrate
// to useGmTools later).

import { computeEncumbrance } from '../../../../../lib/encumbrance'
import { advance as advanceCampaignClock } from '../../../../../lib/campaign-clock'
import { OUTCOME } from '../../../../../lib/roll-outcomes'
import { insertRollLog } from '../../../../../lib/data/roll-log'

interface AdvanceTimeModalProps {
  open: boolean
  onClose: () => void
  hours: number
  setHours: React.Dispatch<React.SetStateAction<number>>
  busy: boolean
  setBusy: React.Dispatch<React.SetStateAction<boolean>>
  entries: any[]
  campaignNpcs: any[]
  setEntries: any
  setCampaignNpcs: any
  supabase: any
  campaignId: string
  userId: string | null
  channelRef: { current: any }
}

export function AdvanceTimeModal({
  open, onClose, hours: advanceTimeHours, setHours: setAdvanceTimeHours, busy: advanceTimeBusy, setBusy: setAdvanceTimeBusy,
  entries, campaignNpcs, setEntries, setCampaignNpcs, supabase, campaignId, userId, channelRef,
}: AdvanceTimeModalProps) {
  if (!open) return null
  const hours = Math.max(1, advanceTimeHours)
  // Compute the affected list every render so toggling hours
  // doesn't require a re-fetch. PCs derive from `entries` (live
  // character_states + character data); NPCs derive from
  // campaignNpcs.
  const affectedPcs = entries.flatMap(e => {
    const data = e.character.data ?? {}
    const inv = (data as any).inventory ?? []
    const wp = (data as any).weaponPrimary?.weaponName ?? ''
    const ws = (data as any).weaponSecondary?.weaponName ?? ''
    const phy = (data as any).rapid?.PHY ?? 0
    const enc = computeEncumbrance(inv, wp, ws, phy)
    if (!enc.overloaded) return []
    const cur = e.liveState.rp_current ?? 0
    // Canon (restored 2026-05-20): 1 RP/hour FOR EACH point over
    // the limit, not a flat 1/hour. overBy is the multiplier.
    const next = Math.max(0, cur - hours * enc.overBy)
    return [{
      stateId: e.stateId, name: e.character.name,
      cur, next, phy, overBy: enc.overBy,
      characterId: e.character.id,
      stress: e.liveState.stress ?? 0,
      wpCurrent: e.liveState.wp_current ?? 0,
    }]
  })
  const affectedNpcs = campaignNpcs.flatMap((n: any) => {
    const inv = n.inventory ?? []
    const wp = n.skills?.weapon?.weaponName ?? ''
    const ws = n.skills?.weapon2?.weaponName ?? ''
    const phy = n.physicality ?? 0
    const enc = computeEncumbrance(inv, wp, ws, phy)
    if (!enc.overloaded) return []
    const cur = n.rp_current ?? n.rp_max ?? 0
    // Canon: 1 RP/hour per point over the limit (see PC branch).
    const next = Math.max(0, cur - hours * enc.overBy)
    return [{ id: n.id, name: n.name, cur, next, overBy: enc.overBy }]
  })
  const total = affectedPcs.length + affectedNpcs.length
  return (
    <div onClick={() => !advanceTimeBusy && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1a1a1a', border: '1px solid #5a4a1b', borderRadius: '4px', padding: '1.5rem', width: '460px', maxWidth: '100%' }}>
        <div style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Advance Time</div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '4px' }}>Overencumbered tick</div>
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '14px', lineHeight: 1.5 }}>
          Each overencumbered character loses <strong>1 RP per hour for every point over their limit</strong> until they rest or drop weight (Distemper canon). RP can&apos;t go below 0; entering 0 triggers Incapacitation + the auto-Stress pip as usual.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', minWidth: '60px' }}>Hours</span>
          <button onClick={() => setAdvanceTimeHours(Math.max(1, hours - 1))} disabled={advanceTimeBusy}
            style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', cursor: advanceTimeBusy ? 'not-allowed' : 'pointer' }}>−</button>
          <input type="number" min={1} max={24} value={hours}
            onChange={e => setAdvanceTimeHours(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 1)))}
            disabled={advanceTimeBusy}
            style={{ width: '60px', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '15px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', fontWeight: 700 }} />
          <button onClick={() => setAdvanceTimeHours(Math.min(24, hours + 1))} disabled={advanceTimeBusy}
            style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', cursor: advanceTimeBusy ? 'not-allowed' : 'pointer' }}>+</button>
          <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginLeft: 'auto' }}>max 24</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', padding: '10px 12px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px', maxHeight: '220px', overflowY: 'auto' }}>
          <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {total === 0 ? 'No one is overencumbered' : `${total} affected`}
          </div>
          {affectedPcs.map(p => (
            <div key={`pc:${p.stateId}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontFamily: 'Carlito, sans-serif' }}>
              <span style={{ color: '#7ab3d4' }}>PC · {p.name} <span style={{ color: '#5a5550' }}>({p.overBy} over · -{p.overBy}/h)</span></span>
              <span style={{ color: p.next === 0 && p.cur > 0 ? '#c0392b' : '#cce0f5', fontWeight: 700 }}>RP {p.cur} → {p.next}{p.next === 0 && p.cur > 0 ? ' · INCAP' : ''}</span>
            </div>
          ))}
          {affectedNpcs.map(n => (
            <div key={`npc:${n.id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontFamily: 'Carlito, sans-serif' }}>
              <span style={{ color: '#EF9F27' }}>NPC · {n.name} <span style={{ color: '#5a5550' }}>({n.overBy} over · -{n.overBy}/h)</span></span>
              <span style={{ color: n.next === 0 && n.cur > 0 ? '#c0392b' : '#cce0f5', fontWeight: 700 }}>RP {n.cur} → {n.next}{n.next === 0 && n.cur > 0 ? ' · INCAP' : ''}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} disabled={advanceTimeBusy}
            style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: advanceTimeBusy ? 'not-allowed' : 'pointer' }}>
            Cancel
          </button>
          <button onClick={async () => {
            if (total === 0 || advanceTimeBusy) { onClose(); return }
            setAdvanceTimeBusy(true)
            const nowIso = new Date().toISOString()
            // Build per-character updates. PCs get the full
            // mortal/incap pipeline (auto-Stress on RP=0); NPCs
            // just take the RP hit since they don't track Stress.
            const pcUpdates = affectedPcs.map(p => {
              const update: any = { rp_current: p.next, updated_at: nowIso }
              if (p.next === 0 && p.cur > 0 && p.wpCurrent > 0) {
                update.incap_rounds = Math.max(1, 4 - p.phy)
                update.stress = Math.min(5, p.stress + 1)
              }
              return supabase.from('character_states').update(update).eq('id', p.stateId)
            })
            const npcUpdates = affectedNpcs.map(n => (
              supabase.from('campaign_npcs').update({ rp_current: n.next }).eq('id', n.id)
            ))
            await Promise.all([...pcUpdates, ...npcUpdates])

            // Single roll_log summary entry - cleaner than one
            // row per character. Format mirrors the Loot summary.
            const summaryParts: string[] = []
            for (const p of affectedPcs) summaryParts.push(`${p.name} (${p.cur}→${p.next})`)
            for (const n of affectedNpcs) summaryParts.push(`${n.name} (${n.cur}→${n.next})`)
            await insertRollLog({
              campaign_id: campaignId, user_id: userId, character_name: 'System',
              label: `⏳ Time advances ${hours}h · overencumbered: ${summaryParts.join(', ')}`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
              outcome: OUTCOME.encumbrance,
            })

            // Optimistic local patch + broadcast so other clients
            // pick up the change without a manual refresh.
            setEntries((prev: any[]) => prev.map((e: any) => {
              const hit = affectedPcs.find(p => p.stateId === e.stateId)
              if (!hit) return e
              const ls = { ...e.liveState, rp_current: hit.next }
              if (hit.next === 0 && hit.cur > 0 && hit.wpCurrent > 0) {
                ls.incap_rounds = Math.max(1, 4 - hit.phy)
                ls.stress = Math.min(5, hit.stress + 1)
              }
              return { ...e, liveState: ls }
            }))
            setCampaignNpcs((prev: any[]) => prev.map((n: any) => {
              const hit = affectedNpcs.find(a => a.id === n.id)
              return hit ? { ...n, rp_current: hit.next } : n
            }))
            channelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
            channelRef.current?.send({ type: 'broadcast', event: 'npc_damaged', payload: {} })

            // Tick the canonical campaign clock so streaming heals
            // drain and the campaign-sheet popout sees the new time.
            // Best-effort: if it fails, the RP updates above still
            // landed, so the encumbrance hit is correct even with a
            // clock drift.
            const ticked = await advanceCampaignClock(campaignId, hours)
            if (!ticked) console.error('[advance-time] campaign clock did not tick')

            setAdvanceTimeBusy(false)
            onClose()
          }} disabled={advanceTimeBusy || total === 0}
            style={{ flex: 2, padding: '10px', background: total === 0 ? '#1a1a1a' : '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: total === 0 ? '#5a5550' : '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: advanceTimeBusy || total === 0 ? 'not-allowed' : 'pointer', opacity: advanceTimeBusy ? 0.6 : 1, fontWeight: 700 }}>
            {advanceTimeBusy ? 'Applying…' : total === 0 ? 'Nothing to apply' : `Apply ${hours}h to ${total}`}
          </button>
        </div>
      </div>
    </div>
  )
}
