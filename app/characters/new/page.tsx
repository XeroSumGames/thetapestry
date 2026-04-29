'use client'
import { useState, useEffect } from 'react'
import { createWizardState, WizardState, buildCharacter } from '../../../lib/xse-engine'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter, useSearchParams } from 'next/navigation'
import { logFirstEvent } from '../../../lib/events'
import GhostWall from '../../../components/GhostWall'
import StepXero from '../../../components/wizard/StepXero'
import StepAttr from '../../../components/wizard/StepAttr'
import StepFour from '../../../components/wizard/StepFour'
import StepSix from '../../../components/wizard/StepSix'
import StepSeven from '../../../components/wizard/StepSeven'
import StepEight from '../../../components/wizard/StepEight'
import StepNine from '../../../components/wizard/StepNine'
import PrintSheet from '../../../components/wizard/PrintSheet'

const STEPS = [
  { num: 0, title: 'Character Concept' },
  { num: 1, title: 'Where They Grew Up' },
  { num: 2, title: 'What They Learned' },
  { num: 3, title: 'What They Liked To Do' },
  { num: 4, title: 'How They Made Money' },
  { num: 5, title: 'What They Learned After' },
  { num: 6, title: 'What Drives Them?' },
  { num: 7, title: 'Secondary Stats' },
  { num: 8, title: 'What They Have' },
  { num: 9, title: 'Final Review' },
]

const STEP_FLAVOR = [
  'Define your character concept — name, age, gender, height, weight, and three words that anchor who they are. Write a sentence or two that sums them up.',
  'This step covers the first 10-15 years of their life. Write a sentence or two about where they grew up, who was present, and what their life was like.',
  'This is the educational stage of life. Write a sentence or two about where they studied, what they learned, who they learned it from, and what lessons they took from it.',
  'This covers their hobbies and spare time. Write a sentence or two about their passions, how they spent their free time, and what knowledge they picked up along the way.',
  'This step details their career and vocation. Write a sentence or two about what this character did for work or how they made money before the Dog Flu.',
  'This new world is nothing but harsh lessons and struggles since civilization fell apart. Survivors have all had to pick up new tricks just to get by. Write a sentence or two about what they learned after the world they knew ended.',
  'Choose or roll a Complication and Motivation. These are narrative tools to help with roleplay and character definition.',
  'Secondary stats are derived automatically from your RAPID attributes and affect different elements of gameplay.',
  'Choose a primary weapon and a secondary weapon. It is recommended to pick one melee and one ranged. Ranged weapons start with 1d3 reloads of ammo. Pick one piece of equipment and one incidental item.',
  'Review your character and save when ready.',
]

const STEP_INSTRUCTIONS: (string | null)[] = [
  null,
  'You have 1 Attribute CDP. Raise one RAPID attribute from 0 (Average) to +1 (Good).|You have 2 Skill CDP. Raise one skill to +2 (Journeyman), or two skills to +1 (Beginner).|Vocational skills marked with * start at -3 (Inept) and cost 1 CDP to reach +1 (Beginner).',
  'You have 1 Attribute CDP. Raise one RAPID attribute up to +2 (Strong).|You have 3 Skill CDP. No skill can be raised above +2 (Journeyman) in this step.',
  'You have 1 Attribute CDP. Raise one RAPID attribute up to +2 (Strong).|You have 3 Skill CDP. No skill can be raised above +2 (Journeyman) in this step.',
  'Choose a Profession — its vocational skills are highlighted.|You have 2 Attribute CDP. Attributes cannot be raised beyond +3 (Exceptional).|You have 4 Skill CDP. Skills cannot be raised beyond +3 (Professional).',
  'You have 3 Skill CDP. Skills can be raised up to +3 (Professional) during this stage.',
  null,
  null,
  null,
  null,
]

