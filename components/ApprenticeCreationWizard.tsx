'use client'
// ApprenticeCreationWizard — modal that runs the Apprentice creation flow
// per spec-communities §2a / SRD §08 p.21. Triggered from the Apprentice
// NPC card by the master PC after a Moment-of-High-Insight recruit.
//
// Pre-wizard state (set on "Take as Apprentice" click in the recruit
// modal at app/stories/[id]/table/page.tsx):
//   - community_members.recruitment_type = 'apprentice'
//   - community_members.apprentice_of_character_id = <master PC id>
//   - community_members.apprentice_meta = {
//       motivation, motivation_roll, complication, complication_roll,
//       setup_complete: false,
//     }
//   - The Apprentice IS an existing campaign_npcs row.
//
// What this wizard does (5 steps):
//   1. Identity — name (default = NPC's current) + freeform background.
//      Locked Motivation + Complication chips at the top so the player
//      sees what they're working with — these are inherent character.
//   2. Paradigm — pick from PARADIGMS via <ParadigmPicker>. The picked
//      Paradigm seeds RAPID + skills with that Paradigm's baseline.
//   3. RAPID — spend 3 CDP across the 5 RAPID attributes. Each ▲ costs
//      1 CDP, max +4. Cannot reduce below the Paradigm baseline.
//   4. Skills — spend 5 CDP across all skills. 1 CDP per step
//      (skillStepUp). Cannot reduce below Paradigm baseline.
//   5. Confirm — summary card.
//
// Save flow:
//   - UPDATE campaign_npcs SET name, reason, acumen, physicality,
//     influence, dexterity, skills, notes (append).
//   - UPDATE community_members SET apprentice_meta = {
//       ...existing, paradigm, background,
//       setup_complete: true, setup_at: now,
//     }
//   - Append a progression_log entry on the master PC.
//   - onSaved() fires so the parent can refresh.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { appendProgressionEntry } from '../lib/progression-log'
import { PARADIGMS, type Paradigm, type AttributeName, SKILLS, type SkillValue } from '../lib/xse-schema'
import { skillStepUp, skillStepDown } from '../lib/xse-engine'
import ParadigmPicker from './ParadigmPicker'

type Step = 'identity' | 'paradigm' | 'rapid' | 'skills' | 'confirm'

const ATTR_ORDER: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<AttributeName, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity',
}

const RAPID_BUDGET = 3
const SKILL_BUDGET = 5
const RAPID_MAX = 4
const SKILL_MAX: SkillValue = 4

interface ApprenticeMeta {
  motivation: string
  motivation_roll: number
  complication: string
  complication_roll: number
  paradigm?: string
  background?: string
  setup_complete?: boolean
  setup_at?: string
}

interface Props {
  // Identifying the Apprentice + the master PC.
  communityMemberId: string         // community_members.id
  campaignNpcId: string             // the NPC (campaign_npcs.id) that IS the Apprentice
  npcCurrentName: string            // default seed for the name field
  masterCharacterId: string         // master PC's character id (for progression log)
  apprenticeMeta: ApprenticeMeta    // pre-wizard meta (locked M/C)
  // Lifecycle.
  onClose: () => void
  onSaved: () => void
}

