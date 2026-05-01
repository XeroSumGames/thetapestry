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
//       age, three_words, setup_complete: false,
//     }
//   - The Apprentice IS an existing campaign_npcs row.
//
// What this wizard does (5 steps):
//   1. Identity — name + age + three trait words + freeform background.
//      Locked Motivation + Complication chips at the top so the player
//      sees what they're working with — these are inherent character.
//   2. Profession — pick from PROFESSIONS via <ProfessionPicker>. Each
//      profession skill auto-seeds at +1 CDP (vocational -3 → -1,
//      non-vocational 0 → 1). Profession does NOT seed RAPID.
//   3. RAPID — spend 3 CDP across the 5 RAPID attributes. Each ▲ costs
//      1 CDP, max +4. Baseline is 0 across the board.
//   4. Skills — spend 5 CDP across all skills on top of the profession
//      seeding. Per-skill cap = min(SKILL_MAX, master_PC.skill - 1)
//      per SRD §08 p.21 ("can train up to your skill - 1").
//   5. Confirm — summary card.
//
// Save flow:
//   - UPDATE campaign_npcs SET name, reason, acumen, physicality,
//     influence, dexterity, skills, notes (append).
//   - UPDATE community_members SET apprentice_meta = {
//       ...existing, profession, age, three_words, background,
//       setup_complete: true, setup_at: now,
//     }
//   - Append a progression_log entry on the master PC.
//   - onSaved() fires so the parent can refresh.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { appendProgressionEntry } from '../lib/progression-log'
import { PROFESSIONS, type ProfessionDefinition, type AttributeName, SKILLS, type SkillValue } from '../lib/xse-schema'
import { skillStepUp } from '../lib/xse-engine'
import ProfessionPicker from './ProfessionPicker'

type Step = 'identity' | 'profession' | 'rapid' | 'skills' | 'confirm'

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
  age?: number
  three_words?: [string, string, string] | string[]
  profession?: string
  paradigm?: string  // legacy field — older Apprentices were Paradigm-based.
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
  apprenticeMeta: ApprenticeMeta    // pre-wizard meta (locked M/C, age, 3 words)
  // Lifecycle.
  onClose: () => void
  onSaved: () => void
}

// Map a profession-skill name (with optional trailing *) back to the
// canonical SKILLS entry name (no asterisk) and a vocational flag.
function normalizeProfessionSkill(skill: string): { name: string; vocational: boolean } {
  const vocational = skill.endsWith('*')
  const name = vocational ? skill.slice(0, -1) : skill
  return { name, vocational }
}

