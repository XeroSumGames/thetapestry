'use client'
import { WizardState, getCumulativeAttributes, getCumulativeSkills } from '../../lib/xse-engine'
import { SKILLS, ATTRIBUTE_LABELS, deriveSecondaryStats, MELEE_WEAPONS, RANGED_WEAPONS } from '../../lib/xse-schema'

interface Props {
  state: WizardState
}

export default function PrintSheet({ state }: Props) {
  const rapid = getCumulativeAttributes(state.steps)
  const derived = deriveSecondaryStats(rapid)
  const skills = getCumulativeSkills(state.steps)
  const step4 = state.steps[3] ?? {}
  const step6 = state.steps[5] ?? {}

  const allWeapons = [...MELEE_WEAPONS.map(w => ({ ...w, cat: 'melee' })), ...RANGED_WEAPONS.map(w => ({ ...w, cat: 'ranged' }))]
  const pWep = allWeapons.find(w => w.name === state.weaponPrimary)
  const sWep = allWeapons.find(w => w.name === state.weaponSecondary)

  function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

  const ATTR_KEYS = ['RSN', 'ACU', 'PHY', 'INF', 'DEX'] as const
  const ATTR_FULL: Record<string, string> = { RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity' }

  const backstoryNotes = [
    { label: 'Step 1', note: state.steps[0]?.note },
    { label: 'Step 2', note: state.steps[1]?.note },
    { label: 'Step 3', note: state.steps[2]?.note },
    { label: 'Step 4', note: state.steps[3]?.note },
    { label: 'Step 5', note: state.steps[4]?.note },
  ].filter(b => b.note?.trim())

  function wBlock(wep: typeof pWep, ammo: number, label: string, cls: string) {
    if (!wep) return <div style={{ border: '0.5pt solid #ddd', padding: '5pt 6pt', fontSize: '7pt', color: '#aaa', marginBottom: '3pt', background: '#fafafa' }}>{label}: None</div>
    const needsAmmo = wep.cat === 'ranged'
    const clipSize = 'clipSize' in wep ? wep.clipSize : 0
    return (
      <div style={{ border: '0.5pt solid #ccc', marginBottom: '3pt' }}>
        <div style={{ padding: '2pt 4pt', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: cls === 'primary' ? '#1a1a1a' : '#444', color: '#fff' }}>
          <span style={{ fontSize: '7pt', fontWeight: 700 }}>{label}: {wep.name}</span>
          <span style={{ fontSize: '6pt', opacity: 0.8 }}>{wep.cat.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', padding: '3pt 4pt', gap: 0 }}>
          {[
            ['Range', wep.range],
            ['Damage', 'damageBase' in wep ? `${'damageDice' in wep && wep.damageDice ? `${wep.damageBase}+${wep.damageDice}` : wep.damageBase}` : ''],
            ['RP%', 'rpPercent' in wep ? `${wep.rpPercent}%` : ''],
            ['ENC', wep.enc],
            ['Cond.', 'Used'],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ flex: 1, borderRight: '0.3pt solid #eee' }}>
              <div style={{ fontSize: '5pt', color: '#888', textTransform: 'uppercase' }}>{l}</div>
              <div style={{ fontSize: '7.5pt', fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
        {needsAmmo && clipSize > 0 && (
          <div style={{ padding: '2pt 4pt', display: 'flex', alignItems: 'center', gap: '4pt', borderTop: '0.3pt solid #eee' }}>
            <span style={{ fontSize: '5.5pt', color: '#888' }}>Ammo ({clipSize} rounds):</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2pt' }}>
              {Array.from({ length: Math.min(clipSize, 30) }).map((_, i) => (
                <div key={i} style={{ width: '7pt', height: '7pt', border: '0.5pt solid #333', background: i < ammo ? '#1a1a1a' : '#fff' }} />
              ))}
            </div>
          </div>
        )}
        {!needsAmmo && (
          <div style={{ padding: '2pt 4pt', borderTop: '0.3pt solid #eee' }}>
            <span style={{ fontSize: '5.5pt', color: '#888' }}>Melee — no ammo required</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div id="print-sheet-inner" style={{ fontFamily: 'Barlow, Arial, sans-serif', color: '#111', width: '100%', fontSize: '8pt' }}>

      {/* Header */}
      <div style={{ background: '#1a1a1a', color: '#fff', padding: '5pt 8pt', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14pt', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Distemper</div>
        <div style={{ fontSize: '6.5pt', color: '#aaa', textAlign: 'right', lineHeight: 1.5 }}>Character Sheet<br />www.DistemperVerse.com</div>
      </div>
      <div style={{ height: '3pt', background: '#c0392b', marginBottom: '5pt' }} />

      {/* Personal details */}
      <div style={{ display: 'flex', gap: '3pt', marginBottom: '4pt' }}>
        {[
          { label: 'Name', value: state.name, flex: 3 },
          { label: 'Age', value: state.age, flex: 1 },
          { label: 'Gender', value: state.gender, flex: 1 },
          { label: 'Profession', value: step4.profession ?? '', flex: 2 },
          { label: 'Height', value: state.height, flex: 1 },
          { label: 'Weight', value: state.weight, flex: 1 },
        ].map(({ label, value, flex }) => (
          <div key={label} style={{ border: '0.5pt solid #ccc', padding: '2pt 3pt', flex }}>
            <div style={{ fontSize: '5pt', color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
            <div style={{ fontSize: '8.5pt', fontWeight: 600, minHeight: '10pt' }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '3pt', marginBottom: '6pt' }}>
        {[
          { label: 'Complication', value: step6.complication ?? '', flex: 2 },
          { label: 'Motivation', value: step6.motivation ?? '', flex: 2 },
          { label: 'Word 1', value: state.threeWords[0], flex: 1 },
          { label: 'Word 2', value: state.threeWords[1], flex: 1 },
          { label: 'Word 3', value: state.threeWords[2], flex: 1 },
        ].map(({ label, value, flex }) => (
          <div key={label} style={{ border: '0.5pt solid #ccc', padding: '2pt 3pt', flex }}>
            <div style={{ fontSize: '5pt', color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
            <div style={{ fontSize: '8.5pt', fontWeight: 600, minHeight: '10pt' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Body — two columns */}
      <div style={{ display: 'flex', gap: '8pt', marginTop: '4pt' }}>

        {/* Left column */}
        <div style={{ width: '38%', flexShrink: 0 }}>

          <div style={secHdr}>RAPID Range Attributes</div>
          <div style={{ display: 'flex', gap: '2pt', marginBottom: '4pt', marginTop: '2pt' }}>
            {ATTR_KEYS.map(k => {
              const v = rapid[k]
              return (
                <div key={k} style={{ flex: 1, border: `0.5pt solid ${v > 0 ? '#c0392b' : '#ccc'}`, padding: '3pt 2pt', textAlign: 'center', background: v > 0 ? '#fdf0ee' : '#fff' }}>
                  <div style={{ fontSize: '7pt', fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16pt', fontWeight: 700, lineHeight: 1, margin: '2pt 0', color: v > 0 ? '#c0392b' : '#111' }}>{sgn(v)}</div>
                  <div style={{ fontSize: '5pt', color: '#888', lineHeight: 1.2 }}>{ATTRIBUTE_LABELS[v]}<br />{ATTR_FULL[k]}</div>
                </div>
              )
            })}
          </div>

          <div style={secHdr}>Secondary Statistics</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2pt', marginBottom: '4pt', marginTop: '2pt' }}>
            {[
              { l: 'Wound Points', v: derived.woundPoints, hi: true },
              { l: 'Resilience Pts', v: derived.resiliencePoints, hi: true },
              { l: 'Initiative', v: sgn(derived.initiative), hi: false },
              { l: 'Perception', v: sgn(derived.perception), hi: false },
              { l: 'Encumbrance', v: derived.encumbrance, hi: false },
              { l: 'Stress Mod', v: sgn(derived.stressModifier), hi: false },
              { l: 'Melee Def', v: sgn(derived.meleeDefense), hi: false },
              { l: 'Ranged Def', v: sgn(derived.rangedDefense), hi: false },
              { l: 'Morality', v: 3, hi: false },
            ].map(({ l, v, hi }) => (
              <div key={l} style={{ width: 'calc(33.33% - 2pt)', border: `0.5pt solid ${hi ? '#c0392b' : '#ccc'}`, padding: '3pt 4pt', textAlign: 'center', background: hi ? '#fdf0ee' : '#fff' }}>
                <div style={{ fontSize: '5pt', color: '#888', textTransform: 'uppercase', letterSpacing: '.04em' }}>{l}</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13pt', fontWeight: 700, lineHeight: 1.1, color: hi ? '#c0392b' : '#111' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={secHdr}>Tracking</div>
          <div style={{ marginTop: '2pt' }}>
            {[
              { label: 'Insight Dice (starts at 2)', total: 9, filled: 2 },
              { label: 'CDP (Character Development Points)', total: 9, filled: 0 },
            ].map(({ label, total, filled }) => (
              <div key={label} style={{ border: '0.5pt solid #ccc', padding: '3pt 4pt', display: 'flex', alignItems: 'center', gap: '4pt', marginBottom: '2pt' }}>
                <span style={{ fontSize: '6pt', color: '#555', flex: 1 }}>{label}</span>
                <div style={{ display: 'flex', gap: '2pt' }}>
                  {Array.from({ length: total }).map((_, i) => (
                    <div key={i} style={{ width: '7pt', height: '7pt', border: '0.5pt solid #333', background: i < filled ? '#1a1a1a' : '#fff' }} />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ border: '0.5pt solid #ccc', padding: '3pt 4pt', marginBottom: '2pt' }}>
              <div style={{ fontSize: '6pt', color: '#555', marginBottom: '3pt' }}>Breaking Point (Stress 0–5)</div>
              <div style={{ display: 'flex', gap: '3pt' }}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{ width: '11pt', height: '11pt', borderRadius: '50%', border: '0.5pt solid #333', background: i === 0 ? '#c0392b' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6pt', fontWeight: 700, color: i === 0 ? '#fff' : '#333' }}>{i}</div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...secHdr, marginTop: '4pt' }}>Lasting Wounds &amp; Notes</div>
          <div style={{ border: '0.5pt solid #ccc', minHeight: '40pt', marginTop: '2pt', overflow: 'hidden' }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ borderBottom: '0.3pt solid #eee', height: '10pt' }} />)}
          </div>

          {state.physdesc && (
            <>
              <div style={{ ...secHdr, marginTop: '4pt' }}>Physical Description</div>
              <div style={{ border: '0.5pt solid #ccc', padding: '4pt 5pt', marginTop: '2pt', fontSize: '7pt', lineHeight: 1.4 }}>{state.physdesc}</div>
            </>
          )}

          {state.photoDataUrl && (
            <div style={{ marginTop: '4pt', textAlign: 'center' }}>
              <img src={state.photoDataUrl} style={{ maxWidth: '100%', maxHeight: '80pt', objectFit: 'cover', border: '0.5pt solid #ccc' }} alt="Character" />
            </div>
          )}

        </div>

        {/* Right column */}
        <div style={{ flex: 1 }}>

          <div style={secHdr}>Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '2pt' }}>
            {SKILLS.map(sk => {
              const val = skills[sk.name]
              const base = sk.vocational ? -3 : 0
              const raised = val > base
              const dv = val < 0 ? String(val) : val > 0 ? `+${val}` : '0'
              return (
                <div key={sk.name} style={{ width: '50%', display: 'flex', alignItems: 'center', padding: '1.5pt 2pt', borderBottom: '0.3pt solid #f0f0f0', fontSize: '6.5pt' }}>
                  <span style={{ flex: 1, fontWeight: 500, color: '#222' }}>{sk.name}{sk.vocational ? '*' : ''}</span>
                  <span style={{ fontSize: '5.5pt', color: '#999', marginLeft: '2pt' }}>{sk.attribute}</span>
                  <div style={{ width: '16pt', height: '10pt', border: `0.4pt solid ${sk.vocational && !raised ? '#e0a090' : raised ? '#1a1a1a' : '#ccc'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6.5pt', fontWeight: 700, background: sk.vocational && !raised ? '#fdf0ee' : raised ? '#1a1a1a' : '#fff', color: sk.vocational && !raised ? '#c0392b' : raised ? '#fff' : '#111', fontFamily: 'Barlow Condensed, sans-serif', marginLeft: '2pt' }}>{dv}</div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: '6pt', color: '#666', margin: '2pt 0 4pt' }}>
            Unarmed: 1d3 + PHY ({sgn(rapid.PHY)}) + Unarmed Combat SMod
          </div>

          <div style={{ ...secHdr, marginTop: '4pt' }}>Weapons</div>
          <div style={{ marginTop: '2pt' }}>
            {wBlock(pWep, state.primaryAmmo, 'Primary', 'primary')}
            {wBlock(sWep, state.secondaryAmmo, 'Secondary', 'secondary')}
          </div>

          <div style={{ ...secHdr, marginTop: '4pt' }}>Equipment &amp; Gear</div>
          <div style={{ border: '0.5pt solid #ccc', padding: '4pt 5pt', marginTop: '2pt' }}>
            {state.equipment
              ? <><div style={{ fontSize: '8pt', fontWeight: 700, marginBottom: '2pt' }}>{state.equipment}</div></>
              : <div style={{ fontSize: '7pt', color: '#aaa' }}>Equipment: None</div>
            }
            <div style={{ fontSize: '6.5pt', color: '#444', marginTop: '2pt' }}>Incidental: {state.incidentalItem || 'None'}</div>
            {state.rations && <div style={{ fontSize: '6.5pt', color: '#444', marginTop: '2pt' }}>Rations: {state.rations}</div>}
          </div>

          <div style={{ ...secHdr, marginTop: '4pt' }}>Relationships / CMod</div>
          <div style={{ border: '0.5pt solid #ccc', minHeight: '40pt', marginTop: '2pt', overflow: 'hidden' }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ borderBottom: '0.3pt solid #eee', height: '10pt' }} />)}
          </div>

        </div>
      </div>

      {/* Backstory notes */}
      {backstoryNotes.length > 0 && (
        <div style={{ marginTop: '4pt' }}>
          <div style={secHdr}>Backstory</div>
          <div style={{ border: '0.5pt solid #ccc', padding: '4pt 5pt', marginTop: '2pt' }}>
            {state.concept && (
              <p style={{ fontSize: '7pt', lineHeight: 1.5, marginBottom: '4pt', fontStyle: 'italic' }}>{state.concept}</p>
            )}
            {state.physdesc && (
              <p style={{ fontSize: '7pt', lineHeight: 1.5, marginBottom: '4pt', color: '#444' }}>
                {state.name ? `${state.name} was ` : ''}{state.physdesc}
              </p>
            )}
            <p style={{ fontSize: '7pt', lineHeight: 1.5 }}>
              {backstoryNotes.map(b => b.note).join(' ')}
            </p>
          </div>
        </div>
      )}

    </div>
  )
}

const secHdr: React.CSSProperties = {
  background: '#1a1a1a', color: '#fff',
  fontSize: '6pt', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
  padding: '2pt 4pt', marginBottom: 0,
}