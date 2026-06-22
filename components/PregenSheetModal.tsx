'use client'
// Read-only character-sheet preview shown when a player clicks a pre-
// generated character on the story lobby. Renders an XSECharacter (the
// same shape buildCharacterFromPregen produces and that library pregens
// store in `data`) so a player can read the full sheet BEFORE committing.
// The actual assignment happens via the SELECT button in the footer.
import { useEffect } from 'react'
import { deriveSecondaryStats } from '../lib/xse-schema'

interface Props {
  character: any
  portraitUrl?: string | null
  selecting?: boolean
  onSelect: () => void
  onClose: () => void
}

const FONT = 'Carlito, sans-serif'

export default function PregenSheetModal({ character, portraitUrl, selecting, onSelect, onClose }: Props) {
  // Close on Escape - registered unconditionally so hook order is stable;
  // the early return below still skips render when there's no character.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!character) return null

  const rapid = character.rapid ?? { RSN: 0, ACU: 0, PHY: 0, INF: 0, DEX: 0 }
  const sec = deriveSecondaryStats(rapid)
  const sgn = (v: number) => (v > 0 ? `+${v}` : String(v))

  const words: string[] = (character.threeWords ?? []).filter(Boolean)
  const skills: { skillName: string; level: number }[] = (character.skills ?? []).filter((s: any) => (s.level ?? 0) > 0)
  const equipment: string[] = [...(character.equipment ?? []), character.incidentalItem].filter(Boolean)
  const wp = character.weaponPrimary
  const ws = character.weaponSecondary
  const bio: string = character.notes || character.physdesc || ''

  const demographics = [
    character.profession,
    character.age ? `Age ${character.age}` : null,
    character.gender,
    character.height,
    character.weight,
  ].filter(Boolean).join('  ·  ')

  const RAPID_KEYS: [string, keyof typeof rapid][] = [
    ['RSN', 'RSN'], ['ACU', 'ACU'], ['PHY', 'PHY'], ['INF', 'INF'], ['DEX', 'DEX'],
  ]
  const SECONDARY: [string, number][] = [
    ['WP', sec.woundPoints], ['RP', sec.resiliencePoints],
    ['Initiative', sec.initiative], ['Perception', sec.perception],
    ['Ranged Def', sec.rangedDefense], ['Melee Def', sec.meleeDefense],
  ]

  const sectionLbl: React.CSSProperties = { fontSize: '13px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: FONT, margin: '18px 0 8px' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', maxHeight: '86vh', background: '#141414', border: '1px solid #2e2e2e', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '22px 24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', borderBottom: '1px solid #2e2e2e', paddingBottom: '16px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: '#0f2035', border: '2px solid #1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {portraitUrl
                ? <img src={portraitUrl} alt={character.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '24px', fontWeight: 700, color: '#7ab3d4', fontFamily: FONT }}>{(character.name ?? '?').charAt(0).toUpperCase()}</span>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', fontFamily: FONT, lineHeight: 1.1 }}>{character.name ?? 'Unnamed'}</div>
              {demographics && <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: FONT, marginTop: '4px' }}>{demographics}</div>}
            </div>
          </div>

          {/* Concept / complication / motivation */}
          {words.length > 0 && (
            <div style={{ fontSize: '15px', color: '#f5f2ee', fontStyle: 'italic', fontFamily: FONT, marginTop: '14px' }}>{words.join(', ')}</div>
          )}
          {(character.complication || character.motivation) && (
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: FONT, marginTop: '8px', lineHeight: 1.6 }}>
              {character.complication && <div><span style={{ color: '#888' }}>Complication: </span>{character.complication}</div>}
              {character.motivation && <div><span style={{ color: '#888' }}>Motivation: </span>{character.motivation}</div>}
            </div>
          )}

          {/* RAPID attributes */}
          <div style={sectionLbl}>RAPID Attributes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {RAPID_KEYS.map(([label, key]) => (
              <div key={label} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: FONT, letterSpacing: '.06em' }}>{label}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', fontFamily: FONT, marginTop: '2px' }}>{sgn(rapid[key] ?? 0)}</div>
              </div>
            ))}
          </div>

          {/* Secondary stats */}
          <div style={sectionLbl}>Derived Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {SECONDARY.map(([label, val]) => (
              <div key={label} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: FONT }}>{label}</div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', fontFamily: FONT, marginTop: '2px' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <>
              <div style={sectionLbl}>Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {skills.map(s => (
                  <span key={s.skillName} style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', padding: '3px 8px', fontFamily: FONT }}>
                    {s.skillName} {sgn(s.level)}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Weapons */}
          {(wp?.weaponName || ws?.weaponName) && (
            <>
              <div style={sectionLbl}>Weapons</div>
              <div style={{ fontSize: '14px', color: '#f5f2ee', fontFamily: FONT, lineHeight: 1.7 }}>
                {wp?.weaponName && <div>{wp.weaponName}{wp.condition ? <span style={{ color: '#888' }}> ({wp.condition})</span> : null}</div>}
                {ws?.weaponName && <div>{ws.weaponName}{ws.condition ? <span style={{ color: '#888' }}> ({ws.condition})</span> : null}</div>}
              </div>
            </>
          )}

          {/* Equipment */}
          {equipment.length > 0 && (
            <>
              <div style={sectionLbl}>Equipment</div>
              <div style={{ fontSize: '14px', color: '#f5f2ee', fontFamily: FONT, lineHeight: 1.6 }}>{equipment.join(', ')}</div>
            </>
          )}

          {/* Bio */}
          {bio && (
            <>
              <div style={sectionLbl}>Background</div>
              <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: FONT, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{bio}</div>
            </>
          )}
        </div>

        {/* Footer - the separate SELECT action */}
        <div style={{ borderTop: '1px solid #2e2e2e', background: '#0f0f0f', padding: '14px 18px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} disabled={selecting}
            style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #2e2e2e', borderRadius: '4px', color: '#f5f2ee', fontSize: '13px', fontFamily: FONT, letterSpacing: '.08em', textTransform: 'uppercase', cursor: selecting ? 'not-allowed' : 'pointer' }}>
            Close
          </button>
          <button onClick={onSelect} disabled={selecting}
            style={{ padding: '10px 28px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '4px', color: '#fff', fontSize: '14px', fontFamily: FONT, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, cursor: selecting ? 'wait' : 'pointer', opacity: selecting ? 0.7 : 1 }}>
            {selecting ? 'Selecting...' : 'Select this character'}
          </button>
        </div>
      </div>
    </div>
  )
}
