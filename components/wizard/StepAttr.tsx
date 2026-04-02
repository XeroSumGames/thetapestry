'use client'
import { useState } from 'react'
import { WizardState, StepData, getCumulativeAttributes, getCumulativeSkills, skillStepUp } from '../../lib/xse-engine'
import { SKILLS, ATTRIBUTE_LABELS, SKILL_LABELS, AttributeName, SkillValue } from '../../lib/xse-schema'

const ATTR_KEYS: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<AttributeName, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity'
}

interface Props {
  stepIndex: number
  stepNumber: number
  stepTitle: string
  skillBudget: number
  maxAttr: number
  maxSkill: number
  placeholder: string
  state: WizardState
  onChange: (updated: Partial<WizardState>) => void
}

export default function StepAttr({ stepIndex, stepNumber, stepTitle, skillBudget, maxAttr, maxSkill, placeholder, state, onChange }: Props) {
  const [skillFilter, setSkillFilter] = useState('')

  const stepData = state.steps[stepIndex] ?? {}
  const cumulativeAttrs = getCumulativeAttributes(state.steps)
  const cumulativeSkills = getCumulativeSkills(state.steps)
  const skillCDPSpent = stepData.skillCDPSpent ?? 0
  const skillDeltas = stepData.skillDeltas ?? {}

  function updateStep(patch: Partial<StepData>) {
    const newSteps = [...state.steps]
    newSteps[stepIndex] = { ...stepData, ...patch }
    onChange({ steps: newSteps })
  }

  function pickAttr(key: AttributeName) {
    if (stepData.attrKey === key) updateStep({ attrKey: null })
    else if (!stepData.attrKey && cumulativeAttrs[key] < maxAttr) updateStep({ attrKey: key })
  }

    function changeSkill(skillName: string, dir: 1 | -1) {
    const skill = SKILLS.find(s => s.name === skillName)!
    const cumVal = cumulativeSkills[skillName]
    const cdpMap = stepData.skillCDPMap ?? {}
    const cdpThisSkill = cdpMap[skillName] ?? 0
    const newDeltas = { ...skillDeltas }
    const newCDPMap = { ...cdpMap }

    if (dir === 1) {
      if (skillCDPSpent >= skillBudget) return
      const next = skillStepUp(cumVal, skill.vocational)
      if (next > maxSkill) return
      const gain = next - cumVal
      newDeltas[skillName] = (newDeltas[skillName] ?? 0) + gain
      newCDPMap[skillName] = cdpThisSkill + 1
      updateStep({ skillDeltas: newDeltas, skillCDPSpent: skillCDPSpent + 1, skillCDPMap: newCDPMap })
    } else {
      if (cdpThisSkill <= 0) return
      const prev = skillStepUp(
        (cumVal - 1) as SkillValue,
        skill.vocational
      )
      const loss = cumVal - prev
      newDeltas[skillName] = (newDeltas[skillName] ?? 0) - loss
      if ((newDeltas[skillName] ?? 0) <= 0) delete newDeltas[skillName]
      newCDPMap[skillName] = cdpThisSkill - 1
      if (newCDPMap[skillName] <= 0) delete newCDPMap[skillName]
      updateStep({ skillDeltas: newDeltas, skillCDPSpent: Math.max(0, skillCDPSpent - 1), skillCDPMap: newCDPMap })
    }
  }

  const filteredSkills = SKILLS.filter(s =>
    !skillFilter ||
    s.name.toLowerCase().includes(skillFilter.toLowerCase()) ||
    s.attribute.toLowerCase().includes(skillFilter.toLowerCase())
  )

  const lockedSteps = [
    { idx: 0, num: 1, title: 'Where they grew up' },
    { idx: 1, num: 2, title: 'What they learned' },
    { idx: 2, num: 3, title: 'What they liked to do' },
  ].filter(s => s.num < stepNumber)

  return (
    <div>
      {/* CDP reminder - Step 1 only */}
      {stepNumber === 1 && (
        <div style={{ background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#7fc458', lineHeight: 1.7 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '4px', color: '#7fc458' }}>How to spend CDP</div>
          You have <strong>1 Attribute CDP</strong> — raise one RAPID attribute from Average (0) to Good (+1).<br />
          You have <strong>2 Skill CDP</strong> — raise one skill to Journeyman (+2), or two skills to Beginner (+1).<br />
          Vocational skills marked with <strong>*</strong> start at Inept (-3) and cost 1 CDP to reach Beginner (+1).
        </div>
      )}

      {/* Locked history */}
      {lockedSteps.map(({ idx, num, title }) => {
        const d = state.steps[idx] ?? {}
        const attrKey = d.attrKey as AttributeName | null
        const attrVal = attrKey ? cumulativeAttrs[attrKey] : null
        const attrStr = attrKey && attrVal !== null
          ? `${attrKey} â†’ +${attrVal} (${ATTRIBUTE_LABELS[attrVal]})`
          : 'none'
        const gained = Object.entries(d.skillDeltas ?? {}).filter(([, v]) => (v ?? 0) > 0).map(([n]) => n)
        return (
          <div key={idx} style={{ background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '10px 12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 600, color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '5px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Step {num}: {title}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '2px 0', borderBottom: '1px solid #2e2e2e' }}>
              <span style={{ color: '#b0aaa4' }}>Attribute</span>
              <span style={{ fontWeight: 500, color: '#f5f2ee' }}>{attrStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '2px 0' }}>
              <span style={{ color: '#b0aaa4' }}>Skills</span>
              <span style={{ fontWeight: 500, color: '#f5f2ee', maxWidth: '65%', textAlign: 'right', wordBreak: 'break-word' }}>
                {gained.length ? gained.join(', ') : 'none'}
              </span>
            </div>
            {d.note && <div style={{ fontSize: '11px', color: '#b0aaa4', marginTop: '5px', lineHeight: 1.5, fontStyle: 'italic' }}>"{d.note}"</div>}
          </div>
        )
      })}

      {/* Attribute picker â€” only shown when maxAttr > 0 */}
      {maxAttr > 0 && (
        <div>
          <div style={sh}>Attribute â€” raise one (max {ATTRIBUTE_LABELS[maxAttr]} +{maxAttr})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#242424', borderRadius: '3px', padding: '8px 12px', marginBottom: '10px', border: '1px solid #2e2e2e' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[0, 1].map(i => (
                <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', border: `1px solid ${i < (stepData.attrKey ? 1 : 0) ? '#c0392b' : '#3a3a3a'}`, background: i < (stepData.attrKey ? 1 : 0) ? '#c0392b' : '#0f0f0f' }} />
              ))}
            </div>
            <span style={{ fontSize: '12px', color: '#f5f2ee', flex: 1 }}>Attribute CDP â€” raise one attribute</span>
            <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '36px', textAlign: 'right', color: stepData.attrKey ? '#f5a89a' : '#f5f2ee' }}>
              {stepData.attrKey ? '0 left' : '1 left'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '8px' }}>
            {ATTR_KEYS.map(k => {
              const val = cumulativeAttrs[k]
              const isSelected = stepData.attrKey === k
              const canInc = !stepData.attrKey && val < maxAttr
              const canDec = isSelected
              return (
                <div key={k} style={{
                  background: isSelected ? '#2a1210' : '#242424',
                  border: `1px solid ${isSelected ? '#c0392b' : '#3a3a3a'}`,
                  borderRadius: '3px', padding: '8px 4px', textAlign: 'center',
                  transition: 'all .15s',
                }}>
                  <div style={{ fontSize: '10px', color: '#b0aaa4', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                  <div style={{ fontSize: '7px', color: '#b0aaa4', marginBottom: '4px', lineHeight: 1.2 }}>{ATTR_FULL[k]}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <button onClick={() => pickAttr(k)} disabled={!canDec} style={attrBtn(!canDec)}>âˆ’</button>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif', color: isSelected ? '#f5a89a' : val > 0 ? '#f5f2ee' : '#b0aaa4' }}>
                        {val >= 0 ? `+${val}` : val}
                      </div>
                      <div style={{ fontSize: '7px', color: isSelected ? '#f5a89a' : '#b0aaa4', marginTop: '2px' }}>{ATTRIBUTE_LABELS[val]}</div>
                    </div>
                    <button onClick={() => pickAttr(k)} disabled={!canInc} style={attrBtn(!canInc)}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
          {stepData.attrKey && (
            <p style={{ fontSize: '12px', color: '#b0aaa4', marginBottom: '8px', lineHeight: 1.6 }}>
              Raised {ATTR_FULL[stepData.attrKey as AttributeName]} this step. One attribute per step in stages 1â€“3.
            </p>
          )}
        </div>
      )}

      {/* Skill picker */}
      <div style={sh}>Skills â€” {skillBudget} CDP (max {SKILL_LABELS[maxSkill]})</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#242424', borderRadius: '3px', padding: '8px 12px', marginBottom: '10px', border: '1px solid #2e2e2e' }}>
        <div style={{ display: 'flex', gap: '3px' }}>
          {Array.from({ length: skillBudget }).map((_, i) => (
            <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', border: `1px solid ${i < skillCDPSpent ? '#c0392b' : '#3a3a3a'}`, background: i < skillCDPSpent ? '#c0392b' : '#0f0f0f' }} />
          ))}
        </div>
        <span style={{ fontSize: '12px', color: '#f5f2ee', flex: 1 }}>Skill CDP</span>
        <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '36px', textAlign: 'right', color: skillCDPSpent >= skillBudget ? '#f5a89a' : '#f5f2ee' }}>
          {skillBudget - skillCDPSpent} left
        </span>
      </div>

      <input
        style={{ width: '100%', marginBottom: '7px', fontSize: '13px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '8px 10px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }}
        placeholder="Filter skills..."
        value={skillFilter}
        onChange={e => setSkillFilter(e.target.value)} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxHeight: '280px', overflowY: 'auto', paddingRight: '2px', marginBottom: '10px' }}>
        {filteredSkills.map(sk => {
          const cumVal = cumulativeSkills[sk.name]
          const deltaThisStep = skillDeltas[sk.name] ?? 0
          const canInc = skillCDPSpent < skillBudget && cumVal < maxSkill
          const canDec = (stepData.skillCDPMap?.[sk.name] ?? 0) > 0
          const disp = cumVal >= 0 ? (cumVal > 0 ? `+${cumVal}` : '0') : String(cumVal)
          return (
            <div key={sk.name} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              border: `1px ${sk.vocational ? 'dashed' : 'solid'} #2e2e2e`,
              borderRadius: '3px', padding: '5px 7px', background: '#242424',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: deltaThisStep > 0 ? '#f5a89a' : '#f5f2ee' }}>
                  {sk.name}{sk.vocational ? '*' : ''}
                </div>
                <div style={{ fontSize: '9.5px', color: '#b0aaa4' }}>
                  {sk.attribute} â€” {SKILL_LABELS[cumVal]}{deltaThisStep > 0 ? ` (+${deltaThisStep})` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                <button onClick={() => changeSkill(sk.name, -1)} disabled={!canDec} style={skBtn(!canDec)}>âˆ’</button>
                <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '22px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', color: cumVal < 0 ? '#f5a89a' : '#f5f2ee' }}>
                  {disp}
                </span>
                <button onClick={() => changeSkill(sk.name, 1)} disabled={!canInc} style={skBtn(!canInc)}>+</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Backstory note */}
      <div style={sh}>Backstory note</div>
      <textarea
        style={{ width: '100%', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '8px 10px', fontSize: '14px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', minHeight: '60px', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
        value={stepData.note ?? ''}
        onChange={e => updateStep({ note: e.target.value })}
        placeholder={placeholder} />

    </div>
  )
}

const sh: React.CSSProperties = {
  fontFamily: 'Barlow Condensed, sans-serif',
  fontSize: '10px', fontWeight: 600, color: '#f5f2ee',
  textTransform: 'uppercase', letterSpacing: '.1em',
  margin: '1.25rem 0 8px', borderBottom: '1px solid #2e2e2e',
  paddingBottom: '4px',
}

function attrBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '19px', height: '19px', border: '1px solid #3a3a3a',
    borderRadius: '2px', background: '#1a1a1a',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '12px', color: '#f5f2ee',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, lineHeight: 1, opacity: disabled ? 0.18 : 1,
    transition: 'all .1s',
  }
}

function skBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '19px', height: '19px', border: '1px solid #3a3a3a',
    borderRadius: '2px', background: '#1a1a1a',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '12px', color: '#f5f2ee',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, lineHeight: 1, opacity: disabled ? 0.18 : 1,
    transition: 'all .1s',
  }
}