export default function ApprenticeCreationWizard({
  communityMemberId, campaignNpcId, npcCurrentName, masterCharacterId,
  apprenticeMeta, onClose, onSaved,
}: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<Step>('identity')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Identity. Pre-fill from the recruit-time roll.
  const [name, setName] = useState(npcCurrentName)
  const [age, setAge] = useState<number>(apprenticeMeta.age ?? 25)
  const incomingWords = Array.isArray(apprenticeMeta.three_words) ? apprenticeMeta.three_words : []
  const [threeWords, setThreeWords] = useState<[string, string, string]>([
    incomingWords[0] ?? '', incomingWords[1] ?? '', incomingWords[2] ?? '',
  ])
  const [background, setBackground] = useState('')

  // Step 2: Profession.
  const [profession, setProfession] = useState<ProfessionDefinition | null>(null)

  // Step 3: RAPID — Profession does NOT seed RAPID per spec. Baseline 0.
  const [rapidDelta, setRapidDelta] = useState<Record<AttributeName, number>>(
    { RSN: 0, ACU: 0, PHY: 0, INF: 0, DEX: 0 },
  )
  const rapidSpent = useMemo(
    () => ATTR_ORDER.reduce((sum, k) => sum + rapidDelta[k], 0),
    [rapidDelta],
  )
  const finalRapid: Record<AttributeName, number> = useMemo(() => ({
    RSN: rapidDelta.RSN, ACU: rapidDelta.ACU, PHY: rapidDelta.PHY,
    INF: rapidDelta.INF, DEX: rapidDelta.DEX,
  }), [rapidDelta])

  // Step 4: Skills — Profession seeds 1 CDP into each of its 5 skills.
  // Player adds 5 more CDP via the stepper. Per-skill SRD cap kicks in
  // on top of both. The delta tracks ONLY the player's additional CDP
  // — the profession seeding is an implicit baseline.
  const [skillDelta, setSkillDelta] = useState<Record<string, number>>({})
  const skillSpent = useMemo(
    () => Object.values(skillDelta).reduce((sum, n) => sum + n, 0),
    [skillDelta],
  )

  // The profession's skill seeding — 1 CDP applied to each of its 5
  // skills, computed via skillStepUp from the schema default.
  const professionSeed = useMemo<Record<string, SkillValue>>(() => {
    const out: Record<string, SkillValue> = {}
    if (!profession) return out
    for (const raw of profession.skills) {
      const { name, vocational } = normalizeProfessionSkill(raw)
      const def = (vocational ? -3 : 0) as SkillValue
      out[name] = skillStepUp(def, vocational)
    }
    return out
  }, [profession])

  function getSkillBase(skillName: string): SkillValue {
    if (skillName in professionSeed) return professionSeed[skillName]
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

  // Master PC's skill levels — drives the SRD §08 p.21 per-skill cap
  // (Apprentice can be trained "up to PC skill level − 1" in any single
  // skill the PC has). PCs store skills as data.skills[].skillName/level.
  // Skills the PC doesn't have at level >= 1 can't be trained at all
  // (cap goes negative, which clips deltas to 0).
  const [masterSkills, setMasterSkills] = useState<Record<string, number>>({})
  const [masterPcLoaded, setMasterPcLoaded] = useState(false)
  // Surface load failures so the user understands why every skill cap
  // shows "untrainable" — silent failure here looked like a broken wizard.
  const [masterPcLoadError, setMasterPcLoadError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('characters')
        .select('data')
        .eq('id', masterCharacterId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setMasterPcLoadError(error.message)
        setMasterPcLoaded(true)
        return
      }
      if (!data) {
        setMasterPcLoadError('master character not found')
        setMasterPcLoaded(true)
        return
      }
      const skills: Array<{ skillName: string; level: number }> = (data as any)?.data?.skills ?? []
      const map: Record<string, number> = {}
      for (const s of skills) map[s.skillName] = s.level
      setMasterSkills(map)
      setMasterPcLoaded(true)
    })()
    return () => { cancelled = true }
  }, [supabase, masterCharacterId])

  function getSkillCap(skillName: string): number {
    const def = SKILLS.find(s => s.name === skillName)
    const pcLevel = masterSkills[skillName] ?? (def?.vocational ? -3 : 0)
    return Math.min(SKILL_MAX, pcLevel - 1)
  }

  // Step gating — Continue button enabled when the current step is "complete enough."
  const canContinueFromIdentity = name.trim().length > 0 && age > 0 && threeWords.every(w => w.trim().length > 0)
  const canContinueFromProfession = profession !== null
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
    if (!profession) return
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

      // Append motivation/complication/3 words/background as a structured
      // note block under any existing notes. Future-Claude or the GM can
      // edit this freely; we only append, never overwrite.
      const motivationLine = `Motivation: ${apprenticeMeta.motivation} (rolled ${apprenticeMeta.motivation_roll})`
      const complicationLine = `Complication: ${apprenticeMeta.complication} (rolled ${apprenticeMeta.complication_roll})`
      const wordsLine = `Three Words: ${threeWords.map(w => w.trim()).filter(Boolean).join(' / ')}`
      const ageLine = `Age: ${age}`
      const backgroundBlock = background.trim()
        ? `Background: ${background.trim()}`
        : '(No background written.)'
      const apprenticeNoteBlock = [
        '── Apprentice ──',
        `Profession: ${profession.name}`,
        ageLine,
        wordsLine,
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
      //    setup_complete + persist Profession + age + words + background.
      const newMeta: ApprenticeMeta = {
        ...apprenticeMeta,
        profession: profession.name,
        age,
        three_words: [threeWords[0].trim(), threeWords[1].trim(), threeWords[2].trim()] as [string, string, string],
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
        `⭐ Apprentice ${name.trim()} set up — ${profession.name} (age ${age}).`,
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
          {(['identity', 'profession', 'rapid', 'skills', 'confirm'] as Step[]).map((s, i) => {
            const isCurrent = s === step
            const ord = ['identity', 'profession', 'rapid', 'skills', 'confirm'].indexOf(step)
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
              <div style={{ padding: '8px 12px', background: '#0f1a2e', border: '1px solid #1a3a5c', borderRadius: '3px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.4 }}>
                <strong style={{ color: '#7ab3d4' }}>Game time:</strong> per SRD §08 p.21 the Apprentice ritual represents <strong>1 month</strong> of in-game time — the master PC training them in skills they have, while the Apprentice settles into the community. Advance your campaign clock accordingly.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Name</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
                </div>
                <div style={{ width: '110px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Age</label>
                  <input type="number" min={1} max={120} value={age}
                    onChange={e => setAge(Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)))}
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', textAlign: 'center', fontWeight: 700 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Three Words</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0, 1, 2].map(i => (
                    <input key={i} value={threeWords[i]}
                      onChange={e => {
                        const next: [string, string, string] = [...threeWords] as [string, string, string]
                        next[i] = e.target.value
                        setThreeWords(next)
                      }}
                      placeholder={['First', 'Second', 'Third'][i]}
                      style={{ flex: 1, padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
                  ))}
                </div>
                <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                  Three trait words that capture this Apprentice. Auto-rolled at recruit time; edit freely.
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Background — Fill In The Gaps</label>
                <textarea value={background} onChange={e => setBackground(e.target.value)} rows={4}
                  placeholder="Where did they come from? How did they end up with the master PC? What's their unspoken hope?"
                  style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', resize: 'vertical' }} />
                <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                  Optional but encouraged. Per SRD §08 p.21 the master PC + GM "Fill In The Gaps" together — anchor the Apprentice in the world.
                </div>
              </div>
            </>
          )}

          {/* Step 2 — Profession */}
          {step === 'profession' && (
            <>
              <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                Pick a setting-appropriate Profession. Each of its 5 skills auto-seeds at <strong style={{ color: '#7fc458' }}>+1 CDP</strong> — vocational skills go from -3 → -1, non-vocational from 0 → +1. You then spend 3 CDP on RAPID + 5 more on skills.
              </div>
              <ProfessionPicker value={profession?.name ?? null} onChange={p => {
                setProfession(p)
                // Reset skill deltas when profession changes — the
                // baseline shifts so any previous spend is no longer
                // valid against the new caps.
                setSkillDelta({})
              }} />
            </>
          )}

          {/* Step 3 — RAPID spend */}
          {step === 'rapid' && profession && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                  Spend <strong style={{ color: '#d48bd4' }}>3 CDP</strong> on RAPID. Each ▲ adds +1 (max +{RAPID_MAX}). Profession does not seed RAPID — start from 0.
                </div>
                <div style={{ fontSize: '13px', fontFamily: 'Carlito, sans-serif', color: rapidSpent === RAPID_BUDGET ? '#7fc458' : '#EF9F27', fontWeight: 600 }}>
                  {RAPID_BUDGET - rapidSpent} CDP remaining
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {ATTR_ORDER.map(k => {
                  const final = finalRapid[k]
                  const delta = rapidDelta[k]
                  const canInc = rapidSpent < RAPID_BUDGET && final < RAPID_MAX
                  const canDec = delta > 0
                  return (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px' }}>
                      <span style={{ width: '120px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{ATTR_FULL[k]}</span>
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
          {step === 'skills' && profession && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                  Spend <strong style={{ color: '#d48bd4' }}>5 CDP</strong> on skills. Each ▲ steps the skill up by one tier on top of the {profession.name} baseline.
                </div>
                <div style={{ fontSize: '13px', fontFamily: 'Carlito, sans-serif', color: skillSpent === SKILL_BUDGET ? '#7fc458' : '#EF9F27', fontWeight: 600 }}>
                  {SKILL_BUDGET - skillSpent} CDP remaining
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', padding: '6px 10px', background: '#0f1a2e', border: '1px solid #1a3a5c', borderRadius: '3px', lineHeight: 1.4 }}>
                <strong style={{ color: '#7ab3d4' }}>SRD training cap:</strong> per SRD §08 p.21 you can only train your Apprentice up to <strong>your skill − 1</strong> in any given skill. Skills you don&apos;t have can&apos;t be trained — the Profession baseline still stands. Loading master PC: {masterPcLoadError ? <span style={{ color: '#f5a89a' }}>failed — {masterPcLoadError}</span> : masterPcLoaded ? <span style={{ color: '#7fc458' }}>ready</span> : <span style={{ color: '#EF9F27' }}>fetching…</span>}.
              </div>
              {masterPcLoadError && (
                <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', padding: '6px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', lineHeight: 1.4 }}>
                  Couldn&apos;t load the master PC&apos;s skill list, so every skill is currently capped untrainable. Close this wizard and try again, or reload the page.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '420px', overflowY: 'auto', padding: '4px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                {SKILLS.map(s => {
                  const base = getSkillBase(s.name)
                  const final = getSkillFinal(s.name)
                  const delta = skillDelta[s.name] ?? 0
                  const def = s
                  const pcLevel = masterSkills[s.name] ?? (def.vocational ? -3 : 0)
                  const cap = getSkillCap(s.name)
                  const trainable = cap >= (def.vocational ? -1 : 0)
                  const inProfession = s.name in professionSeed
                  const canInc = masterPcLoaded && skillSpent < SKILL_BUDGET && final < cap
                  const canDec = delta > 0
                  return (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', background: '#1a1a1a', borderRadius: '2px', opacity: trainable ? 1 : 0.55 }}>
                      <span style={{ flex: 1, fontSize: '13px', color: final > base ? '#7fc458' : '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
                        {s.name}{inProfession && <span style={{ marginLeft: '4px', color: '#d48bd4', fontSize: '13px' }}>★</span>}
                      </span>
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', minWidth: '50px', textAlign: 'right' }}
                        title={inProfession ? `${profession.name} seed: ${base}` : 'Not seeded by profession'}>
                        base {base}
                      </span>
                      <span style={{ fontSize: '13px', color: trainable ? '#7ab3d4' : '#5a5550', fontFamily: 'Carlito, sans-serif', minWidth: '60px', textAlign: 'right' }}
                        title={trainable
                          ? `Master PC has ${s.name} ${pcLevel}; cap = ${cap}`
                          : `Master PC doesn't have ${s.name} — can't train`}>
                        {trainable ? `cap ${cap}` : 'untrainable'}
                      </span>
                      <button onClick={() => canDec && setSkillDelta(d => ({ ...d, [s.name]: (d[s.name] ?? 0) - 1 }))} disabled={!canDec}
                        style={{ padding: '1px 6px', background: canDec ? '#1a1a1a' : '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '2px', color: canDec ? '#f5a89a' : '#3a3a3a', cursor: canDec ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>▼</button>
                      <span style={{ minWidth: '24px', textAlign: 'center', fontSize: '14px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 700 }}>{final}</span>
                      <button onClick={() => canInc && setSkillDelta(d => ({ ...d, [s.name]: (d[s.name] ?? 0) + 1 }))} disabled={!canInc}
                        title={!masterPcLoaded ? 'Loading master PC…'
                          : !trainable ? 'Master PC doesn\'t have this skill — can\'t train'
                          : final >= cap ? `At training cap (${cap}) — your skill is ${pcLevel}`
                          : skillSpent >= SKILL_BUDGET ? 'Out of CDP'
                          : 'Step up'}
                        style={{ padding: '1px 6px', background: canInc ? '#1a2e10' : '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '2px', color: canInc ? '#7fc458' : '#3a3a3a', cursor: canInc ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>▲</button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 5 — Confirm */}
          {step === 'confirm' && profession && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '10px 12px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Identity</div>
                <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 600 }}>{name} <span style={{ color: '#5a5550', fontWeight: 400, fontSize: '13px' }}>· age {age}</span></div>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>{profession.name}</div>
                <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', marginTop: '4px', letterSpacing: '.04em' }}>
                  {threeWords.map(w => w.trim()).filter(Boolean).join(' · ')}
                </div>
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
            else if (step === 'profession') setStep('identity')
            else if (step === 'rapid') setStep('profession')
            else if (step === 'skills') setStep('rapid')
            else if (step === 'confirm') setStep('skills')
          }} disabled={saving}
            style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.4 : 1 }}>
            {step === 'identity' ? 'Cancel' : '← Back'}
          </button>

          {step !== 'confirm' && (
            <button onClick={() => {
              if (step === 'identity' && canContinueFromIdentity) setStep('profession')
              else if (step === 'profession' && canContinueFromProfession) setStep('rapid')
              else if (step === 'rapid' && canContinueFromRapid) setStep('skills')
              else if (step === 'skills' && canContinueFromSkills) setStep('confirm')
            }}
              disabled={
                (step === 'identity' && !canContinueFromIdentity) ||
                (step === 'profession' && !canContinueFromProfession) ||
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
