const fs = require('fs');

const content = `'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-browser'
import { createWizardState, WizardState, buildCharacter } from '../../../../lib/xse-engine'
import { SKILLS } from '../../../../lib/xse-schema'
import StepXero from '../../../../components/wizard/StepXero'
import StepSix from '../../../../components/wizard/StepSix'
import StepSeven from '../../../../components/wizard/StepSeven'
import StepEight from '../../../../components/wizard/StepEight'
import StepNine from '../../../../components/wizard/StepNine'

const STEPS = [
  { num: 0, title: 'Character Concept' },
  { num: 1, title: 'What Drives Them?' },
  { num: 2, title: 'Secondary Stats' },
  { num: 3, title: 'What They Have' },
  { num: 4, title: 'Final Review' },
]

export default function EditCharacterPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [state, setState] = useState<WizardState | null>(null)
  const [characterName, setCharacterName] = useState('')
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: row, error } = await supabase
        .from('characters')
        .select('id, name, data')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (error || !row) { router.push('/characters'); return }
      const d = row.data
      setCharacterName(row.name)
      const skillDeltas: Partial<Record<string, number>> = {}
      if (d.skills) {
        for (const s of d.skills) {
          const sk = SKILLS.find((x: any) => x.name === s.skillName)
          const baseVal = sk?.vocational ? -3 : 0
          if (s.level > baseVal) skillDeltas[s.skillName] = s.level - baseVal
        }
      }
      const attrSpent: Partial<Record<string, number>> = {}
      if (d.rapid) {
        for (const [k, v] of Object.entries(d.rapid)) {
          if ((v as number) > 0) attrSpent[k] = v as number
        }
      }
      const base = createWizardState()
      const reconstructed: WizardState = {
        ...base,
        name: d.name ?? '',
        nickname: d.nickname ?? '',
        age: d.age ?? '',
        gender: d.gender ?? '',
        height: d.height ?? '',
        weight: d.weight ?? '',
        concept: d.notes ?? '',
        physdesc: d.physdesc ?? '',
        photoDataUrl: d.photoDataUrl ?? '',
        threeWords: d.threeWords ?? ['', '', ''],
        weaponPrimary: d.weaponPrimary?.weaponName ?? '',
        weaponSecondary: d.weaponSecondary?.weaponName ?? '',
        primaryAmmo: d.weaponPrimary?.ammoCurrent ?? 0,
        secondaryAmmo: d.weaponSecondary?.ammoCurrent ?? 0,
        equipment: d.equipment?.[0] ?? '',
        incidentalItem: d.incidentalItem ?? '',
        rations: d.rations ?? '',
        steps: [
          { attrKey: null, skillDeltas: {}, skillCDPSpent: 0 },
          { attrKey: null, skillDeltas: {}, skillCDPSpent: 0 },
          { attrKey: null, skillDeltas: {}, skillCDPSpent: 0 },
          { attrSpent, skillDeltas, skillCDPSpent: 0, profession: d.profession ?? '' },
          { skillDeltas: {}, skillCDPSpent: 0 },
          { complication: d.complication ?? '', motivation: d.motivation ?? '' },
          {},
        ],
      }
      setState(reconstructed)
      setLoading(false)
    }
    load()
  }, [id])

  function handleChange(updated: Partial<WizardState>) {
    setState(prev => prev ? { ...prev, ...updated } : prev)
  }

  async function handleSave() {
    if (!state) return
    setSaving(true)
    setSaveError('')
    const character = buildCharacter(state)
    const { error } = await supabase
      .from('characters')
      .update({ name: character.name || characterName, data: character })
      .eq('id', id)
    if (error) { setSaveError(error.message); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    setTimeout(() => router.push('/characters'), 800)
  }

  function handlePrint() {
    const el = document.getElementById('print-sheet-container')
    if (el) el.style.display = 'block'
    window.print()
    if (el) el.style.display = 'none'
  }

  if (loading || !state) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Edit Character
        </div>
        <div style={{ fontSize: '11px', color: '#b0aaa4', letterSpacing: '.1em', textTransform: 'uppercase', flex: 1, textAlign: 'right' }}>
          {characterName}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '1.25rem' }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', border: \`1px solid \${i === step ? '#c0392b' : '#3a3a3a'}\`, background: i < step ? '#c0392b' : i === step ? '#2a1210' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '9px', fontWeight: 700, color: i < step ? '#fff' : i === step ? '#c0392b' : '#b0aaa4', flexShrink: 0 }}>
            {i}
          </div>
        ))}
      </div>
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem', borderLeft: '3px solid #c0392b' }}>
        <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '3px' }}>Step {step} of 4</div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '8px', color: '#f5f2ee' }}>{STEPS[step].title}</div>
      </div>
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }}>
        {step === 0 && <StepXero state={state} onChange={handleChange} />}
        {step === 1 && <StepSix state={state} onChange={handleChange} />}
        {step === 2 && <StepSeven state={state} />}
        {step === 3 && <StepEight state={state} onChange={handleChange} />}
        {step === 4 && <StepNine state={state} onChange={handleChange} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #2e2e2e' }}>
        <button onClick={() => { setStep(s => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} disabled={step === 0} style={navBtn(false)}>Back</button>
        <div style={{ textAlign: 'center' }}>
          {saveError && <div style={{ fontSize: '11px', color: '#f5a89a', marginBottom: '2px' }}>{saveError}</div>}
          {saved && <div style={{ fontSize: '11px', color: '#7fc458', marginBottom: '2px' }}>Saved!</div>}
          <div style={{ fontSize: '11px', color: '#b0aaa4', letterSpacing: '.05em', textTransform: 'uppercase' }}>Step {step} of 4</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {step === 4 && <button onClick={handlePrint} style={{ ...navBtn(false), borderColor: '#2d5a1b', color: '#7fc458' }}>Print</button>}
          {step < 4
            ? <button onClick={() => { setStep(s => Math.min(4, s + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={navBtn(true)}>Advance</button>
            : <button onClick={handleSave} disabled={saving || saved} style={{ ...navBtn(true), opacity: saving || saved ? 0.6 : 1 }}>{saving ? 'Saving...' : saved ? 'Saved \u2713' : 'Save Changes'}</button>
          }
        </div>
      </div>
    </div>
  )
}

function navBtn(primary: boolean): React.CSSProperties {
  return {
    padding: '9px 22px', borderRadius: '3px', fontSize: '13px', cursor: 'pointer',
    border: \`1px solid \${primary ? '#c0392b' : '#3a3a3a'}\`,
    background: primary ? '#c0392b' : '#242424',
    color: primary ? '#fff' : '#f5f2ee',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
    transition: 'all .15s',
  }
}
`;

fs.writeFileSync('C:/TheTapestry/app/characters/[id]/edit/page.tsx', content, 'utf8');
console.log('done');
