'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import PrintSheet from '../../components/wizard/PrintSheet'
import { WizardState, createWizardState } from '../../lib/xse-engine'

interface CharacterRow {
  id: string
  name: string
  created_at: string
  data: any
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('characters')
        .select('id, name, created_at, data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setCharacters(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('characters').delete().eq('id', id)
    setCharacters(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  async function handleDuplicate(c: CharacterRow) {
    setDuplicating(c.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('characters').insert({
      user_id: user.id,
      name: `Copy of ${c.name}`,
      data: c.data,
    })
    const { data } = await supabase
      .from('characters')
      .select('id, name, created_at, data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setCharacters(data ?? [])
    setDuplicating(null)
  }

  function handlePrint(id: string) {
    setPrintingId(id)
    setTimeout(() => {
      const el = document.getElementById(`print-container-${id}`)
      if (el) el.style.display = 'block'
      window.print()
      if (el) el.style.display = 'none'
      setPrintingId(null)
    }, 100)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

  // Convert saved XSECharacter data back to a WizardState-compatible shape for PrintSheet
  function toWizardState(data: any): WizardState {
    const base = createWizardState()
    return {
      ...base,
      name: data.name ?? '',
      gender: data.gender ?? '',
      height: data.height ?? '',
      weight: data.weight ?? '',
      concept: data.notes ?? '',
      physdesc: data.physdesc ?? '',
      photoDataUrl: data.photoDataUrl ?? '',
      threeWords: data.threeWords ?? ['', '', ''],
      weaponPrimary: data.weaponPrimary?.weaponName ?? '',
      weaponSecondary: data.weaponSecondary?.weaponName ?? '',
      primaryAmmo: data.weaponPrimary?.ammoCurrent ?? 0,
      secondaryAmmo: data.weaponSecondary?.ammoCurrent ?? 0,
      equipment: data.equipment?.[0] ?? '',
      incidentalItem: data.incidentalItem ?? '',
      rations: data.rations ?? '',
      steps: [
        { attrKey: null, skillDeltas: {}, skillCDPSpent: 0, note: '', complication: data.complication, motivation: data.motivation },
        { attrKey: null, skillDeltas: {}, skillCDPSpent: 0, note: '' },
        { attrKey: null, skillDeltas: {}, skillCDPSpent: 0, note: '' },
        { attrSpent: {}, skillDeltas: {}, skillCDPSpent: 0, profession: data.profession ?? '', note: '' },
        { skillDeltas: {}, skillCDPSpent: 0, note: '' },
        { complication: data.complication ?? '', motivation: data.motivation ?? '' },
        {},
      ],
    }
  }

  if (loading) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          My Characters
        </div>
        <div style={{ flex: 1 }} />
        <a href="/characters/new" style={{ padding: '7px 18px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          New Character
        </a>
      </div>

      {/* Empty state */}
      {characters.length === 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#b0aaa4', marginBottom: '1rem' }}>No characters yet.</div>
          <a href="/characters/new" style={{ padding: '9px 22px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Create your first character
          </a>
        </div>
      )}

      {/* Character list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {characters.map(c => {
          const rapid = c.data?.rapid ?? {}
          const attrKeys = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
          const wizardState = toWizardState(c.data)
          return (
            <div key={c.id}>
              <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', borderLeft: '3px solid #c0392b' }}>

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  {c.data?.photoDataUrl && (
                    <img src={c.data.photoDataUrl} alt={c.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #3a3a3a', flexShrink: 0, marginRight: '4px' }} />
                  )}
                  <div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#b0aaa4', marginTop: '2px' }}>
                      {c.data?.profession || 'No profession'} &middot; Created {formatDate(c.created_at)}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => router.push(`/characters/${c.id}/edit`)}
                      style={actionBtn('#c0392b', '#f5a89a')}>
                      Edit
                    </button>
                    <button onClick={() => handlePrint(c.id)}
                      style={actionBtn('#2d5a1b', '#7fc458')}>
                      Print
                    </button>
                    <button onClick={() => handleDuplicate(c)} disabled={duplicating === c.id}
                      style={actionBtn('#1a3a5c', '#7ab3d4')}>
                      {duplicating === c.id ? '...' : 'Duplicate'}
                    </button>
                    <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                      style={actionBtn('#2e2e2e', '#b0aaa4')}>
                      {deleting === c.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>

                {/* RAPID attributes */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                  {attrKeys.map(k => {
                    const v = rapid[k] ?? 0
                    return (
                      <div key={k} style={{ flex: 1, background: v > 0 ? '#2a1210' : '#242424', border: `1px solid ${v > 0 ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', padding: '4px 2px', textAlign: 'center' }}>
                        <div style={{ fontSize: '8px', color: '#b0aaa4', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: v > 0 ? '#f5a89a' : '#b0aaa4' }}>{sgn(v)}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Complication + Motivation */}
                {(c.data?.complication || c.data?.motivation) && (
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#b0aaa4' }}>
                    {c.data?.complication && <span><span style={{ color: '#5a5550' }}>Complication:</span> {c.data.complication}</span>}
                    {c.data?.motivation && <span><span style={{ color: '#5a5550' }}>Motivation:</span> {c.data.motivation}</span>}
                  </div>
                )}
                {/* Trained skills */}
                {c.data?.skills?.filter((s: any) => s.level > 0).length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {c.data.skills.filter((s: any) => s.level > 0).map((s: any) => (
                      <span key={s.skillName} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '3px', background: '#2a1210', border: '1px solid #7a1f16', color: '#f5a89a' }}>
                        {s.skillName} {sgn(s.level)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Hidden print container */}
              <div id={`print-container-${c.id}`} style={{ display: 'none' }}>
                <PrintSheet state={wizardState} />
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

function actionBtn(borderColor: string, color: string): React.CSSProperties {
  return {
    background: 'none', border: `1px solid ${borderColor}`,
    borderRadius: '3px', color, fontSize: '11px',
    padding: '4px 10px', cursor: 'pointer',
    fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase',
  }
}
