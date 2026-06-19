'use client'
// GrantAdvantageModal - GM-Tools "Grant Advantage" picker (P3 Q4-b). Extracted
// from page.tsx verbatim (table re-arch Step 2 leaf). GM picks PC + skill +
// CMod + description; grantAdvantage writes the row and the new advantage is
// prepended to the page's local list. State + setters + supabase threaded as
// props (migrate to useGmTools later); grantAdvantage + SKILLS imported
// directly. Behavior unchanged including the canSubmit gate (CMod != 0, all
// fields filled) and the backdrop-click guard while submitting.

import { grantAdvantage } from '../../../../../lib/advantages'
import { SKILLS } from '../../../../../lib/xse-schema'

interface GrantAdvantageModalProps {
  open: boolean
  onClose: () => void
  campaignId: string
  entries: any[]
  userId: string | null
  supabase: any
  grantPcId: string
  setGrantPcId: any
  grantSkill: string
  setGrantSkill: any
  grantCmod: number
  setGrantCmod: any
  grantDescription: string
  setGrantDescription: any
  grantSubmitting: boolean
  setGrantSubmitting: any
  grantError: string | null
  setGrantError: any
  grantSourceRollLogId: string | null
  setAdvantages: any
}

export function GrantAdvantageModal({
  open, onClose, campaignId, entries, userId, supabase,
  grantPcId, setGrantPcId, grantSkill, setGrantSkill, grantCmod, setGrantCmod,
  grantDescription, setGrantDescription, grantSubmitting, setGrantSubmitting,
  grantError, setGrantError, grantSourceRollLogId, setAdvantages,
}: GrantAdvantageModalProps) {
  if (!open) return null
  const pcOptions = entries.map(e => ({ id: e.character.id, name: e.character.name }))
  const canSubmit = !!grantPcId && !!grantSkill.trim() && !!grantDescription.trim() && Number.isFinite(grantCmod) && grantCmod !== 0 && !grantSubmitting
  return (
    <div onClick={() => !grantSubmitting && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#0f0f0f', border: '1px solid #5a4a1b', borderRadius: '4px', padding: '20px 24px', width: '460px', maxWidth: '100%', fontFamily: 'Carlito, sans-serif', color: '#f5f2ee' }}>
        <div style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '4px' }}>⭐ Grant Advantage</div>
        <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '14px' }}>
          Track a contextual CMod
        </div>
        <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '14px', lineHeight: 1.5 }}>
          The PC redeems this on a future roll matching the skill. They manually adjust the CMod stepper and click Use in their Advantages tab to consume it.
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>PC</div>
          <select value={grantPcId} onChange={e => setGrantPcId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', appearance: 'none' }}>
            <option value="">- pick a PC -</option>
            {pcOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Skill</div>
          <select value={grantSkill} onChange={e => setGrantSkill(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', appearance: 'none' }}>
            <option value="">- pick a skill -</option>
            {SKILLS.map((s: any) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>CMod</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button type="button" onClick={() => setGrantCmod((c: number) => (c > -10 ? c - 1 : c))} disabled={grantSubmitting}
              style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', cursor: 'pointer' }}>−</button>
            <span style={{ fontSize: '18px', fontWeight: 700, color: grantCmod > 0 ? '#7fc458' : grantCmod < 0 ? '#c0392b' : '#cce0f5', minWidth: '40px', textAlign: 'center' }}>
              {grantCmod > 0 ? `+${grantCmod}` : grantCmod}
            </span>
            <button type="button" onClick={() => setGrantCmod((c: number) => (c < 10 ? c + 1 : c))} disabled={grantSubmitting}
              style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', cursor: 'pointer' }}>+</button>
            <span style={{ fontSize: '13px', color: '#f5f2ee', marginLeft: 'auto', fontStyle: 'italic' }}>0 is invalid</span>
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Description</div>
          <textarea value={grantDescription} onChange={e => setGrantDescription(e.target.value)}
            rows={3} placeholder="found a chemistry textbook in the warehouse"
            style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', resize: 'vertical', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
        </div>

        {grantError && (
          <div style={{ padding: '8px 12px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', color: '#f5a89a', marginBottom: '12px' }}>
            {grantError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => onClose()} disabled={grantSubmitting}
            style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" disabled={!canSubmit}
            onClick={async () => {
              if (!userId || !canSubmit) return
              setGrantSubmitting(true)
              setGrantError(null)
              const { advantage, error } = await grantAdvantage({
                supabase, campaignId, characterId: grantPcId,
                grantedBy: userId,
                skillName: grantSkill, cmodDelta: grantCmod,
                description: grantDescription,
                sourceRollLogId: grantSourceRollLogId,
              })
              setGrantSubmitting(false)
              if (error || !advantage) {
                setGrantError(error ?? 'unknown error')
                return
              }
              setAdvantages((prev: any[]) => [advantage, ...prev])
              onClose()
            }}
            style={{ flex: 2, padding: '10px', background: canSubmit ? '#2a2010' : '#1a1a1a', border: '1px solid #5a4a1b', borderRadius: '3px', color: canSubmit ? '#EF9F27' : '#f5f2ee', fontSize: '13px', letterSpacing: '.08em', textTransform: 'uppercase', cursor: canSubmit ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
            {grantSubmitting ? 'Granting…' : '⭐ Grant'}
          </button>
        </div>
      </div>
    </div>
  )
}
