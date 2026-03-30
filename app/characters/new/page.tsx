'use client'
import { useState } from 'react'
import { createWizardState, WizardState } from '../../../lib/xse-engine'
import StepXero from '../../../components/wizard/StepXero'

const STEPS = [
  'Step Xero', 'Step One', 'Step Two', 'Step Three',
  'Step Four', 'Step Five', 'Step Six', 'Step Seven',
  'Step Eight', 'Step Nine',
]

export default function NewCharacterPage() {
  const [state, setState] = useState<WizardState>(createWizardState)

  function handleChange(updated: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...updated }))
  }

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1rem 4rem', fontFamily: 'monospace' }}>

      <div style={{ borderBottom: '2px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e8e4dc' }}>
          XSE Character Creator
        </span>
        <span style={{ fontSize: '11px', color: '#5a5550', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Xero Sum Engine v1.1
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem' }}>
        {STEPS.map((label, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              border: `1px solid ${i === state.currentStep ? '#c0392b' : '#2e2e2e'}`,
              background: i < state.currentStep ? '#c0392b' : '#1a1a1a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', color: i < state.currentStep ? '#fff' : i === state.currentStep ? '#c0392b' : '#5a5550',
            }}>{i}</div>
            <span style={{ fontSize: '7px', color: i === state.currentStep ? '#f5a89a' : '#5a5550', textAlign: 'center', letterSpacing: '0.03em', textTransform: 'uppercase', maxWidth: '44px', lineHeight: 1.2 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>
          Step Xero
        </div>
        <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem', color: '#e8e4dc' }}>
          Who Are They?
        </div>
        <p style={{ fontSize: '13px', color: '#9a948a', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          Define your character concept before any stats are touched — name, age, basics, and three words that anchor who they are.
        </p>
        {state.currentStep === 0 && <StepXero state={state} onChange={handleChange} />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
        {state.currentStep > 0 && (
          <button onClick={() => setState(p => ({ ...p, currentStep: p.currentStep - 1 }))}
            style={btnStyle('#2e2e2e', '#e8e4dc')}>
            Back
          </button>
        )}
        <button onClick={() => setState(p => ({ ...p, currentStep: Math.min(p.currentStep + 1, STEPS.length - 1) }))}
          style={btnStyle('#c0392b', '#fff')}>
          {state.currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>

    </main>
  )
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: '0.5rem 1.25rem',
    background: bg,
    color,
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'monospace',
  }
}