'use client'
import { useState } from 'react'
import { WizardState, StepData, getCumulativeAttributes, getCumulativeSkills, skillStepUp, skillStepDown, getBaseSkillValue } from '../../lib/xse-engine'
import { SKILLS, ATTRIBUTE_LABELS, SKILL_LABELS, AttributeName } from '../../lib/xse-schema'

const ATTR_KEYS: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<AttributeName, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity'
}

interface Props {
  stepIndex: number       // 0-based index into state.steps (0=step1, 1=step2, 2=step3)
  stepNumber: number      // display number (1, 2, 3)
  stepTitle: string
  skillBudget: number
  maxAttr: number         // max attribute value allowed this step
  maxSkill: number        // max skill value allowed this step
  placeholder: string     // backstory note placeholder
  state: WizardState
  onChange: (updated: Partial<WizardState>) => void
}

export default function StepAttr({ stepIndex, stepNumber, stepTitle, skillBudget, maxAttr, maxSkill, placeholder, state, onChange }: Props) {
  const [skillFilter, setSkillFilter] = useState('')

  const stepData = state.steps[stepIndex] ?? {}
  const allSteps = state.steps

  // Cumulative values up to but not including this step
  const prevSteps = allSteps.slice(0, stepIndex)
  const cumulativeAttrs = getCumulativeAttributes(allSteps)
  const cumulativeSkills = getCumulativeSkills(allSteps)

  // Skill CDP spent this step
  const skillCDPSpent = stepData.skillCDPSpent ?? 0
  const skillDeltas = stepData.skillDeltas ?? {}

  function updateStep(patch: Partial<StepData>) {
    const newSteps = [...state.steps]
    newSteps[stepIndex] = { ...stepData, ...patch }
    onChange({ steps: newSteps })
  }

  // Attribute picker
  function pickAttr(key: AttributeName) {
    if (stepData.attrKey === key) {
      updateStep({ attrKey: null })
    } else if (!stepData.attrKey && cumulativeAttrs[key] < maxAttr) {
      updateStep({ attrKey: key })
    }
  }

  // Skill stepper
  function changeSkill(skillName: string, dir: 1 | -1) {
    const skill = SKILLS.find(s => s.name === skillName)!
    const cumVal = cumulativeSkills[skillName]
    const deltaThisStep = skillDeltas[skillName] ?? 0
    const newDeltas = { ...skillDeltas }

    if (dir === 1) {
      if (skillCDPSpent >= skillBudget) return
      const next = skillStepUp(cumVal, skill.vocational)
      if (next > maxSkill) return
      newDeltas[skillName] = deltaThisStep + 1
      updateStep({ skillDeltas: newDeltas, skillCDPSpent: skillCDPSpent + 1 })
    } else {
      if (deltaThisStep <= 0) return
      newDeltas[skillName] = deltaThisStep - 1
      if (newDeltas[skillName] === 0) delete newDeltas[skillName]
      updateStep({ skillDeltas: newDeltas, skillCDPSpent: Math.max(0, skillCDPSpent - 1) })
    }
  }

  const filteredSkills = SKILLS.filter(s =>
    !skillFilter ||
    s.name.toLowerCase().includes(skillFilter.toLowerCase()) ||
    s.attribute.toLowerCase().includes(skillFilter.toLowerCase())
  )

  // Locked history panels
  const lockedSteps = [
    { idx: 0, num: 1, title: 'Where they grew up' },
    { idx: 1, num: 2, title: 'What they learned' },
    { idx: 2, num: 3, title: 'What they like to do' },
  ].filter(s => s.num < stepNumber)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Locked history */}
      {lockedSteps.map(({ idx, num, title }) => {
        const d = state.steps[idx] ?? {}
        const attrStr = d.attrKey ? `${d.attrKey} → ${ATTRIBUTE_LABELS[cumulativeAttrs[d.attrKey]]} (${cumulativeAttrs[d.attrKey] >= 0 ? '+' : ''}${cumulativeAttrs[d.attrKey]})` : 'none'
        const gained = Object.entries(d.skillDeltas ?? {}).filter(([, v]) => (v ?? 0) > 0).map(([n]) => n)
        return (
          <div key={idx} style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '0.75rem 1rem', fontSize: '12px' }}>
            <div style={{ color: '#5a5550', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Step {num}: {title}
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', color: '#9a948a' }}>
              <span><span style={{ color: '#5a5550' }}>Attribute:</span> {attrStr}</span>
              <span><span style={{ color: '#5a5550' }}>Skills:</span> {gained.length ? gained.join(', ') : 'none'}</span>
            </div>
            {d.note && <div style={{ marginTop: '4px', color: '#5a5550', fontStyle: 'italic' }}>"{d.note}"</div>}
          </div>
        )
      })}

      {/* Attribute picker */}
      <div>
        <div style={shStyle}>Attribute — raise one (max {ATTRIBUTE_LABELS[maxAttr]})</div>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
          {[0, 1].map(i => (
            <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < (stepData.attrKey ? 1 : 0) ? '#c0392b' : '#2e2e2e' }} />
          ))}
          <span style={{ fontSize: '11px', color: stepData.attrKey ? '#f5a89a' : '#9a948a', marginLeft: '6px' }}>
            {stepData.attrKey ? '0 left' : '1 left'} — Attribute CDP
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {ATTR_KEYS.map(k => {
            const val = cumulativeAttrs[k]
            const isSelected = stepData.attrKey === k
            const canSelect = !stepData.attrKey && val < maxAttr
            return (
              <div key={k} onClick={() => pickAttr(k)}
                style={{
                  background: isSelected ? '#2a1210' : '#1a1a1a',
                  border: `1px solid ${isSelected ? '#c0392b' : '#2e2e2e'}`,
                  borderRadius: '4px', padding: '0.75rem 0.5rem',
                  textAlign: 'center', cursor: canSelect || isSelected ? 'pointer' : 'default',
                  opacity: !canSelect && !isSelected ? 0.5 : 1,
                }}>
                <div style={{ fontSize: '11px', color: '#5a5550', letterSpacing: '0.08em' }}>{k}</div>
                <div style={{ fontSize: '10px', color: '#5a5550', marginBottom: '4px' }}>{ATTR_FULL[k]}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: isSelected ? '#f5a89a' : val > 0 ? '#e8e4dc' : '#9a948a' }}>
                  {val >= 0 ? `+${val}` : val}
                </div>
                <div style={{ fontSize: '10px', color: isSelected ? '#f5a89a' : '#9a948a' }}>{ATTRIBUTE_LABELS[val]}</div>
              </div>
            )
          })}
        </div>
        {stepData.attrKey && (
          <p style={{ fontSize: '12px', color: '#9a948a', marginTop: '6px' }}>
            Raised {ATTR_FULL[stepData.attrKey as AttributeName]} this step. One attribute per step in stages 1–3.
          </p>
        )}
      </div>

      {/* Skill picker */}
      <div>
        <div style={shStyle}>Skills — {skillBudget} CDP (max {SKILL_LABELS[maxSkill]})</div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '0.75rem' }}>
          {Array.from({ length: skillBudget }).map((_, i) => (
            <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < skillCDPSpent ? '#c0392b' : '#2e2e2e' }} />
          ))}
          <span style={{ fontSize: '11px', color: skillCDPSpent >= skillBudget ? '#f5a89a' : '#9a948a', marginLeft: '6px' }}>
            {skillBudget - skillCDPSpent} left — Skill CDP
          </span>
        </div>
        <input
          style={{ ...inputStyle, marginBottom: '0.75rem' }}
          placeholder="Filter skills..."
          value={skillFilter}
          onChange={e => setSkillFilter(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {filteredSkills.map(sk => {
            const cumVal = cumulativeSkills[sk.name]
            const deltaThisStep = skillDeltas[sk.name] ?? 0
            const canInc = skillCDPSpent < skillBudget && cumVal < maxSkill
            const canDec = deltaThisStep > 0
            const disp = cumVal >= 0 ? (cumVal > 0 ? `+${cumVal}` : '0') : String(cumVal)
            return (
              <div key={sk.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 10px', background: '#1a1a1a', border: '1px solid #2e2e2e',
                borderRadius: '4px',
              }}>
                <div>
                  <span style={{ fontSize: '13px', color: deltaThisStep > 0 ? '#e8e4dc' : '#9a948a' }}>
                    {sk.name}{sk.vocational ? '*' : ''}
                  </span>
                  <span style={{ fontSize: '11px', color: '#5a5550', marginLeft: '8px' }}>
                    {sk.attribute} — {SKILL_LABELS[cumVal]}{deltaThisStep > 0 ? ` (+${deltaThisStep})` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => changeSkill(sk.name, -1)} disabled={!canDec}
                    style={stepperBtn(!canDec)}>−</button>
                  <span style={{ fontSize: '13px', color: cumVal < 0 ? '#c0392b' : cumVal > 0 ? '#e8e4dc' : '#5a5550', minWidth: '28px', textAlign: 'center' }}>
                    {disp}
                  </span>
                  <button onClick={() => changeSkill(sk.name, 1)} disabled={!canInc}
                    style={stepperBtn(!canInc)}>+</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Backstory note */}
      <div>
        <div style={shStyle}>Backstory note</div>
        <textarea style={textareaStyle}
          value={stepData.note ?? ''}
          onChange={e => updateStep({ note: e.target.value })}
          placeholder={placeholder} />
      </div>

    </div>
  )
}

const shStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#c0392b',
  letterSpacing: '0.1em', textTransform: 'uppercase',
  marginBottom: '8px', fontFamily: 'monospace',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem',
  background: '#1a1a1a', border: '1px solid #2e2e2e',
  borderRadius: '4px', color: '#e8e4dc',
  fontSize: '14px', fontFamily: 'monospace',
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem',
  background: '#1a1a1a', border: '1px solid #2e2e2e',
  borderRadius: '4px', color: '#e8e4dc',
  fontSize: '14px', fontFamily: 'monospace',
  minHeight: '72px', resize: 'vertical', lineHeight: 1.5,
}

function stepperBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: disabled ? '#1a1a1a' : '#242424',
    border: `1px solid ${disabled ? '#242424' : '#2e2e2e'}`,
    borderRadius: '3px', color: disabled ? '#3a3a3a' : '#e8e4dc',
    cursor: disabled ? 'default' : 'pointer', fontSize: '16px', fontFamily: 'monospace',
  }
}