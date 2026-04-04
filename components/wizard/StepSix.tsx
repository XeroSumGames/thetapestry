'use client'
import { WizardState, StepData, rollComplication, rollMotivation } from '../../lib/xse-engine'
import { COMPLICATIONS, MOTIVATIONS } from '../../lib/xse-schema'

interface Props {
  state: WizardState
  onChange: (updated: Partial<WizardState>) => void
}

export default function StepSix({ state, onChange }: Props) {
  const stepData = state.steps[5] ?? {}

  function updateStep(patch: Partial<StepData>) {
    const newSteps = [...state.steps]
    newSteps[5] = { ...stepData, ...patch }
    onChange({ steps: newSteps })
  }

  const complications = Object.values(COMPLICATIONS)
  const motivations = Object.values(MOTIVATIONS)

  return (
    <div>

      {/* Complication */}
      <div style={sh}>Complication</div>
      <p style={{ fontSize: '12px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px' }}>
        A narrative tool for roleplay and character definition. Roll or pick one.
      </p>
      <button
        onClick={() => updateStep({ complication: rollComplication() })}
        style={{ ...nbtn, marginBottom: '10px' }}>
        Random Complication
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '1.5rem' }}>
        {complications.map(c => (
          <div key={c}
            onClick={() => updateStep({ complication: c })}
            style={{
              background: stepData.complication === c ? '#2a1210' : '#242424',
              border: `1px solid ${stepData.complication === c ? '#c0392b' : '#2e2e2e'}`,
              borderRadius: '3px', padding: '6px 7px', fontSize: '12px', cursor: 'pointer',
              textAlign: 'center', color: stepData.complication === c ? '#f5a89a' : '#f5f2ee',
              fontWeight: stepData.complication === c ? 600 : 400,
              transition: 'all .1s',
            }}>
            {c}
          </div>
        ))}
      </div>

      {/* Motivation */}
      <div style={sh}>Motivation</div>
      <p style={{ fontSize: '12px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px' }}>
        What gets them out of bed. Roll or pick one.
      </p>
      <button
        onClick={() => updateStep({ motivation: rollMotivation() })}
        style={{ ...nbtn, marginBottom: '10px' }}>
        Random Motivation
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {motivations.map(m => (
          <div key={m}
            onClick={() => updateStep({ motivation: m })}
            style={{
              background: stepData.motivation === m ? '#2a1210' : '#242424',
              border: `1px solid ${stepData.motivation === m ? '#c0392b' : '#2e2e2e'}`,
              borderRadius: '3px', padding: '6px 7px', fontSize: '12px', cursor: 'pointer',
              textAlign: 'center', color: stepData.motivation === m ? '#f5a89a' : '#f5f2ee',
              fontWeight: stepData.motivation === m ? 600 : 400,
              transition: 'all .1s',
            }}>
            {m}
          </div>
        ))}
      </div>

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

const nbtn: React.CSSProperties = {
  padding: '9px 22px', borderRadius: '3px', fontSize: '13px', cursor: 'pointer',
  border: '1px solid #3a3a3a', background: '#242424', color: '#f5f2ee',
  fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
  transition: 'all .15s',
}
