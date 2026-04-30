'use client'
// ProfessionPicker — reusable Profession card grid for the Apprentice
// creation wizard. Mirrors ParadigmPicker's presentation but reads from
// the canonical PROFESSIONS array (12 entries × 5 skills each) from
// SRD §08 Table 8.
//
// Per spec-communities §2a, an Apprentice picks a Profession (not a
// Paradigm). Each profession skill seeds at +1 CDP — a step up from the
// default value (-3 → -1 for vocational, 0 → 1 for non-vocational). The
// player then spends 5 CDP further on top.
//
// Pure presentation. The caller hands in `value` (currently-selected
// profession name, if any) and receives a callback on Pick.

import { PROFESSIONS, type ProfessionDefinition, SKILLS } from '../lib/xse-schema'

interface Props {
  value: string | null
  onChange: (profession: ProfessionDefinition) => void
}

// Resolve the seeded value of a profession skill after one CDP step:
// vocational skills go from -3 → -1, non-vocational 0 → 1.
function seedLevelFor(skillName: string): number {
  // Skill names in PROFESSIONS use the asterisk suffix (e.g. "Mechanic*")
  // when the skill is vocational. Strip it for the SKILLS lookup but
  // also use it as a quick vocational signal so we don't have to read
  // the SKILLS table for the 100% case.
  const isVocational = skillName.endsWith('*')
  if (isVocational) return -1
  // Non-asterisked skills are non-vocational by convention.
  return 1
}

export default function ProfessionPicker({ value, onChange }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', alignItems: 'start' }}>
      {PROFESSIONS.map(p => {
        const isSelected = value === p.name
        return (
          <div key={p.name}
            style={{
              padding: '10px 12px',
              background: isSelected ? '#1a2e10' : '#1a1a1a',
              border: `1px solid ${isSelected ? '#7fc458' : '#3a3a3a'}`,
              borderRadius: '4px',
              transition: 'background-color .12s ease, border-color .12s ease',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '15px', fontWeight: 700, color: '#f5f2ee',
                  fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase',
                }}>{p.name}</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>5 skills · 1 CDP each</div>
              </div>
              <button onClick={() => onChange(p)}
                style={{
                  padding: '4px 10px',
                  background: isSelected ? '#7fc458' : '#1a3a5c',
                  border: `1px solid ${isSelected ? '#7fc458' : '#7ab3d4'}`,
                  borderRadius: '3px',
                  color: isSelected ? '#0f0f0f' : '#7ab3d4',
                  fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                  letterSpacing: '.06em', textTransform: 'uppercase',
                  fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1,
                }}>
                {isSelected ? '✓ Picked' : 'Pick'}
              </button>
            </div>

            {/* Skill list — each skill chip shows the post-seed value
                (one CDP applied to the default). Vocational asterisks
                preserved so players see what's a vocational skill. */}
            <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {p.skills.map(skillName => {
                const seeded = seedLevelFor(skillName)
                return (
                  <span key={skillName} style={{
                    padding: '2px 6px',
                    background: '#1a2e10',
                    border: '1px solid #2d5a1b',
                    borderRadius: '2px',
                    fontSize: '13px',
                    color: '#7fc458',
                    fontFamily: 'Carlito, sans-serif',
                    letterSpacing: '.04em',
                    fontWeight: 600,
                  }}>
                    {skillName} {seeded >= 0 ? '+' : ''}{seeded}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