export default function ApprenticeCreationWizard({
  communityMemberId, campaignNpcId, npcCurrentName, masterCharacterId,
  apprenticeMeta, onClose, onSaved,
}: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<Step>('identity')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Identity.
  const [name, setName] = useState(npcCurrentName)
  const [background, setBackground] = useState('')

  // Step 2: Paradigm.
  const [paradigm, setParadigm] = useState<Paradigm | null>(null)

  // Step 3: RAPID — Paradigm baseline + delta tracker. The delta is only
  // the CDP-spent increments above baseline; the saved value is
  // baseline + delta. Cap each attribute at RAPID_MAX.
  const [rapidDelta, setRapidDelta] = useState<Record<AttributeName, number>>(
    { RSN: 0, ACU: 0, PHY: 0, INF: 0, DEX: 0 },
  )
  const rapidSpent = useMemo(
    () => ATTR_ORDER.reduce((sum, k) => sum + rapidDelta[k], 0),
    [rapidDelta],
  )
  const finalRapid: Record<AttributeName, number> = useMemo(() => {
    const base = paradigm?.rapid ?? { RSN: 0, ACU: 0, PHY: 0, INF: 0, DEX: 0 }
    return {
      RSN: base.RSN + rapidDelta.RSN,
      ACU: base.ACU + rapidDelta.ACU,
      PHY: base.PHY + rapidDelta.PHY,
      INF: base.INF + rapidDelta.INF,
      DEX: base.DEX + rapidDelta.DEX,
    }
  }, [paradigm, rapidDelta])

  // Step 4: Skills — Paradigm baseline + delta tracker. Delta is the
  // count of CDP spent on each skill (each step costs 1 CDP via
  // skillStepUp). Total of all deltas can't exceed SKILL_BUDGET.
  // Vocational skills baseline at -3 (the schema default) unless the
  // Paradigm includes them.
  const [skillDelta, setSkillDelta] = useState<Record<string, number>>({})
  const skillSpent = useMemo(
    () => Object.values(skillDelta).reduce((sum, n) => sum + n, 0),
    [skillDelta],
  )
  // Per-skill final value: baseline (Paradigm or schema default) +
  // skillStepUp applied N times where N = skillDelta[name].
  function getSkillBase(skillName: string): SkillValue {
    if (paradigm) {
      const fromParadigm = paradigm.skills.find(s => s.skillName === skillName)
      if (fromParadigm) return fromParadigm.level
    }
    const def = SKILLS.find(s => s.name === skillName)
    return (def?.vocational ? -3 : 0) as SkillValue
  }
  function getSkillFinal(skillName: string): SkillValue {
    const base = getSkillBase(skillName)
    const def = SKILLS.find(s => s.name === skillName)
    const vocational = !!def?.vocational
    let val: SkillValue = base
    const steps = skillDelta[skillName] ?? 0
    for (let i = 0; i < steps; i++) val = skillStepUp(val, vocational)
    return val
  }

  // Step gating — Continue button enabled when the current step is "complete enough."
  const canContinueFromIdentity = name.trim().length > 0
  const canContinueFromParadigm = paradigm !== null
  const canContinueFromRapid = rapidSpent === RAPID_BUDGET
  const canContinueFromSkills = skillSpent === SKILL_BUDGET

  // ESC closes the modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  // ── Save flow ────────────────────────────────────────────────────
  async function handleSave() {
    if (!paradigm) return
    setSaving(true)
    setError(null)
    try {
      // Build the new skills jsonb shape that campaign_npcs expects.
      // Convention from existing NPC seeds: { entries: [{ name, level }] }.
      // Drop entries at default value (0 / -3) to keep the jsonb tight.
      const skillEntries = SKILLS.map(s => {
        const final = getSkillFinal(s.name)
        const def = (s.vocational ? -3 : 0) as SkillValue
        if (final === def) return null
        return { name: s.name, level: final }
      }).filter(Boolean)

      // Append motivation/complication/background as a structured note
      // block under any existing notes. Future-Claude or the GM can
      // edit this freely; we only append, never overwrite.
      const motivationLine = `Motivation: ${apprenticeMeta.motivation} (rolled ${apprenticeMeta.motivation_roll})`
      const complicationLine = `Complication: ${apprenticeMeta.complication} (rolled ${apprenticeMeta.complication_roll})`
      const backgroundBlock = background.trim()
        ? `Background: ${background.trim()}`
        : '(No background written.)'
      const apprenticeNoteBlock = [
        '── Apprentice ──',
        `Paradigm: ${paradigm.name} (${paradigm.profession})`,
        motivationLine,
        complicationLine,
        backgroundBlock,
      ].join('\n')

      // 1) Read the Apprentice's current campaign_npcs row to merge
      //    notes safely (don't blow away GM-authored notes).
      const { data: npcRow, error: readErr } = await supabase
        .from('campaign_npcs')
        .select('notes')
        .eq('id', campaignNpcId)
        .single()
      if (readErr) throw new Error(`read npc: ${readErr.message}`)
      const existingNotes = (npcRow?.notes ?? '').trim()
      const mergedNotes = existingNotes
        ? `${existingNotes}\n\n${apprenticeNoteBlock}`
        : apprenticeNoteBlock

      // 2) UPDATE campaign_npcs with the wizard outputs.
      const { error: npcErr } = await supabase
        .from('campaign_npcs')
        .update({
          name: name.trim(),
          reason: finalRapid.RSN,
          acumen: finalRapid.ACU,
          physicality: finalRapid.PHY,
          influence: finalRapid.INF,
          dexterity: finalRapid.DEX,
          skills: { entries: skillEntries },
          notes: mergedNotes,
        })
        .eq('id', campaignNpcId)
      if (npcErr) throw new Error(`update npc: ${npcErr.message}`)

      // 3) UPDATE community_members.apprentice_meta — flip
      //    setup_complete + persist Paradigm + background.
      const newMeta: ApprenticeMeta = {
        ...apprenticeMeta,
        paradigm: paradigm.name,
        background: background.trim(),
        setup_complete: true,
        setup_at: new Date().toISOString(),
      }
      const { error: cmErr } = await supabase
        .from('community_members')
        .update({ apprentice_meta: newMeta })
        .eq('id', communityMemberId)
      if (cmErr) throw new Error(`update community_member: ${cmErr.message}`)

      // 4) Progression log on the master PC — this is a memorable life
      //    moment per the curation rule.
      void appendProgressionEntry(
        supabase,
        masterCharacterId,
        'community',
        `⭐ Apprentice ${name.trim()} set up — ${paradigm.name} (${paradigm.profession}).`,
      )

      onSaved()
    } catch (err: any) {
      setError(err?.message ?? 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div onClick={!saving ? onClose : undefined}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        zIndex: 10100, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '20px',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1a1a', border: '1px solid #5a2e5a', borderRadius: '4px',
          width: '720px', maxWidth: '100%', maxHeight: 'calc(100vh - 40px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>
              ⭐ Apprentice Creation
            </div>
            <div style={{ fontSize: '17px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>
              {npcCurrentName}
            </div>
          </div>
          <button onClick={!saving ? onClose : undefined}
            style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: saving ? 'not-allowed' : 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Step pip strip */}
        <div style={{ display: 'flex', gap: '4px', padding: '8px 18px', borderBottom: '1px solid #2e2e2e' }}>
          {(['identity', 'paradigm', 'rapid', 'skills', 'confirm'] as Step[]).map((s, i) => {
            const isCurrent = s === step
            const ord = ['identity', 'paradigm', 'rapid', 'skills', 'confirm'].indexOf(step)
            const isPast = i < ord
            return (
              <div key={s}
                style={{
                  flex: 1, height: '4px', borderRadius: '2px',
                  background: isCurrent ? '#d48bd4' : isPast ? '#5a2e5a' : '#2e2e2e',
                }} />
            )
          })}
        </div>

        {/* Body */}
        <div style={{ padding: '18px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Locked Motivation + Complication banner — visible on every step */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ padding: '6px 10px', background: '#2a1a3e', border: '1px solid #5a2e5a', borderRadius: '3px', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
              <span style={{ color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.06em' }}>Motivation</span>
              <span style={{ marginLeft: '6px', color: '#d48bd4', fontWeight: 600 }}>{apprenticeMeta.motivation}</span>
              <span style={{ marginLeft: '6px', color: '#5a5550', fontSize: '13px' }}>(rolled {apprenticeMeta.motivation_roll})</span>
            </div>
            <div style={{ padding: '6px 10px', background: '#2a1a3e', border: '1px solid #5a2e5a', borderRadius: '3px', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
              <span style={{ color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.06em' }}>Complication</span>
              <span style={{ marginLeft: '6px', color: '#d48bd4', fontWeight: 600 }}>{apprenticeMeta.complication}</span>
              <span style={{ marginLeft: '6px', color: '#5a5550', fontSize: '13px' }}>(rolled {apprenticeMeta.complication_roll})</span>
            </div>
          </div>

          {/* Step 1 — Identity */}
          {step === 'identity' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                  Defaults to the NPC's current name. Edit if you want a fresh feel — the master PC may have given them a nickname.
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Background — Fill In The Gaps</label>
                <textarea value={background} onChange={e => setBackground(e.target.value)} rows={5}
                  placeholder="Where did they come from? How did they end up with the master PC? What's their unspoken hope?"
                  style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', resize: 'vertical' }} />
                <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                  Optional but encouraged. Per SRD §08 p.21 the master PC + GM "Fill In The Gaps" together — anchor the Apprentice in the world.
                </div>
              </div>
            </>
          )}

          {/* Step 2 — Paradigm */}
          {step === 'paradigm' && (
            <>
              <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                Pick a setting-appropriate Paradigm. The Apprentice inherits its RAPID baseline + skill list; you'll tune from there with 3 CDP RAPID + 5 CDP skill spends.
              </div>
              <ParadigmPicker value={paradigm?.name ?? null} onChange={p => {
                setParadigm(p)
                // Reset CDP deltas if Paradigm changes — baselines moved
                // so any previous spend is no longer valid.
                setRapidDelta({ RSN: 0, ACU: 0, PHY: 0, INF: 0, DEX: 0 })
                setSkillDelta({})
              }} />
            </>
          )}

          {/* Step 3 — RAPID spend */}
          {step === 'rapid' && paradigm && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                  Spend <strong style={{ color: '#d48bd4' }}>3 CDP</strong> on RAPID. Each ▲ adds +1 (max +{RAPID_MAX}). Cannot reduce below the {paradigm.name} baseline.
                </div>
                <div style={{ fontSize: '13px', fontFamily: 'Carlito, sans-serif', color: rapidSpent === RAPID_BUDGET ? '#7fc458' : '#EF9F27', fontWeight: 600 }}>
                  {RAPID_BUDGET - rapidSpent} CDP remaining
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {ATTR_ORDER.map(k => {
                  const base = paradigm.rapid[k]
                  const final = finalRapid[k]
                  const delta = rapidDelta[k]
                  const canInc = rapidSpent < RAPID_BUDGET && final < RAPID_MAX
                  const canDec = delta > 0
                  return (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px' }}>
                      <span style={{ width: '120px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{ATTR_FULL[k]}</span>
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>base {base >= 0 ? '+' : ''}{base}</span>
                      <span style={{ flex: 1 }} />
                      <button onClick={() => canDec && setRapidDelta(d => ({ ...d, [k]: d[k] - 1 }))} disabled={!canDec}
                        style={{ padding: '2px 8px', background: canDec ? '#1a1a1a' : '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '3px', color: canDec ? '#f5a89a' : '#3a3a3a', cursor: canDec ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>▼</button>
                      <span style={{ minWidth: '28px', textAlign: 'center', fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 700 }}>
                        {final >= 0 ? '+' : ''}{final}
                      </span>
                      <button onClick={() => canInc && setRapidDelta(d => ({ ...d, [k]: d[k] + 1 }))} disabled={!canInc}
                        style={{ padding: '2px 8px', background: canInc ? '#1a2e10' : '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '3px', color: canInc ? '#7fc458' : '#3a3a3a', cursor: canInc ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>▲</button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 4 — Skills spend */}
          {step === 'skills' && paradigm && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                  Spend <strong style={{ color: '#d48bd4' }}>5 CDP</strong> on skills. Each ▲ steps the skill up by one tier (vocational -3 → 1 costs 1 CDP).
                </div>
                <div style={{ fontSize: '13px', fontFamily: 'Carlito, sans-serif', color: skillSpent === SKILL_BUDGET ? '#7fc458' : '#EF9F27', fontWeight: 600 }}>
                  {SKILL_BUDGET - skillSpent} CDP remaining
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '420px', overflowY: 'auto', padding: '4px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                {SKILLS.map(s => {
                  const base = getSkillBase(s.name)
                  const final = getSkillFinal(s.name)
                  const delta = skillDelta[s.name] ?? 0
                  const canInc = skillSpent < SKILL_BUDGET && final < SKILL_MAX
                  const canDec = delta > 0
                  return (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', background: '#1a1a1a', borderRadius: '2px' }}>
                      <span style={{ flex: 1, fontSize: '13px', color: final > base ? '#7fc458' : '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>{s.name}</span>
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', minWidth: '50px', textAlign: 'right' }}>base {base}</span>
                      <button onClick={() => canDec && setSkillDelta(d => ({ ...d, [s.name]: (d[s.name] ?? 0) - 1 }))} disabled={!canDec}
                        style={{ padding: '1px 6px', background: canDec ? '#1a1a1a' : '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '2px', color: canDec ? '#f5a89a' : '#3a3a3a', cursor: canDec ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>▼</button>
                      <span style={{ minWidth: '24px', textAlign: 'center', fontSize: '14px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 700 }}>{final}</span>
                      <button onClick={() => canInc && setSkillDelta(d => ({ ...d, [s.name]: (d[s.name] ?? 0) + 1 }))} disabled={!canInc}
                        style={{ padding: '1px 6px', background: canInc ? '#1a2e10' : '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '2px', color: canInc ? '#7fc458' : '#3a3a3a', cursor: canInc ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>▲</button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 5 — Confirm */}
          {step === 'confirm' && paradigm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '10px 12px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Identity</div>
                <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>{paradigm.name} ({paradigm.profession})</div>
                {background.trim() && (
                  <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginTop: '6px', whiteSpace: 'pre-wrap' }}>{background.trim()}</div>
                )}
              </div>
              <div style={{ padding: '10px 12px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>RAPID</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {ATTR_ORDER.map(k => (
                    <span key={k} style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>
                      {k} {finalRapid[k] >= 0 ? '+' : ''}{finalRapid[k]}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Skills</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {SKILLS.filter(s => getSkillFinal(s.name) > (s.vocational ? -3 : 0)).map(s => {
                    const final = getSkillFinal(s.name)
                    const base = getSkillBase(s.name)
                    const grew = final > base
                    return (
                      <span key={s.name} style={{ padding: '2px 6px', background: grew ? '#1a2e10' : '#242424', border: `1px solid ${grew ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '2px', fontSize: '13px', color: grew ? '#7fc458' : '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
                        {s.name} {final}
                      </span>
                    )
                  })}
                </div>
              </div>
              {error && (
                <div style={{ padding: '8px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
                  Save failed: {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — Back / Continue / Save */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => {
            if (step === 'identity') onClose()
            else if (step === 'paradigm') setStep('identity')
            else if (step === 'rapid') setStep('paradigm')
            else if (step === 'skills') setStep('rapid')
            else if (step === 'confirm') setStep('skills')
          }} disabled={saving}
            style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.4 : 1 }}>
            {step === 'identity' ? 'Cancel' : '← Back'}
          </button>

          {step !== 'confirm' && (
            <button onClick={() => {
              if (step === 'identity' && canContinueFromIdentity) setStep('paradigm')
              else if (step === 'paradigm' && canContinueFromParadigm) setStep('rapid')
              else if (step === 'rapid' && canContinueFromRapid) setStep('skills')
              else if (step === 'skills' && canContinueFromSkills) setStep('confirm')
            }}
              disabled={
                (step === 'identity' && !canContinueFromIdentity) ||
                (step === 'paradigm' && !canContinueFromParadigm) ||
                (step === 'rapid' && !canContinueFromRapid) ||
                (step === 'skills' && !canContinueFromSkills)
              }
              style={{
                padding: '8px 18px', background: '#2a102a', border: '1px solid #5a2e5a',
                borderRadius: '3px', color: '#d48bd4', fontSize: '14px',
                fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
                fontWeight: 600,
                cursor: 'pointer', opacity: 1,
              }}>
              Continue →
            </button>
          )}

          {step === 'confirm' && (
            <button onClick={handleSave} disabled={saving}
              style={{
                padding: '8px 18px', background: '#1a2e10', border: '1px solid #2d5a1b',
                borderRadius: '3px', color: '#7fc458', fontSize: '14px',
                fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
              }}>
              {saving ? 'Saving…' : '✓ Save Apprentice'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
