'use client'
import { useState } from 'react'
import { WizardState, StepData, getCumulativeAttributes, getCumulativeSkills, skillStepUp, skillStepDown } from '../../lib/xse-engine'
import { SKILLS, ATTRIBUTE_LABELS, SKILL_LABELS, AttributeName, SkillValue } from '../../lib/xse-schema'
import HelpTooltip from '../HelpTooltip'
import {
  ATTRIBUTE_DESCRIPTIONS,
  CDP_DESCRIPTION,
  VOCATIONAL_DESCRIPTION,
  SKILL_TIER_DESCRIPTION,
} from '../../lib/help-text'

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
      const deltaThisStep = newDeltas[skillName] ?? 0
      if (deltaThisStep <= 0) return
      // cumBase = the skill value coming INTO this step from prior steps
      const cumBase = (cumVal - deltaThisStep) as SkillValue
      // Step cumVal down exactly one level, but never below cumBase
      // (the prior-step floor). Pass `skill.vocational` so the
      // helper mirrors skillStepUp's -3→1 jump for first-spend
      // un-picks (without it, 1 → 0 on a vocational skill loses
      // the -3 untrained floor).
      const newCumVal = skillStepDown(cumVal as SkillValue, cumBase as SkillValue, skill.vocational)
      const newDelta = newCumVal - cumBase
      if (newDelta <= 0) delete newDeltas[skillName]
      else newDeltas[skillName] = newDelta
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

      {/* Locked history */}
      {lockedSteps.map(({ idx, num, title }) => {
        const d = state.steps[idx] ?? {}
        const attrKey = d.attrKey as AttributeName | null
        const attrVal = attrKey ? cumulativeAttrs[attrKey] : null
        const attrStr = attrKey && attrVal !== null
          ? `${attrKey} +${attrVal} (${ATTRIBUTE_LABELS[attrVal]})`
          : 'none'
        const gained = Object.entries(d.skillDeltas ?? {}).filter(([, v]) => (v ?? 0) > 0).map(([n]) => n)
        return (
          <div key={idx} style={{ background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '10px 12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 600, color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '5px', fontFamily: 'Carlito, sans-serif' }}>
              Step {num}: {title}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '2px 0', borderBottom: '1px solid #2e2e2e' }}>
              <span style={{ color: '#d4cfc9' }}>Attribute</span>
              <span style={{ fontWeight: 500, color: '#f5f2ee' }}>{attrStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '2px 0' }}>
              <span style={{ color: '#d4cfc9' }}>Skills</span>
              <span style={{ fontWeight: 500, color: '#f5f2ee', maxWidth: '65%', textAlign: 'right', wordBreak: 'break-word' }}>
                {gained.length ? gained.join(', ') : 'none'}
              </span>
            </div>
            {d.note && <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '5px', lineHeight: 1.5, fontStyle: 'italic' }}>"{d.note}"</div>}
          </div>
        )
      })}

      {/* Attribute picker — only shown when maxAttr > 0 */}
      {maxAttr > 0 && (
        <div>
          <div style={sh}>Attribute — raise one (max +{maxAttr} {ATTRIBUTE_LABELS[maxAttr]})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#242424', borderRadius: '3px', padding: '8px 12px', marginBottom: '10px', border: '1px solid #2e2e2e' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[0].map(i => (
                <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', border: `1px solid ${i < (stepData.attrKey ? 1 : 0) ? '#c0392b' : '#3a3a3a'}`, background: i < (stepData.attrKey ? 1 : 0) ? '#c0392b' : '#0f0f0f' }} />
              ))}
            </div>
            <span style={{ fontSize: '13px', color: '#f5f2ee', flex: 1 }}>Attribute CDP — raise one attribute</span>
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
                  <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.06em', fontFamily: 'Carlito, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {k}
                    <HelpTooltip title={`${k} — ${ATTR_FULL[k]}`} text={ATTRIBUTE_DESCRIPTIONS[k]} iconStyle={{ width: '13px', height: '13px', fontSize: '13px' }} />
                  </div>
                  <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '4px', lineHeight: 1.2 }}>{ATTR_FULL[k]}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <button onClick={() => pickAttr(k)} disabled={!canDec} style={attrBtn(!canDec)}>-</button>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Carlito, sans-serif', color: isSelected ? '#f5a89a' : val > 0 ? '#f5f2ee' : '#d4cfc9' }}>
                        {val >= 0 ? `+${val}` : val}
                      </div>
                      <div style={{ fontSize: '13px', color: isSelected ? '#f5a89a' : '#d4cfc9', marginTop: '2px' }}>{ATTRIBUTE_LABELS[val]}</div>
                    </div>
                    <button onClick={() => pickAttr(k)} disabled={!canInc} style={attrBtn(!canInc)}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
          {stepData.attrKey && (
            <p style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '8px', lineHeight: 1.6 }}>
              Raised {ATTR_FULL[stepData.attrKey as AttributeName]} this step. One attribute per step in stages 1-3.
            </p>
          )}
        </div>
      )}

      {/* Skill picker */}
      <div style={{ ...sh, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>Skills — {skillBudget} CDP (max +{maxSkill} {SKILL_LABELS[maxSkill]})</span>
        <HelpTooltip title="Skill levels" text={SKILL_TIER_DESCRIPTION} />
        <HelpTooltip title="Vocational skills (*)" text={VOCATIONAL_DESCRIPTION} icon="*" iconStyle={{ color: '#EF9F27', borderColor: '#EF9F27' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#242424', borderRadius: '3px', padding: '8px 12px', marginBottom: '10px', border: '1px solid #2e2e2e' }}>
        <div style={{ display: 'flex', gap: '3px' }}>
          {Array.from({ length: skillBudget }).map((_, i) => (
            <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', border: `1px solid ${i < skillCDPSpent ? '#c0392b' : '#3a3a3a'}`, background: i < skillCDPSpent ? '#c0392b' : '#0f0f0f' }} />
          ))}
        </div>
        <span style={{ fontSize: '13px', color: '#f5f2ee', flex: 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          Skill CDP
          <HelpTooltip title="Character Development Points" text={CDP_DESCRIPTION} />
        </span>
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
                <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: deltaThisStep > 0 ? '#f5a89a' : '#f5f2ee', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sk.name}{sk.vocational ? '*' : ''}</span>
                  <HelpTooltip
                    title={`${sk.name}${sk.vocational ? ' (vocational)' : ''} — ${sk.attribute}`}
                    text={sk.description ?? 'No description on file.'}
                    iconStyle={{ width: '12px', height: '12px', fontSize: '13px' }}
                  />
                </div>
                <div style={{ fontSize: '13px', color: '#d4cfc9' }}>
                  {sk.attribute} — {SKILL_LABELS[cumVal]}{deltaThisStep > 0 ? ` (+${deltaThisStep})` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                <button onClick={() => changeSkill(sk.name, -1)} disabled={!canDec} style={skBtn(!canDec)}>-</button>
                <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '22px', textAlign: 'center', fontFamily: 'Carlito, sans-serif', color: cumVal < 0 ? '#f5a89a' : '#f5f2ee' }}>
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
  fontFamily: 'Carlito, sans-serif',
  fontSize: '13px', fontWeight: 600, color: '#f5f2ee',
  textTransform: 'uppercase', letterSpacing: '.1em',
  margin: '1.25rem 0 8px', borderBottom: '1px solid #2e2e2e',
  paddingBottom: '4px',
}

function attrBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '19px', height: '19px', border: '1px solid #3a3a3a',
    borderRadius: '2px', background: '#1a1a1a',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px', color: '#f5f2ee',
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
    fontSize: '13px', color: '#f5f2ee',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, lineHeight: 1, opacity: disabled ? 0.18 : 1,
    transition: 'all .1s',
  }
}
