'use client'
import { useMemo, useState } from 'react'
import { WizardState, getCumulativeAttributes, getCumulativeSkills } from '../../lib/xse-engine'
import { ATTRIBUTE_LABELS, COMPLICATIONS, MOTIVATIONS, EQUIPMENT, RATIONS, deriveSecondaryStats, AttributeName } from '../../lib/xse-schema'
import { ALL_WEAPONS } from '../../lib/weapons'
import { resizeImage } from '../../lib/image-utils'

const INCIDENTAL_ITEMS: string[] = [
  'Bible', 'Deck of Cards', 'Disposable Lighters', 'Eye Glasses', 'Map of Area',
  'Musical Instrument', 'Personal Item (Photo)', 'Pocket Knife', 'Walkman', 'Zippo Lighter',
  'Pocket Watch', 'Hip Flask', 'Battered Paperback', 'Rosary / Prayer Beads', 'Lucky Coin',
  'Worn Bandana', 'Compass', 'Pre-Distemper ID Card', 'Sketchbook & Pencil Stub', 'Wedding Band',
]
const EQUIPMENT_INCIDENTAL_NAMES = new Set([
  'Bible', 'Deck of Cards', 'Disposable Lighters', 'Eye Glasses', 'Map of Area',
  'Musical Instrument', 'Personal Item (Photo)', 'Pocket Knife', 'Walkman', 'Zippo Lighter',
])

const ATTR_KEYS: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<string, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity'
}

interface Props {
  state: WizardState
  onChange: (updated: Partial<WizardState>) => void
}

