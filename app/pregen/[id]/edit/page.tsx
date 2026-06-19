'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getCachedAuth } from '../../../../lib/auth-cache'
import { isThriver as roleIsThriver } from '../../../../lib/auth/roles'
import { getUserRole } from '../../../../lib/data/campaigns'
import { loadPregenById, updatePregen } from '../../../../lib/data/pregens'
import { createWizardState, WizardState, buildCharacter } from '../../../../lib/xse-engine'
import { SKILLS, normalizeRations } from '../../../../lib/xse-schema'
import StepXero from '../../../../components/wizard/StepXero'
import StepSix from '../../../../components/wizard/StepSix'
import StepSeven from '../../../../components/wizard/StepSeven'
import StepEight from '../../../../components/wizard/StepEight'
import StepNine from '../../../../components/wizard/StepNine'
import PrintSheet from '../../../../components/wizard/PrintSheet'

const STEPS = [
  { num: 0, title: 'Character Concept' },
  { num: 1, title: 'What Drives Them?' },
  { num: 2, title: 'Secondary Stats' },
  { num: 3, title: 'What They Have' },
  { num: 4, title: 'Final Review' },
]

export default function EditPregenPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [state, setState] = useState<WizardState | null>(null)
  const [pregenName, setPregenName] = useState('')
  const [step, setStep] = useState(4)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isThriverUser, setIsThriverUser] = useState(false)

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await getUserRole(user.id)
      const thriver = roleIsThriver(prof)
      setIsThriverUser(thriver)

      const { data: pregen, error } = await loadPregenById(id)
      if (error || !pregen) { router.push('/characters'); return }

      // Non-Thriver can only edit their own pregens
      if (!thriver && (pregen as any).author_id !== user.id) { router.push('/characters'); return }

      setPregenName((pregen as any).name ?? '')
      const d = (pregen as any).data as any

      const skillDeltas: Partial<Record<string, number>> = {}
      if (d?.skills) {
        for (const s of d.skills) {
          const sk = SKILLS.find((x: any) => x.name === s.skillName)
          const baseVal = sk?.vocational ? -3 : 0
          if (s.level > baseVal) skillDeltas[s.skillName] = s.level - baseVal
        }
      }
      const attrSpent: Partial<Record<string, number>> = {}
      if (d?.rapid) {
        for (const [k, v] of Object.entries(d.rapid)) {
          if ((v as number) > 0) attrSpent[k] = v as number
        }
      }
      const base = createWizardState()
      const reconstructed: WizardState = {
        ...base,
        name: d?.name ?? '',
        nickname: d?.nickname ?? '',
        age: d?.age ?? '',
        gender: d?.gender ?? '',
        height: d?.height ?? '',
        weight: d?.weight ?? '',
        concept: d?.notes ?? '',
        physdesc: d?.physdesc ?? '',
        photoDataUrl: d?.photoDataUrl ?? '',
        threeWords: d?.threeWords ?? ['', '', ''],
        weaponPrimary: d?.weaponPrimary?.weaponName ?? '',
        weaponSecondary: d?.weaponSecondary?.weaponName ?? '',
        primaryAmmo: d?.weaponPrimary?.ammoCurrent ?? 0,
        secondaryAmmo: d?.weaponSecondary?.ammoCurrent ?? 0,
        primaryQty: d?.weaponPrimary?.qty ?? 1,
        secondaryQty: d?.weaponSecondary?.qty ?? 1,
        equipment: d?.equipment?.[0] ?? '',
        incidentalItem: d?.incidentalItem ?? '',
        rations: normalizeRations(d?.rations).type,
        steps: [
          { attrKey: null, skillDeltas: {}, skillCDPSpent: 0 },
          { attrKey: null, skillDeltas: {}, skillCDPSpent: 0 },
          { attrKey: null, skillDeltas: {}, skillCDPSpent: 0 },
          { attrSpent, skillDeltas, skillCDPSpent: 0, profession: d?.profession ?? '' },
          { skillDeltas: {}, skillCDPSpent: 0 },
          { complication: d?.complication ?? '', motivation: d?.motivation ?? '' },
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
    const now = new Date().toISOString()
    const { error } = await updatePregen(id, {
      name: character.name || pregenName || 'Unnamed Character',
      data: character as unknown as import('../../../../lib/database.types').Json,
      portrait_url: (character as any).photoDataUrl ?? null,
      // Thriver edits stay approved; GM edits reset to pending for re-review
      moderation_status: isThriverUser ? 'approved' : 'pending',
      approved_by: isThriverUser ? undefined : null,
      approved_at: isThriverUser ? now : null,
    })
    if (error) { setSaveError(error.message); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    setTimeout(() => router.push('/characters'), 800)
  }

  function handlePrint() { window.print() }

  if (loading || !state) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Carlito, sans-serif' }}>
      <div style={{ marginBottom: '16px' }}>
        <a href="/characters" style={{ fontSize: '13px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.08em', textDecoration: 'none' }}>
          &larr; My Characters
        </a>
      </div>
      <div style={{ fontSize: '13px', color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '4px' }}>
        Editing Pregen
      </div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
        {pregenName}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {STEPS.map(s => (
          <button key={s.num} onClick={() => setStep(s.num)}
            style={{ padding: '5px 14px', background: step === s.num ? '#1a2e10' : '#1a1a1a', border: `1px solid ${step === s.num ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: step === s.num ? '#7fc458' : '#8a8a8a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', letterSpacing: '.04em' }}>
            {s.title}
          </button>
        ))}
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }}>
        {step === 0 && <StepXero state={state} onChange={handleChange} />}
        {step === 1 && <StepSix state={state} onChange={handleChange} />}
        {step === 2 && <StepSeven state={state} />}
        {step === 3 && <StepEight state={state} onChange={handleChange} />}
        {step === 4 && <StepNine state={state} onChange={handleChange} />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #2e2e2e' }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={navBtn(false)}>Back</button>
        <div style={{ textAlign: 'center' }}>
          {saveError && <div style={{ fontSize: '13px', color: '#f5a89a', marginBottom: '2px' }}>{saveError}</div>}
          {saved && <div style={{ fontSize: '13px', color: '#7fc458', marginBottom: '2px' }}>Saved!</div>}
          {!isThriverUser && <div style={{ fontSize: '13px', color: '#7a7068' }}>Saving will resubmit for approval</div>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {step === 4 && <button onClick={handlePrint} style={{ ...navBtn(false), borderColor: '#2d5a1b', color: '#7fc458' }}>Print</button>}
          {step < 4
            ? <button onClick={() => setStep(s => Math.min(4, s + 1))} style={navBtn(true)}>Next</button>
            : <button onClick={handleSave} disabled={saving || saved} style={{ ...navBtn(true), opacity: saving || saved ? 0.6 : 1 }}>{saving ? 'Saving...' : saved ? 'Saved' : 'Save Pregen'}</button>
          }
        </div>
      </div>

      <PrintSheet state={state} />
    </div>
  )
}

function navBtn(primary: boolean): React.CSSProperties {
  return {
    padding: '8px 20px', background: primary ? '#1a2e10' : '#1a1a1a',
    border: `1px solid ${primary ? '#2d5a1b' : '#2e2e2e'}`,
    borderRadius: '3px', color: primary ? '#7fc458' : '#f5f2ee',
    fontSize: '13px', fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
  }
}
