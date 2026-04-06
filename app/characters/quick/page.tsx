'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { logFirstEvent } from '../../../lib/events'
import {
  createWizardState, WizardState, buildCharacter,
  skillStepUp, getCumulativeSkills
} from '../../../lib/xse-engine'
import PrintSheet from '../../../components/wizard/PrintSheet'
import {
  SKILLS, ATTRIBUTE_LABELS, SKILL_LABELS,
  AttributeName, SkillValue, PROFESSIONS
} from '../../../lib/xse-schema'
import StepXero from '../../../components/wizard/StepXero'
import StepSix from '../../../components/wizard/StepSix'
import StepSeven from '../../../components/wizard/StepSeven'
import StepEight from '../../../components/wizard/StepEight'
import StepNine from '../../../components/wizard/StepNine'

const ATTR_KEYS: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<AttributeName, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity'
}

const ATTR_BUDGET = 5
const SKILL_BUDGET = 15
const MAX_ATTR = 3   // Exceptional
const MAX_SKILL = 3  // Professional

const QUICK_STEPS = [
  { num: 0, title: 'Character Concept' },
  { num: 1, title: 'Quick Build' },
  { num: 2, title: 'What Drives Them?' },
  { num: 3, title: 'Secondary Stats' },
  { num: 4, title: 'What They Have' },
  { num: 5, title: 'Final Review' },
]

