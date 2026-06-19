'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getCachedAuth } from '../../../../lib/auth-cache'
import { isThriver as roleIsThriver } from '../../../../lib/auth/roles'
import { getUserRole } from '../../../../lib/data/campaigns'
import { loadPregenById, updatePregen } from '../../../../lib/data/pregens'
import { createWizardState, WizardState, buildCharacter, getCumulativeSkills, skillStepUp, skillStepDown } from '../../../../lib/xse-engine'
import { SKILLS, SKILL_LABELS, PROFESSIONS, normalizeRations } from '../../../../lib/xse-schema'
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
  { num: 5, title: 'Skills' },
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
        {step === 5 && <SkillsPanel state={state} onChange={handleChange} />}
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
          {step < 5
            ? <button onClick={() => setStep(s => Math.min(5, s + 1))} style={navBtn(true)}>Next</button>
            : <button onClick={handleSave} disabled={saving || saved} style={{ ...navBtn(true), opacity: saving || saved ? 0.6 : 1 }}>{saving ? 'Saving...' : saved ? 'Saved' : 'Save Pregen'}</button>
          }
        </div>
      </div>

      <PrintSheet state={state} />
    </div>
  )
}

function SkillsPanel({ state, onChange }: { state: WizardState; onChange: (u: Partial<WizardState>) => void }) {
  const [filter, setFilter] = useState('')
  const cumulativeSkills = getCumulativeSkills(state.steps)
  const step3 = state.steps[3] ?? {}
  const skillDeltas = step3.skillDeltas ?? {}
  const raisedCount = Object.values(skillDeltas).filter(v => (v ?? 0) > 0).length

  function adjustSkill(skillName: string, dir: 1 | -1) {
    const skill = SKILLS.find(s => s.name === skillName)!
    const cumVal = cumulativeSkills[skillName] as any
    const baseVal = skill.vocational ? -3 : 0
    let newLevel: number
    if (dir === 1) {
      if (cumVal >= 3) return
      newLevel = skillStepUp(cumVal, skill.vocational)
    } else {
      if (cumVal <= baseVal) return
      newLevel = skillStepDown(cumVal, baseVal as any, skill.vocational)
    }
    const delta = newLevel - baseVal
    const newDeltas = { ...skillDeltas }
    if (delta <= 0) delete newDeltas[skillName]
    else newDeltas[skillName] = delta
    const newSteps = [...state.steps]
    newSteps[3] = { ...step3, skillDeltas: newDeltas }
    onChange({ steps: newSteps })
  }

  const filtered = SKILLS.filter(s =>
    !filter ||
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.attribute.toLowerCase().includes(filter.toLowerCase())
  )

  const panelSh: React.CSSProperties = {
    fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 600, color: '#f5f2ee',
    textTransform: 'uppercase', letterSpacing: '.1em', margin: '1.25rem 0 8px',
    borderBottom: '1px solid #2e2e2e', paddingBottom: '4px',
  }

  return (
    <div>
      <div style={panelSh}>Profession</div>
      <select
        value={step3.profession ?? ''}
        onChange={e => {
          const newSteps = [...state.steps]
          newSteps[3] = { ...step3, profession: e.target.value }
          onChange({ steps: newSteps })
        }}
        style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', marginBottom: '10px' }}>
        <option value="">- select -</option>
        {PROFESSIONS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
      </select>

      <div style={{ ...panelSh, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem' }}>
        <span>Skills</span>
        <span style={{ fontSize: '13px', color: '#7ab3d4', fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>{raisedCount} raised above base</span>
      </div>
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Filter skills..."
        style={{ width: '100%', marginBottom: '7px', fontSize: '13px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '8px 10px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxHeight: '380px', overflowY: 'auto', paddingRight: '2px' }}>
        {filtered.map(sk => {
          const cumVal = cumulativeSkills[sk.name]
          const baseVal = sk.vocational ? -3 : 0
          const raised = (skillDeltas[sk.name] ?? 0) > 0
          const disp = cumVal >= 0 ? (cumVal > 0 ? `+${cumVal}` : '0') : String(cumVal)
          return (
            <div key={sk.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: `1px ${sk.vocational ? 'dashed' : 'solid'} #2e2e2e`, borderRadius: '3px', padding: '5px 7px', background: '#242424' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: raised ? '#f5a89a' : '#f5f2ee' }}>
                  {sk.name}{sk.vocational ? '*' : ''}
                </div>
                <div style={{ fontSize: '13px', color: '#7a7068' }}>{sk.attribute} - {SKILL_LABELS[cumVal]}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                <button onClick={() => adjustSkill(sk.name, -1)} disabled={cumVal <= baseVal} style={skPanelBtn(cumVal <= baseVal)}>-</button>
                <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '22px', textAlign: 'center', fontFamily: 'Carlito, sans-serif', color: cumVal < 0 ? '#f5a89a' : '#f5f2ee' }}>{disp}</span>
                <button onClick={() => adjustSkill(sk.name, 1)} disabled={cumVal >= 3} style={skPanelBtn(cumVal >= 3)}>+</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function skPanelBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '19px', height: '19px', border: '1px solid #3a3a3a', borderRadius: '2px',
    background: '#1a1a1a', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px', color: '#f5f2ee', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 0, lineHeight: 1, opacity: disabled ? 0.18 : 1,
  }
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
