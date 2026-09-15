'use client'
import { useState } from 'react'
import { ModalBackdrop } from '../lib/style-helpers'
import { computeRestRecovery, type RestState } from '../lib/rest'
import { partyRest } from '../lib/data/party-rest'
import { insertRollLog } from '../lib/data/roll-log'
import { getCachedAuth } from '../lib/auth-cache'

// Shared Party Rest modal. Extracted from CharacterCard's inline version so the
// Campaign Sheet's Rest / Relax action-bar buttons reuse the exact same rest
// mechanic (partyRest -> one clock advance, then computeRestRecovery for every
// PC). The Cooling-Off checkbox (restful, gated to 8h+) is the SRD stress-clear -
// i.e. "Relax" IS a restful Rest, not a separate mechanic (2026-09-14, hub Q10).
//
// `previewState` / `previewName` are optional: when a representative PC state is
// passed, the modal shows a recovery preview (all PCs recover similarly from
// their own state); when omitted it shows a generic note.

interface Props {
  campaignId: string
  onClose: () => void
  onDone?: () => void
  previewState?: RestState
  previewName?: string
  initialHours?: number
  initialRestful?: boolean
}

export default function PartyRestModal({ campaignId, onClose, onDone, previewState, previewName, initialHours = 0, initialRestful = true }: Props) {
  const [restHours, setRestHours] = useState(initialHours)
  const [restDays, setRestDays] = useState(0)
  const [restWeeks, setRestWeeks] = useState(0)
  const [restRestful, setRestRestful] = useState(initialRestful)
  const [resting, setResting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const totalHours = restHours + (restDays * 24) + (restWeeks * 168)

  const numInput: React.CSSProperties = { width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', boxSizing: 'border-box' }
  const numLabel: React.CSSProperties = { fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }

  async function doRest() {
    if (totalHours <= 0) { onClose(); return }
    setErr(null)
    setResting(true)
    try {
      const result = await partyRest(campaignId, totalHours, restRestful)
      if (result.error) { setErr(result.error); setResting(false); return }
      const { user } = await getCachedAuth()
      if (user && result.clock) {
        const hoursText = totalHours === 1 ? '1 hour' : `${totalHours} hours`
        const summaryParts = result.recoveries.map(r =>
          `${r.name} (+${r.wpHeal} WP, +${r.rpGain} RP${r.stressDrop > 0 ? `, -${r.stressDrop} Stress` : ''})`,
        )
        await insertRollLog({
          campaign_id: campaignId,
          user_id: user.id,
          character_name: 'System',
          label: `Party rested ${hoursText}: ${summaryParts.join('; ')}`,
          die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
          outcome: 'party_rest',
          damage_json: { hours: totalHours, restful: restRestful, partyCount: result.recoveries.length },
        })
      }
    } catch (e) {
      console.error('[party-rest] failed:', e)
      setErr(String(e))
      setResting(false)
      return
    }
    setResting(false)
    onDone?.()
    onClose()
  }

  const r = previewState ? computeRestRecovery(previewState, totalHours, restRestful) : null
  const rpCap = previewState && r ? (r.isSick ? Math.floor(previewState.rp_max / 2) : previewState.rp_max) : 0

  return (
    <ModalBackdrop onClose={onClose} zIndex={10001} opacity={0.9} padding="1rem">
      <div style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '360px' }}>
        <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Party Rest</div>
        <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem' }}>Rests the entire party at once. Clock advances once, all drainers settle once, every PC recovers from their own state.</div>
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem' }}>How much time has passed resting?</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={numLabel}>Hours</div>
            <input type="number" min={0} value={restHours} onChange={e => setRestHours(parseInt(e.target.value, 10) || 0)} style={numInput} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={numLabel}>Days</div>
            <input type="number" min={0} value={restDays} onChange={e => setRestDays(parseInt(e.target.value, 10) || 0)} style={numInput} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={numLabel}>Weeks</div>
            <input type="number" min={0} value={restWeeks} onChange={e => setRestWeeks(parseInt(e.target.value, 10) || 0)} style={numInput} />
          </div>
        </div>
        {/* Cooling-Off gate - only relevant at 8h+ (canon minimum per Stress pip). */}
        {totalHours >= 8 && (
          <button onClick={() => setRestRestful(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '1rem', padding: '8px', background: '#242424', border: `1px solid ${restRestful ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: '14px', color: restRestful ? '#7fc458' : '#888' }}>{restRestful ? '☑' : '☐'}</span>
            <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>Uninterrupted &amp; enjoyable (free from threat) - enables Stress cooling off</span>
          </button>
        )}
        {totalHours > 0 && r && previewState ? (
          <div style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem', padding: '8px', background: '#242424', borderRadius: '3px' }}>
            <div style={{ marginBottom: '4px', color: '#cce0f5', fontSize: '13px' }}>Preview for {previewName ?? 'this PC'} (all PCs recover similarly from their own state):</div>
            <div>WP healed: <span style={{ color: '#c0392b', fontWeight: 700 }}>+{r.wpHeal}</span> ({r.wasMortal ? '1 per 2 days' : '1 per day'})</div>
            <div>RP recovered: <span style={{ color: '#7ab3d4', fontWeight: 700 }}>+{r.rpGain}</span> (1 per hour{r.isSick ? `, sick cap ${rpCap}` : ''})</div>
            {r.stressDrop > 0 && <div>Stress reduced: <span style={{ color: '#EF9F27', fontWeight: 700 }}>-{r.stressDrop}</span> (1 per 8h)</div>}
          </div>
        ) : totalHours > 0 ? (
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem', padding: '8px', background: '#242424', borderRadius: '3px' }}>
            Every PC recovers from their own state: 1 WP per day (1 per 2 days if mortally wounded), 1 RP per hour, and 1 Stress per 8h when the rest is restful.
          </div>
        ) : null}
        {err && (
          <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', marginBottom: '10px', padding: '8px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px' }}>
            Rest failed: {err}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} disabled={resting}
            style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
          <button onClick={doRest} disabled={resting || totalHours <= 0}
            style={{ flex: 2, padding: '8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: resting || totalHours <= 0 ? 'not-allowed' : 'pointer', opacity: resting || totalHours <= 0 ? 0.6 : 1 }}>
            {resting ? 'Resting...' : 'Rest Party'}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  )
}
