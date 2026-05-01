'use client'
import { useState } from 'react'
import { WizardState, StepData, getCumulativeAttributes, getCumulativeSkills, skillStepUp } from '../../lib/xse-engine'
import { SKILLS, ATTRIBUTE_LABELS, SKILL_LABELS, PROFESSIONS, AttributeName, SkillValue } from '../../lib/xse-schema'
import HelpTooltip from '../HelpTooltip'
import { CDP_DESCRIPTION, SKILL_TIER_DESCRIPTION, VOCATIONAL_DESCRIPTION } from '../../lib/help-text'

const ATTR_KEYS: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<AttributeName, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity'
}

interface Props {
  state: WizardState
  onChange: (updated: Partial<WizardState>) => void
}

export default function StepFour({ state, onChange }: Props) {
  const [skillFilter, setSkillFilter] = useState('')

  const stepData = state.steps[3] ?? {}
  const attrSpent = stepData.attrSpent ?? {}
  const totalAttrSpent = Object.values(attrSpent).reduce((a, v) => a + (v ?? 0), 0)
  const skillCDPSpent = stepData.skillCDPSpent ?? 0
  const skillDeltas = stepData.skillDeltas ?? {}

  const cumulativeAttrs = getCumulativeAttributes(state.steps)
  const cumulativeSkills = getCumulativeSkills(state.steps)

  const profSkills = PROFESSIONS.find(p => p.name === stepData.profession)?.skills ?? []

  function updateStep(patch: Partial<StepData>) {
    const newSteps = [...state.steps]
    newSteps[3] = { ...stepData, ...patch }
    onChange({ steps: newSteps })
  }

  function changeAttr(key: AttributeName, dir: 1 | -1) {
    const spent = attrSpent[key] ?? 0
    const cumVal = cumulativeAttrs[key]
    if (dir === 1) {
      if (totalAttrSpent >= 2) return
      if (cumVal >= 3) return
      updateStep({ attrSpent: { ...attrSpent, [key]: spent + 1 } })
    } else {
      if (spent <= 0) return
      updateStep({ attrSpent: { ...attrSpent, [key]: spent - 1 } })
    }
  }

  function changeSkill(skillName: string, dir: 1 | -1) {
    const skill = SKILLS.find(s => s.name === skillName)!
    const cumVal = cumulativeSkills[skillName]
    const cdpMap = stepData.skillCDPMap ?? {}
    const cdpThisSkill = cdpMap[skillName] ?? 0
    const newDeltas = { ...skillDeltas }
    const newCDPMap = { ...cdpMap }

    if (dir === 1) {
      if (skillCDPSpent >= 4) return
      const next = skillStepUp(cumVal, skill.vocational)
      if (next > 3) return
      const gain = next - cumVal
      newDeltas[skillName] = (newDeltas[skillName] ?? 0) + gain
      newCDPMap[skillName] = cdpThisSkill + 1
      updateStep({ skillDeltas: newDeltas, skillCDPSpent: skillCDPSpent + 1, skillCDPMap: newCDPMap })
    } else {
      if (cdpThisSkill <= 0) return
      const prev = skillStepUp((cumVal - 1) as SkillValue, false)
      const loss = cumVal - prev
      newDeltas[skillName] = (newDeltas[skillName] ?? 0) - loss
      if ((newDeltas[skillName] ?? 0) <= 0) delete newDeltas[skillName]
      newCDPMap[skillName] = cdpThisSkill - 1
      if (newCDPMap[skillName] <= 0) delete newCDPMap[skillName]
      updateStep({ skillDeltas: newDeltas, skillCDPSpent: skillCDPSpent + 1 - 1, skillCDPMap: newCDPMap })
    }
  }

  const filteredSkills = SKILLS.filter(s =>
    !skillFilter ||
    s.name.toLowerCase().includes(skillFilter.toLowerCase()) ||
    s.attribute.toLowerCase().includes(skillFilter.toLowerCase())
  )

  // Locked history for steps 1-3
  const lockedSteps = [
    { idx: 0, num: 1, title: 'Where they grew up' },
    { idx: 1, num: 2, title: 'What they learned' },
    { idx: 2, num: 3, title: 'What they liked to do' },
  ]

  return (
    <div>

      {/* Locked history */}
      {lockedSteps.map(({ idx, num, title }) => {
        const d = state.steps[idx] ?? {}
        const attrKey = d.attrKey as AttributeName | null
        const attrVal = attrKey ? getCumulativeAttributes(state.steps.slice(0, idx + 1))[attrKey] : null
        const attrStr = attrKey && attrVal !== null ? `${attrKey} → +${attrVal} (${ATTRIBUTE_LABELS[attrVal]})` : 'none'
        const gained = Object.entries(d.skillDeltas ?? {}).filter(([, v]) => (v ?? 0) > 0).map(([n]) => n)
        return (
          <div key={idx} style={{ background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '10px 12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '5px', fontFamily: 'Carlito, sans-serif' }}>
              Step {num}: {title}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '2px 0', borderBottom: '1px solid #2e2e2e' }}>
              <span style={{ color: '#d4cfc9' }}>Attribute</span>
              <span style={{ fontWeight: 500, color: '#f5f2ee' }}>{attrStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '2px 0' }}>
              <span style={{ color: '#d4cfc9' }}>Skills</span>
              <span style={{ fontWeight: 500, color: '#f5f2ee', maxWidth: '65%', textAlign: 'right', wordBreak: 'break-word' }}>
                {gained.length ? gained.join(', ') : 'none'}
              </span>
            </div>
            {d.note && <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '5px', lineHeight: 1.5, fontStyle: 'italic' }}>"{d.note}"</div>}
          </div>
        )
      })}

      {/* Profession */}
      <div style={sh}>Profession</div>
      <div style={{ marginBottom: '10px' }}>
        <label style={lbl}>Choose a profession — vocation skills highlighted (recommendation only)</label>
        <select
          style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }}
          value={stepData.profession ?? ''}
          onChange={e => updateStep({ profession: e.target.value })}>
          <option value="">— select —</option>
          {PROFESSIONS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      {/* Skill picker — 4 CDP */}
      <div style={{ ...sh, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>Skills — 4 CDP (max Professional +3)</span>
        <HelpTooltip title="Skill levels" text={SKILL_TIER_DESCRIPTION} />
        <HelpTooltip title="Vocational skills (*)" text={VOCATIONAL_DESCRIPTION} icon="*" iconStyle={{ color: '#EF9F27', borderColor: '#EF9F27' }} />
      </div>
      {profSkills.length > 0 && (
        <p style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '6px', lineHeight: 1.6 }}>
          Profession skills highlighted: {profSkills.join(', ')}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#242424', borderRadius: '3px', padding: '8px 12px', marginBottom: '10px', border: '1px solid #2e2e2e' }}>
        <div style={{ display: 'flex', gap: '3px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', border: `1px solid ${i < skillCDPSpent ? '#c0392b' : '#3a3a3a'}`, background: i < skillCDPSpent ? '#c0392b' : '#0f0f0f' }} />
          ))}
        </div>
        <span style={{ fontSize: '13px', color: '#f5f2ee', flex: 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          Skill CDP
          <HelpTooltip title="Character Development Points" text={CDP_DESCRIPTION} />
        </span>
        <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '36px', textAlign: 'right', color: skillCDPSpent >= 4 ? '#f5a89a' : '#f5f2ee' }}>
          {4 - skillCDPSpent} left
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
          const isProfSk = profSkills.includes(sk.name)
          const canInc = skillCDPSpent < 4 && cumVal < 3
          const canDec = deltaThisStep > 0
          const disp = cumVal >= 0 ? (cumVal > 0 ? `+${cumVal}` : '0') : String(cumVal)
          return (
            <div key={sk.name} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              border: `1px ${sk.vocational ? 'dashed' : 'solid'} ${isProfSk ? '#7a1f16' : '#2e2e2e'}`,
              borderRadius: '3px', padding: '5px 7px', background: '#242424',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isProfSk ? '#f5a89a' : deltaThisStep > 0 ? '#f5a89a' : '#f5f2ee', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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
                <button onClick={() => changeSkill(sk.name, -1)} disabled={!canDec} style={skBtn(!canDec)}>−</button>
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
        placeholder="1–2 sentences: what did they do for work before the Dog Flu?" />

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

const lbl: React.CSSProperties = {
  fontSize: '13px', color: '#f5f2ee',
  letterSpacing: '.05em', textTransform: 'uppercase',
  display: 'block', marginBottom: '4px',
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