export default function NewCharacterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // If the user arrived from a campaign's "My Survivor" shortcut, the story
  // id travels in ?return=<id>. After saving we bounce them right back there
  // so they don't have to retrace the navigation themselves.
  const returnStoryId = searchParams.get('return')
  const supabase = createClient()
  const [state, setState] = useState<WizardState>(createWizardState)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isAuth, setIsAuth] = useState<boolean | null>(null)
  const [showGhostWall, setShowGhostWall] = useState(false)

  useEffect(() => {
    getCachedAuth().then(({ user }) => setIsAuth(!!user))
  }, [])

  const step = state.currentStep

  function requireAuth() {
    if (isAuth === false) { setShowGhostWall(true); return true }
    return false
  }

  function handleChange(updated: Partial<WizardState>) {
    if (requireAuth()) return
    setState(prev => ({ ...prev, ...updated }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    const supabase = createClient()
    const { user } = await getCachedAuth()
    if (!user) { setSaveError('Not logged in.'); setSaving(false); return }
    const character = buildCharacter(state)
    const { error } = await supabase.from('characters').insert({
      user_id: user.id,
      name: character.name || 'Unnamed Character',
      data: character,
    })
    if (error) { setSaveError(error.message); setSaving(false); return }
    logFirstEvent('first_character_created', { name: character.name })
    setSaved(true)
    setSaving(false)
    if (returnStoryId) router.push(`/stories/${returnStoryId}`)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Distemper Character Generator
        </div>
        <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.1em', textTransform: 'uppercase', flex: 1, textAlign: 'right' }}>
          DistemperVerse
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => { if (requireAuth()) return; setState(p => ({ ...p, currentStep: i })); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            style={{
              width: '28px', height: '28px', borderRadius: '50%',
              border: `1px solid ${i === step ? '#c0392b' : '#3a3a3a'}`,
              background: i < step ? '#c0392b' : i === step ? '#2a1210' : '#1a1a1a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '13px', fontWeight: 700,
              color: i < step ? '#fff' : i === step ? '#c0392b' : '#d4cfc9',
              transition: 'all .2s', flexShrink: 0, cursor: 'pointer', padding: 0,
            }}>
              {i}
          </button>
        ))}
      </div>

      {/* Step card */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem', borderLeft: '3px solid #c0392b' }}>
        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '3px' }}>
          Step {step} of 9
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '10px', color: '#f5f2ee' }}>
          {STEPS[step].title}
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#d4cfc9', lineHeight: 1.8, fontStyle: 'italic' }}>
          {STEP_FLAVOR[step]}
        </p>
        {STEP_INSTRUCTIONS[step] && (
          <div style={{ background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', padding: '10px 14px' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px', color: '#7fc458' }}>
              Instructions
            </div>
            {STEP_INSTRUCTIONS[step]!.split('|').map((line, i) => (
              <p key={i} style={{ margin: '0 0 4px', fontSize: '13px', color: '#7fc458', lineHeight: 1.7 }}>{line}</p>
            ))}
          </div>
        )}
      </div>

      {/* Step content */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }}>
        {step === 0 && <StepXero state={state} onChange={handleChange} />}
        {step === 1 && <StepAttr stepIndex={0} stepNumber={1} stepTitle="Where they grew up" skillBudget={2} maxAttr={1} maxSkill={2} placeholder="1-2 sentences: what happened in their early years?" state={state} onChange={handleChange} />}
        {step === 2 && <StepAttr stepIndex={1} stepNumber={2} stepTitle="What they learned" skillBudget={3} maxAttr={2} maxSkill={2} placeholder="1-2 sentences: what did they study or learn?" state={state} onChange={handleChange} />}
        {step === 3 && <StepAttr stepIndex={2} stepNumber={3} stepTitle="What they liked to do" skillBudget={3} maxAttr={2} maxSkill={2} placeholder="1-2 sentences: hobbies, habits, spare time?" state={state} onChange={handleChange} />}
        {step === 4 && <StepFour state={state} onChange={handleChange} />}
        {step === 5 && <StepAttr stepIndex={4} stepNumber={5} stepTitle="What they learned after" skillBudget={3} maxAttr={0} maxSkill={3} placeholder="1-2 sentences: what new skills did they pick up after the world fell apart?" state={state} onChange={handleChange} />}
        {step === 6 && <StepSix state={state} onChange={handleChange} />}
        {step === 7 && <StepSeven state={state} />}
        {step === 8 && <StepEight state={state} onChange={handleChange} />}
        {step === 9 && <StepNine state={state} onChange={handleChange} />}
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #2e2e2e' }}>
        <button
          onClick={() => { if (requireAuth()) return; setState(p => ({ ...p, currentStep: Math.max(0, p.currentStep - 1) })); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          disabled={step === 0}
          style={navBtn(false)}>
          Back
        </button>
        <div style={{ textAlign: 'center' }}>
          {saveError && <div style={{ fontSize: '13px', color: '#f5a89a', marginBottom: '2px' }}>{saveError}</div>}
          {saved && <div style={{ fontSize: '13px', color: '#7fc458', marginBottom: '2px' }}>Character saved!</div>}
          <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Step {step} of 9
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {step === 9 && (
            <button onClick={handlePrint} style={{ ...navBtn(false), borderColor: '#2d5a1b', color: '#7fc458' }}>
              Print Character
            </button>
          )}
          {step < 9
            ? <button onClick={() => { if (requireAuth()) return; setState(p => ({ ...p, currentStep: Math.min(9, p.currentStep + 1) })); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={navBtn(true)}>
                Advance
              </button>
            : <button onClick={handleSave} disabled={saving || saved} style={{ ...navBtn(true), opacity: saving || saved ? 0.6 : 1 }}>
                {saving ? 'Saving...' : saved ? 'Saved' : 'Save Character'}
              </button>
          }
        </div>
      </div>

      {/* Print sheet - hidden on screen, visible on print */}
      <div className="print-sheet-container">
        <PrintSheet state={state} />
      </div>

      <GhostWall show={showGhostWall} onClose={() => setShowGhostWall(false)} message="Create an account to save your character and join stories." />
    </div>
  )
}

function navBtn(primary: boolean): React.CSSProperties {
  return {
    padding: '9px 22px', borderRadius: '3px', fontSize: '13px', cursor: 'pointer',
    border: `1px solid ${primary ? '#c0392b' : '#3a3a3a'}`,
    background: primary ? '#c0392b' : '#242424',
    color: primary ? '#fff' : '#f5f2ee',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
    transition: 'all .15s',
  }
}