export default function QuickCharacterPage() {
  const router = useRouter()
  const [state, setState] = useState<WizardState>(createWizardState)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [profession, setProfession] = useState('')

  // Quick build state � stored in steps[3] (profession step equivalent)
  const attrSpent: Partial<Record<AttributeName, number>> = state.steps[3].attrSpent ?? {}
  const skillDeltas: Partial<Record<string, number>> = state.steps[3].skillDeltas ?? {}
  const skillCDPMap: Partial<Record<string, number>> = state.steps[3].skillCDPMap ?? {}

  const attrCDPSpent = Object.values(attrSpent).reduce((a, b) => a + (b ?? 0), 0)
  const skillCDPSpent = state.steps[3].skillCDPSpent ?? 0

  function updateBuild(patch: { attrSpent?: Partial<Record<AttributeName, number>>, skillDeltas?: Partial<Record<string, number>>, skillCDPMap?: Partial<Record<string, number>>, skillCDPSpent?: number, profession?: string }) {
    const newSteps = [...state.steps]
    newSteps[3] = { ...state.steps[3], ...patch }
    setState(prev => ({ ...prev, steps: newSteps }))
  }

  function changeAttr(key: AttributeName, dir: 1 | -1) {
    const current = attrSpent[key] ?? 0
    if (dir === 1) {
      if (attrCDPSpent >= ATTR_BUDGET) return
      if (current >= MAX_ATTR) return
      updateBuild({ attrSpent: { ...attrSpent, [key]: current + 1 } })
    } else {
      if (current <= 0) return
      const newSpent = { ...attrSpent, [key]: current - 1 }
      if (newSpent[key] === 0) delete newSpent[key]
      updateBuild({ attrSpent: newSpent })
    }
  }

  function changeSkill(skillName: string, dir: 1 | -1) {
    const skill = SKILLS.find(s => s.name === skillName)!
    const allSkills = getCumulativeSkills(state.steps)
    const cumVal = allSkills[skillName]
    const cdpThisSkill = skillCDPMap[skillName] ?? 0
    const newDeltas = { ...skillDeltas }
    const newCDPMap = { ...skillCDPMap }

    if (dir === 1) {
      if (skillCDPSpent >= SKILL_BUDGET) return
      const next = skillStepUp(cumVal, skill.vocational)
      if (next > MAX_SKILL) return
      const gain = next - cumVal
      newDeltas[skillName] = (newDeltas[skillName] ?? 0) + gain
      newCDPMap[skillName] = cdpThisSkill + 1
      updateBuild({ skillDeltas: newDeltas, skillCDPSpent: skillCDPSpent + 1, skillCDPMap: newCDPMap })
    } else {
      if (cdpThisSkill <= 0) return
      const prev = skillStepUp((cumVal - 1) as SkillValue, skill.vocational)
      const loss = cumVal - prev
      newDeltas[skillName] = (newDeltas[skillName] ?? 0) - loss
      if ((newDeltas[skillName] ?? 0) <= 0) delete newDeltas[skillName]
      newCDPMap[skillName] = cdpThisSkill - 1
      if (newCDPMap[skillName] <= 0) delete newCDPMap[skillName]
      updateBuild({ skillDeltas: newDeltas, skillCDPSpent: Math.max(0, skillCDPSpent - 1), skillCDPMap: newCDPMap })
    }
  }

  function handleChange(updated: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...updated }))
  }

  // Map quick wizard step to actual wizard step for reused components
  function wizardStep(): number {
    // step 0=concept(0), 1=quickbuild, 2=drives(6), 3=secondary(7), 4=gear(8), 5=review(9)
    if (step === 2) return 6
    if (step === 3) return 7
    if (step === 4) return 8
    if (step === 5) return 9
    return step
  }

  function syncProfession(p: string) {
    setProfession(p)
    const newSteps = [...state.steps]
    newSteps[3] = { ...state.steps[3], profession: p }
    setState(prev => ({ ...prev, steps: newSteps }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveError('Not logged in.'); setSaving(false); return }
    const character = buildCharacter(state)
    character.creationMethod = 'backstory'
    const { error } = await supabase.from('characters').insert({
      user_id: user.id,
      name: character.name || 'Unnamed Character',
      data: character,
    })
    if (error) { setSaveError(error.message); setSaving(false); return }
    logFirstEvent('first_character_created', { name: character.name })
    setSaved(true)
    setSaving(false)
  }

  function handlePrint() {
    window.print()
  }

  const allSkills = getCumulativeSkills(state.steps)
  const filteredSkills = SKILLS.filter(s =>
    !skillFilter ||
    s.name.toLowerCase().includes(skillFilter.toLowerCase()) ||
    s.attribute.toLowerCase().includes(skillFilter.toLowerCase())
  )
  const vocProfession = PROFESSIONS.find(p => p.name === profession)

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Quick Character Creation
        </div>
        <div style={{ fontSize: '11px', color: '#d4cfc9', letterSpacing: '.1em', textTransform: 'uppercase', flex: 1, textAlign: 'right' }}>
          20 CDP � No Life-Stage Structure
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '1.25rem' }}>
        {QUICK_STEPS.map((s, i) => (
          <button key={i} onClick={() => { setStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{ width: '28px', height: '28px', borderRadius: '50%', border: `1px solid ${i === step ? '#c0392b' : '#3a3a3a'}`, background: i < step ? '#c0392b' : i === step ? '#2a1210' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700, color: i < step ? '#fff' : i === step ? '#c0392b' : '#d4cfc9', flexShrink: 0, cursor: 'pointer', padding: 0 }}>
            {i}
          </button>
        ))}
      </div>

      {/* Step card */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem', borderLeft: '3px solid #c0392b' }}>
        <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '3px' }}>
          Step {step} of 5
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '8px', color: '#f5f2ee' }}>
          {QUICK_STEPS[step].title}
        </div>
      </div>

      {/* Step content */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }}>

        {step === 0 && <StepXero state={state} onChange={handleChange} />}

        {step === 1 && (
          <div>
            <p style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.7, marginBottom: '1rem' }}>
              Spend <strong style={{ color: '#f5f2ee' }}>5 CDP</strong> on attributes and <strong style={{ color: '#f5f2ee' }}>15 CDP</strong> on skills freely. No life-stage restrictions. Max attribute: Exceptional (+3). Max skill: Professional (+3).
            </p>

            {/* Profession picker */}
            <div style={sh}>Profession (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '1.25rem' }}>
              {PROFESSIONS.map(p => (
                <div key={p.name} onClick={() => syncProfession(profession === p.name ? '' : p.name)}
                  style={{ padding: '6px 8px', borderRadius: '3px', fontSize: '12px', cursor: 'pointer', textAlign: 'center', border: `1px solid ${profession === p.name ? '#c0392b' : '#2e2e2e'}`, background: profession === p.name ? '#2a1210' : '#242424', color: profession === p.name ? '#f5a89a' : '#f5f2ee', fontWeight: profession === p.name ? 600 : 400 }}>
                  {p.name}
                </div>
              ))}
            </div>

            {/* Attribute spend */}
            <div style={sh}>Attributes � {ATTR_BUDGET - attrCDPSpent} CDP remaining</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#242424', borderRadius: '3px', padding: '8px 12px', marginBottom: '10px', border: '1px solid #2e2e2e' }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {Array.from({ length: ATTR_BUDGET }).map((_, i) => (
                  <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', border: `1px solid ${i < attrCDPSpent ? '#c0392b' : '#3a3a3a'}`, background: i < attrCDPSpent ? '#c0392b' : '#0f0f0f' }} />
                ))}
              </div>
              <span style={{ fontSize: '12px', color: '#f5f2ee', flex: 1 }}>Attribute CDP</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: attrCDPSpent >= ATTR_BUDGET ? '#f5a89a' : '#f5f2ee' }}>{ATTR_BUDGET - attrCDPSpent} left</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '1.25rem' }}>
              {ATTR_KEYS.map(k => {
                const val = attrSpent[k] ?? 0
                const canInc = attrCDPSpent < ATTR_BUDGET && val < MAX_ATTR
                const canDec = val > 0
                return (
                  <div key={k} style={{ background: val > 0 ? '#2a1210' : '#242424', border: `1px solid ${val > 0 ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', padding: '8px 4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#d4cfc9', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                    <div style={{ fontSize: '7px', color: '#d4cfc9', marginBottom: '4px' }}>{ATTR_FULL[k]}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <button onClick={() => changeAttr(k, -1)} disabled={!canDec} style={skBtn(!canDec)}>-</button>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif', color: val > 0 ? '#f5a89a' : '#f5f2ee' }}>{val >= 0 ? `+${val}` : val}</div>
                        <div style={{ fontSize: '7px', color: val > 0 ? '#f5a89a' : '#d4cfc9', marginTop: '2px' }}>{ATTRIBUTE_LABELS[val]}</div>
                      </div>
                      <button onClick={() => changeAttr(k, 1)} disabled={!canInc} style={skBtn(!canInc)}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Skill spend */}
            <div style={sh}>Skills � {SKILL_BUDGET - skillCDPSpent} CDP remaining</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#242424', borderRadius: '3px', padding: '8px 12px', marginBottom: '10px', border: '1px solid #2e2e2e' }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {Array.from({ length: SKILL_BUDGET }).map((_, i) => (
                  <div key={i} style={{ width: '10px', height: '10px', borderRadius: '2px', border: `1px solid ${i < skillCDPSpent ? '#c0392b' : '#3a3a3a'}`, background: i < skillCDPSpent ? '#c0392b' : '#0f0f0f' }} />
                ))}
              </div>
              <span style={{ fontSize: '12px', color: '#f5f2ee', flex: 1 }}>Skill CDP</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: skillCDPSpent >= SKILL_BUDGET ? '#f5a89a' : '#f5f2ee' }}>{SKILL_BUDGET - skillCDPSpent} left</span>
            </div>
            <input
              style={{ width: '100%', marginBottom: '7px', fontSize: '13px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '8px 10px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }}
              placeholder="Filter skills..."
              value={skillFilter}
              onChange={e => setSkillFilter(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxHeight: '320px', overflowY: 'auto', paddingRight: '2px' }}>
              {filteredSkills.map(sk => {
                const cumVal = allSkills[sk.name]
                const deltaThisStep = skillDeltas[sk.name] ?? 0
                const canInc = skillCDPSpent < SKILL_BUDGET && cumVal < MAX_SKILL
                const canDec = (skillCDPMap[sk.name] ?? 0) > 0
                const isVoc = vocProfession?.skills.includes(sk.name)
                const disp = cumVal >= 0 ? (cumVal > 0 ? `+${cumVal}` : '0') : String(cumVal)
                return (
                  <div key={sk.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: `1px ${sk.vocational ? 'dashed' : 'solid'} ${isVoc ? '#7a1f16' : '#2e2e2e'}`, borderRadius: '3px', padding: '5px 7px', background: isVoc ? '#1a0f0f' : '#242424' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: deltaThisStep > 0 ? '#f5a89a' : '#f5f2ee' }}>
                        {sk.name}{sk.vocational ? '*' : ''}{isVoc ? ' ?' : ''}
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#d4cfc9' }}>{sk.attribute} � {SKILL_LABELS[cumVal]}{deltaThisStep > 0 ? ` (+${deltaThisStep})` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                      <button onClick={() => changeSkill(sk.name, -1)} disabled={!canDec} style={skBtn(!canDec)}>-</button>
                      <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '22px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', color: cumVal < 0 ? '#f5a89a' : '#f5f2ee' }}>{disp}</span>
                      <button onClick={() => changeSkill(sk.name, 1)} disabled={!canInc} style={skBtn(!canInc)}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {step === 2 && <StepSix state={state} onChange={handleChange} />}
        {step === 3 && <StepSeven state={state} />}
        {step === 4 && <StepEight state={state} onChange={handleChange} />}
        {step === 5 && <StepNine state={state} onChange={handleChange} />}
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #2e2e2e' }}>
        <button onClick={() => { setStep(s => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} disabled={step === 0} style={navBtn(false)}>Back</button>
        <div style={{ textAlign: 'center' }}>
          {saveError && <div style={{ fontSize: '11px', color: '#f5a89a', marginBottom: '2px' }}>{saveError}</div>}
          {saved && <div style={{ fontSize: '11px', color: '#7fc458', marginBottom: '2px' }}>Character saved!</div>}
          <div style={{ fontSize: '11px', color: '#d4cfc9', letterSpacing: '.05em', textTransform: 'uppercase' }}>Step {step} of 5</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {step === 5 && (
            <button onClick={handlePrint} style={{ ...navBtn(false), borderColor: '#2d5a1b', color: '#7fc458' }}>Print Character</button>
          )}
          {step < 5
            ? <button onClick={() => { setStep(s => Math.min(5, s + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={navBtn(true)}>Advance</button>
            : <button onClick={handleSave} disabled={saving || saved} style={{ ...navBtn(true), opacity: saving || saved ? 0.6 : 1 }}>{saving ? 'Saving...' : saved ? 'Saved ?' : 'Save Character'}</button>
          }
        </div>
      </div>
      <div className="print-sheet-container">
        <PrintSheet state={state} />
      </div>
    </div>
  )
}

const sh: React.CSSProperties = {
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', fontWeight: 600, color: '#f5f2ee',
  textTransform: 'uppercase', letterSpacing: '.1em', margin: '1.25rem 0 8px',
  borderBottom: '1px solid #2e2e2e', paddingBottom: '4px',
}

function navBtn(primary: boolean): React.CSSProperties {
  return { padding: '9px 22px', borderRadius: '3px', fontSize: '13px', cursor: 'pointer', border: `1px solid ${primary ? '#c0392b' : '#3a3a3a'}`, background: primary ? '#c0392b' : '#242424', color: primary ? '#fff' : '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', transition: 'all .15s' }
}

function skBtn(disabled: boolean): React.CSSProperties {
  return { width: '19px', height: '19px', border: '1px solid #3a3a3a', borderRadius: '2px', background: '#1a1a1a', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '12px', color: '#f5f2ee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, opacity: disabled ? 0.18 : 1, transition: 'all .1s' }
}