export default function StepNine({ state, onChange }: Props) {
  const [notes, setNotes] = useState('')
  const rapid = getCumulativeAttributes(state.steps)
  const equipmentPool = useMemo(() => EQUIPMENT.filter(e => !EQUIPMENT_INCIDENTAL_NAMES.has(e.name)), [])
  const derived = deriveSecondaryStats(rapid)
  const skills = getCumulativeSkills(state.steps)
  const step4 = state.steps[3] ?? {}
  const step6 = state.steps[5] ?? {}

  const trainedSkills = Object.entries(skills).filter(([, v]) => v > 0)
  const complications = Object.values(COMPLICATIONS)
  const motivations = Object.values(MOTIVATIONS)

  function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

  const backstoryNotes = [
    { step: 'Step 1 � Where they grew up',     note: state.steps[0]?.note },
{ step: 'Step 2 � What they learned',       note: state.steps[1]?.note },
{ step: 'Step 3 � What they liked to do',   note: state.steps[2]?.note },
{ step: 'Step 4 � How they made money',     note: state.steps[3]?.note },
{ step: 'Step 5 � What they learned after', note: state.steps[4]?.note },
  ].filter(b => b.note?.trim())

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#f5f2ee', lineHeight: 1.6, marginBottom: '1rem' }}>
        Review everything below before saving your character.
      </p>

      {/* Character header - portrait + name + details */}
      <div style={section}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '12px' }}>
          <label style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1a3a5c', border: `2px solid ${state.photoDataUrl ? '#7ab3d4' : '#3a3a3a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', position: 'relative' }}>
            {state.photoDataUrl ? (
              <img src={state.photoDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>
                  {state.name ? state.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'}
                </div>
                <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', marginTop: '2px' }}>Upload</div>
              </div>
            )}
            <input type="file" accept="image/*" hidden onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const resized = await resizeImage(file, 256)
              onChange({ photoDataUrl: resized })
            }} />
          </label>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1 }}>
              {state.name || 'Unnamed Character'}
            </div>
            <div style={{ fontSize: '14px', color: '#f5f2ee', marginTop: '4px' }}>
              {[step4.profession, state.gender, state.age ? `Age ${state.age}` : '', state.height, state.weight].filter(Boolean).join(' · ')}
            </div>
            {state.concept && (
              <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px', fontStyle: 'italic' }}>{state.concept}</div>
            )}
            {state.physdesc && (
              <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px', fontStyle: 'italic' }}>{state.physdesc}</div>
            )}
            {state.threeWords?.some((w: string) => w) && (
              <div style={{ fontSize: '13px', color: '#EF9F27', marginTop: '4px' }}>
                {state.threeWords.filter((w: string) => w).join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            ['Name', state.name],
            ['Age', state.age],
            ['Gender', state.gender],
            ['Height', state.height],
            ['Weight', state.weight],
            ['Profession', step4.profession ?? ''],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <label style={fieldLabel}>{label}</label>
              <input style={fieldInput} defaultValue={value} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <label style={fieldLabel}>Word {i + 1}</label>
              <input style={fieldInput} defaultValue={state.threeWords[i]} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={fieldLabel}>Complication</label>
            <select style={fieldInput} defaultValue={step6.complication ?? ''}>
              <option value="">- none -</option>
              {complications.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={fieldLabel}>Motivation</label>
            <select style={fieldInput} defaultValue={step6.motivation ?? ''}>
              <option value="">- none -</option>
              {motivations.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {(step6.complicationNote || step6.motivationNote) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            {step6.complicationNote ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={fieldLabel}>Complication notes</label>
                <div style={{ ...fieldInput, minHeight: '56px', color: '#f5f2ee', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{step6.complicationNote}</div>
              </div>
            ) : <div />}
            {step6.motivationNote ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={fieldLabel}>Motivation notes</label>
                <div style={{ ...fieldInput, minHeight: '56px', color: '#f5f2ee', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{step6.motivationNote}</div>
              </div>
            ) : <div />}
          </div>
        )}
      </div>

      {/* RAPID attributes */}
      <div style={section}>
        <div style={sectionTitle}>RAPID attributes (locked)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
          {ATTR_KEYS.map(k => {
            const val = rapid[k]
            return (
              <div key={k} style={{
                background: val > 0 ? '#2a1210' : '#242424',
                border: `1px solid ${val > 0 ? '#c0392b' : '#3a3a3a'}`,
                borderRadius: '3px', padding: '8px 4px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '13px', color: '#f5f2ee', letterSpacing: '.06em', fontFamily: 'Carlito, sans-serif' }}>{k}</div>
                <div style={{ fontSize: '13px', color: '#f5f2ee', marginBottom: '4px' }}>{ATTR_FULL[k]}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: val > 0 ? '#f5a89a' : '#f5f2ee', margin: '3px 0' }}>
                  {sgn(val)}
                </div>
                <div style={{ fontSize: '13px', color: val > 0 ? '#f5a89a' : '#f5f2ee' }}>{ATTRIBUTE_LABELS[val]}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Secondary stats */}
      <div style={section}>
        <div style={sectionTitle}>Secondary stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {[
            { label: 'Wound Points',      value: derived.woundPoints,         hi: true },
            { label: 'Resilience Points', value: derived.resiliencePoints,    hi: true },
            { label: 'Initiative',        value: sgn(derived.initiative),     hi: false },
            { label: 'Perception',        value: sgn(derived.perception),     hi: false },
            { label: 'Encumbrance',       value: derived.encumbrance,         hi: false },
            { label: 'Stress Mod',        value: sgn(derived.stressModifier), hi: false },
          ].map(({ label, value, hi }) => (
            <div key={label} style={{ background: '#242424', border: `1px solid ${hi ? '#7a1f16' : '#2e2e2e'}`, borderRadius: '3px', padding: '8px 10px' }}>
              <div style={{ fontSize: '9.5px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '1px' }}>{label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: hi ? '#f5a89a' : '#f5f2ee' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trained skills */}
      {trainedSkills.length > 0 && (
        <div style={section}>
          <div style={sectionTitle}>Trained skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {trainedSkills.map(([name, val]) => (
              <span key={name} style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '3px', background: '#2a1210', border: '1px solid #7a1f16', color: '#f5a89a' }}>
                {name} {sgn(val)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weapons & gear - Primary + Secondary are now editable
          dropdowns so the player can swap their seeded/picked
          loadout from the Final Touch screen without backtracking
          through Step 8. Other fields stay readonly. */}
      <div style={section}>
        <div style={sectionTitle}>Weapons &amp; gear</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* Primary weapon dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={fieldLabel}>Primary weapon</label>
            <select value={state.weaponPrimary}
              onChange={e => onChange({ weaponPrimary: e.target.value, primaryAmmo: 0 })}
              style={{ ...fieldInput, appearance: 'none', cursor: 'pointer' }}>
              <option value="">- None -</option>
              {ALL_WEAPONS.map(w => (
                <option key={w.name} value={w.name}>
                  {w.name} ({w.category} · {w.damage})
                </option>
              ))}
            </select>
          </div>
          {/* Secondary weapon dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={fieldLabel}>Secondary weapon</label>
            <select value={state.weaponSecondary}
              onChange={e => onChange({ weaponSecondary: e.target.value, secondaryAmmo: 0 })}
              style={{ ...fieldInput, appearance: 'none', cursor: 'pointer' }}>
              <option value="">- None -</option>
              {ALL_WEAPONS.map(w => (
                <option key={w.name} value={w.name}>
                  {w.name} ({w.category} · {w.damage})
                </option>
              ))}
            </select>
          </div>
          {/* Primary ammo - editable number (no Roll 1d3 in review) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={fieldLabel}>Primary ammo (reloads)</label>
            <input type="number" min={0} max={10}
              value={state.primaryAmmo ?? 0}
              onChange={e => onChange({ primaryAmmo: Math.max(0, parseInt(e.target.value) || 0) })}
              style={fieldInput} />
          </div>
          {/* Secondary ammo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={fieldLabel}>Secondary ammo (reloads)</label>
            <input type="number" min={0} max={10}
              value={state.secondaryAmmo ?? 0}
              onChange={e => onChange({ secondaryAmmo: Math.max(0, parseInt(e.target.value) || 0) })}
              style={fieldInput} />
          </div>
          {/* Equipment dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={fieldLabel}>Equipment</label>
            <select value={state.equipment} onChange={e => onChange({ equipment: e.target.value })}
              style={{ ...fieldInput, cursor: 'pointer', appearance: 'none' }}>
              <option value="">- None -</option>
              {equipmentPool.map(eq => <option key={eq.name} value={eq.name}>{eq.name}</option>)}
            </select>
          </div>
          {/* Incidental item dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={fieldLabel}>Incidental item</label>
            <select value={state.incidentalItem} onChange={e => onChange({ incidentalItem: e.target.value })}
              style={{ ...fieldInput, cursor: 'pointer', appearance: 'none' }}>
              <option value="">- None -</option>
              {INCIDENTAL_ITEMS.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          {/* Rations dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={fieldLabel}>Rations (you start with 2)</label>
            <select value={state.rations} onChange={e => onChange({ rations: e.target.value })}
              style={{ ...fieldInput, cursor: 'pointer', appearance: 'none' }}>
              <option value="">- None -</option>
              {RATIONS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Backstory */}
      <div style={section}>
        <div style={sectionTitle}>Backstory</div>
        {state.concept && (
          <p style={{ fontSize: '13px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '8px' }}>
            {state.concept}
          </p>
        )}
        {state.physdesc && (
          <p style={{ fontSize: '13px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '10px' }}>
            {state.name ? `${state.name} was ` : ''}{state.physdesc}
          </p>
        )}
        {(state.steps[0]?.note || state.steps[1]?.note) && (
          <p style={{ fontSize: '13px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '10px' }}>
            {[state.steps[0]?.note, state.steps[1]?.note].filter(Boolean).join(' ')}
          </p>
        )}
        {(state.steps[2]?.note || state.steps[3]?.note) && (
          <p style={{ fontSize: '13px', color: '#f5f2ee', lineHeight: 1.8, marginBottom: '10px' }}>
            {[state.steps[2]?.note, state.steps[3]?.note].filter(Boolean).join(' ')}
          </p>
        )}
        {state.steps[4]?.note && (
          <p style={{ fontSize: '13px', color: '#f5f2ee', lineHeight: 1.8 }}>
            {state.steps[4].note}
          </p>
        )}
      </div>

      {/* Additional notes */}
      <div style={section}>
        <div style={sectionTitle}>Additional notes</div>
        <textarea
          style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', minHeight: '80px', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional notes, GM hooks, or personality details..." />
      </div>

      {/* Print sheet container lives on the wizard route page, not
          here, so we don't double-render two PrintSheets when Step 9
          mounts. The parent's container is always print-sheet-active;
          this child no longer needs one. */}

    </div>
  )
}

const section: React.CSSProperties = {
  border: '1px solid #2e2e2e', borderRadius: '4px',
  padding: '12px 14px', marginBottom: '10px', background: '#1a1a1a',
}

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Carlito, sans-serif',
  fontSize: '13px', fontWeight: 700, color: '#c0392b',
  textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px',
}

const fieldLabel: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: '#f5f2ee',
  textTransform: 'uppercase', letterSpacing: '.07em',
}

const fieldInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  background: '#242424', border: '1px solid #3a3a3a',
  borderRadius: '3px', color: '#f5f2ee',
  fontSize: '13px', fontFamily: 'Carlito, sans-serif',
  boxSizing: 'border-box',
}
