'use client'
import { useState } from 'react'
import { createWizardState, WizardState } from '../../../lib/xse-engine'
import StepXero from '../../../components/wizard/StepXero'
import StepAttr from '../../../components/wizard/StepAttr'
import StepFour from '../../../components/wizard/StepFour'
import StepSix from '../../../components/wizard/StepSix'
import StepSeven from '../../../components/wizard/StepSeven'
import StepEight from '../../../components/wizard/StepEight'
import StepNine from '../../../components/wizard/StepNine'

const STEPS = [
  { num: 0, short: 'Zero',  title: 'Character Concept' },
  { num: 1, short: 'One',   title: 'Where They Grew Up' },
  { num: 2, short: 'Two',   title: 'What They Learned' },
  { num: 3, short: 'Three', title: 'What They Liked To Do' },
  { num: 4, short: 'Four',  title: 'How They Made Money' },
  { num: 5, short: 'Five',  title: 'What They Learned After' },
  { num: 6, short: 'Six',   title: 'What Drives Them?' },
  { num: 7, short: 'Seven', title: 'Secondary Stats' },
  { num: 8, short: 'Eight', title: 'What They Have' },
  { num: 9, short: 'Nine',  title: 'Final Review' },
]

const STEP_DESC = [
  '<p>Define your character concept.</p><p>This includes name, age, gender, height, weight, as well as three words that anchor who they are.</p><p>Write a sentence or two that sums them up.</p>',
  '<p>The first 10-15 years of their life.</p><p>Spend 1 CDP raising an attribute to +1 (Good).</p><p>Spend 2 CDP raising skills.</p><p>Any 1 skill may be raised from 0 (Untrained) to +2 (Journeyman).</p><p>Any 2 skills may be raised from 0 (Untrained) to +1 (Beginner).</p><p>Vocational skills marked with an * (such as Demolitions) go from -3 (Inept) to +1 (Beginner) for 1 CDP.</p><p>Write a sentence or two about where they grew up, who was present, and what their life was like.</p>',
  '<p>The educational stage.</p><p>Raise one RAPID attribute by 1. Attributes can be raised to +2 (Strong) during this step.</p><p>Spend 3 CDP on skills. Skills cannot be raised above +2 (Journeyman) in this phase.</p><p>Write a sentence or two about what they learned, where they learned it, and who they learned it from.</p>',
  '<p>Hobbies and spare time.</p><p>Raise one RAPID attribute to a max of +2 (Strong).</p><p>Spend 3 CDP on skills. No skill can go above +2 (Journeyman) in this step.</p><p>Write a sentence or two about how this character spends their spare time and what they learned from their hobbies.</p>',
  '<p>Career and vocation.</p><p>Choose a Profession — the associated vocation skills are highlighted. These are recommendations, not mandatory choices.</p><p>Spend 2 CDP on attributes. Attributes cannot be raised beyond +3 (Exceptional).</p><p>Spend 4 CDP on skills. Skills cannot be raised beyond +3 (Professional).</p><p>Write a sentence or two about what this character did for work before the Dog Flu.</p>',
  '<p>This new world is nothing but harsh lessons and struggles since civilization fell apart.</p><p>Survivors have all had to pick up some new tricks in order to get by.</p><p>Spend 3 CDP on skills. Skills can be raised to +3 (Professional) during this stage.</p>',
  '<p>Choose or roll a Complication and Motivation.</p><p>These are narrative tools to help with roleplay and character definition, not mechanical penalties.</p>',
  '<p>Secondary stats are derived automatically from RAPID attributes.</p><p>No action is required during this step.</p>',
  '<p>Choose a primary weapon, and a secondary weapon.</p><p>It is recommended to pick a melee and a ranged weapon.</p><p>Ranged weapons start with 1d3 reloads of ammo.</p><p>You should also pick one piece of equipment and one incidental item.</p>',
  'Review your character and print the sheet when ready.',
]

export default function NewCharacterPage() {
  const [state, setState] = useState<WizardState>(createWizardState)

  function handleChange(updated: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...updated }))
  }

  const step = state.currentStep

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid var(--accent)', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text)' }}>
          Distemper Character Generator
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '.1em', textTransform: 'uppercase', flex: 1, textAlign: 'right' }}>
          DistemperVerse
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              border: `1px solid ${i === step ? 'var(--accent)' : 'var(--border2)'}`,
              background: i < step ? 'var(--accent)' : i === step ? 'var(--accent-lt)' : 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '9px', fontWeight: 700,
              color: i < step ? '#fff' : i === step ? 'var(--accent)' : 'var(--text3)',
              transition: 'all .2s', flexShrink: 0,
            }}>
              {i}
            </div>
          </div>
        ))}
      </div>

      {/* Step card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem', borderLeft: '3px solid var(--accent)' }}>
        <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '3px' }}>
          Step {step} of 9
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '8px', color: 'var(--text)' }}>
          {STEPS[step].title}
        </div>
         <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{ __html: STEP_DESC[step].replace(/<p>/g, '<p style="margin:0">') }}
        />
      </div>

      {/* Step content */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }}>
        {step === 0 && <StepXero state={state} onChange={handleChange} />}
        {step === 1 && <StepAttr stepIndex={0} stepNumber={1} stepTitle="Where they grew up" skillBudget={2} maxAttr={1} maxSkill={2} placeholder="1–2 sentences: what happened in their early years?" state={state} onChange={handleChange} />}
        {step === 2 && <StepAttr stepIndex={1} stepNumber={2} stepTitle="What they learned" skillBudget={3} maxAttr={2} maxSkill={2} placeholder="1–2 sentences: what did they study or learn?" state={state} onChange={handleChange} />}
        {step === 3 && <StepAttr stepIndex={2} stepNumber={3} stepTitle="What they liked to do" skillBudget={3} maxAttr={2} maxSkill={2} placeholder="1–2 sentences: hobbies, habits, spare time?" state={state} onChange={handleChange} />}
        {step === 4 && <StepFour state={state} onChange={handleChange} />}
        {step === 5 && <StepAttr stepIndex={4} stepNumber={5} stepTitle="What they learned after" skillBudget={3} maxAttr={0} maxSkill={3} placeholder="1–2 sentences: what new skills did they pick up after the world fell apart?" state={state} onChange={handleChange} />}
        {step === 6 && <StepSix state={state} onChange={handleChange} />}
        {step === 7 && <StepSeven state={state} />}
        {step === 8 && <StepEight state={state} onChange={handleChange} />}
        {step === 9 && <StepNine state={state} onChange={handleChange} />}
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setState(p => ({ ...p, currentStep: Math.max(0, p.currentStep - 1) }))}
          disabled={step === 0}
          style={navBtn(false)}>
          Back
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Step {step} of 9
          </div>
        </div>
        <button
          onClick={() => setState(p => ({ ...p, currentStep: Math.min(9, p.currentStep + 1) }))}
          style={navBtn(true)}>
          {step === 9 ? 'Finish' : 'Next'}
        </button>
      </div>

    </div>
  )
}

function navBtn(primary: boolean): React.CSSProperties {
  return {
    padding: '9px 22px', borderRadius: '3px', fontSize: '13px', cursor: 'pointer',
    border: `1px solid ${primary ? 'var(--accent)' : 'var(--border2)'}`,
    background: primary ? 'var(--accent)' : 'var(--surface2)',
    color: primary ? '#fff' : 'var(--text2)',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
    transition: 'all .15s',
  }
}