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

  const unarmedBonus = (rapid.PHY ?? 0) + (skills['Unarmed Combat'] ?? 0)

  return (
    <div id="print-sheet-inner" style={{ fontFamily: 'Barlow, Arial, sans-serif', color: '#000', background: '#fff', width: '100%', fontSize: '8pt', padding: '8pt' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '4pt', marginBottom: '6pt' }}>
        <div>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18pt', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#000' }}>{state.name || 'Unnamed'}</div>
          <div style={{ fontSize: '7pt', color: '#000' }}>
            {step4.profession ?? ''} · {state.age ? `Age ${state.age}` : ''} {state.gender ? `· ${state.gender}` : ''} {state.height ? `· ${state.height}` : ''} {state.weight ? `· ${state.weight}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7pt', color: '#000', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>Distemper</div>
          <div style={{ fontSize: '6pt', color: '#000' }}>www.DistemperVerse.com</div>
        </div>
      </div>

      {/* Concept + Details row */}
      <div style={{ display: 'flex', gap: '6pt', marginBottom: '6pt', fontSize: '7pt' }}>
        {state.concept && <div style={{ flex: 2, color: '#000', fontStyle: 'italic' }}>{state.concept}</div>}
        <div style={{ flex: 1, textAlign: 'right', color: '#000' }}>
          {step6.complication && <span>Complication: <strong style={{ color: '#000' }}>{step6.complication}</strong></span>}
          {step6.motivation && <span> · Motivation: <strong style={{ color: '#000' }}>{step6.motivation}</strong></span>}
          {state.threeWords?.filter(Boolean).length > 0 && <div style={{ color: '#000' }}>{state.threeWords.filter(Boolean).join(' · ')}</div>}
        </div>
      </div>

      {/* RAPID Attributes */}
      <div style={{ display: 'flex', gap: '3pt', marginBottom: '6pt' }}>
        {ATTR_KEYS.map(k => {
          const v = rapid[k]
          return (
            <div key={k} style={{ flex: 1, background: v > 0 ? '#fff' : '#fff', border: `1px solid ${v > 0 ? '#000' : '#000'}`, borderRadius: '3pt', padding: '4pt 2pt', textAlign: 'center' }}>
              <div style={{ fontSize: '6pt', color: '#000', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: '14pt', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: v > 0 ? '#000' : '#000', lineHeight: 1 }}>{sgn(v)}</div>
            </div>
          )
        })}
      </div>

      {/* WP / RP */}
      <div style={{ display: 'flex', gap: '12pt', marginBottom: '6pt' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2pt' }}>
            <span style={{ fontSize: '7pt', color: '#000', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'Carlito, sans-serif' }}>Wound Points</span>
            <span style={{ fontSize: '7pt', color: '#000', fontWeight: 700, fontFamily: 'Carlito, sans-serif' }}>{derived.woundPoints}/{derived.woundPoints}</span>
          </div>
          <div style={{ display: 'flex', gap: '2pt', flexWrap: 'wrap' }}>
            {Array.from({ length: derived.woundPoints }).map((_, i) => (
              <div key={i} style={{ width: '8pt', height: '8pt', borderRadius: '50%', border: '1px solid #000', background: 'transparent' }} />
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2pt' }}>
            <span style={{ fontSize: '7pt', color: '#000', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'Carlito, sans-serif' }}>Resilience Points</span>
            <span style={{ fontSize: '7pt', color: '#000', fontWeight: 700, fontFamily: 'Carlito, sans-serif' }}>{derived.resiliencePoints}/{derived.resiliencePoints}</span>
          </div>
          <div style={{ display: 'flex', gap: '2pt', flexWrap: 'wrap' }}>
            {Array.from({ length: derived.resiliencePoints }).map((_, i) => (
              <div key={i} style={{ width: '8pt', height: '8pt', borderRadius: '50%', border: '1px solid #000', background: 'transparent' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Trackers row: Stress, Insight, CDP, Morality */}
      <div style={{ display: 'flex', gap: '8pt', marginBottom: '6pt' }}>
        {[
          { label: 'Stress', count: 5, color: '#000' },
          { label: 'Insight', count: 10, color: '#000' },
          { label: 'CDP', count: 10, color: '#000' },
          { label: 'Morality', count: 7, color: '#000' },
        ].map(t => (
          <div key={t.label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '6pt', color: '#000', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>{t.label}</div>
            <div style={{ display: 'flex', gap: '1.5pt', justifyContent: 'center' }}>
              {Array.from({ length: t.count }).map((_, i) => (
                <div key={i} style={{ width: '7pt', height: '7pt', borderRadius: '1pt', border: `0.5pt solid ${t.color}`, background: 'transparent' }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Skills grid */}
      <div style={{ background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt', marginBottom: '6pt' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {SKILLS.map(sk => {
            const val = skills[sk.name]
            const base = sk.vocational ? -3 : 0
            const raised = val > base
            return (
              <div key={sk.name} style={{ width: '25%', display: 'flex', alignItems: 'center', padding: '1pt 3pt', fontSize: '6.5pt' }}>
                <span style={{ flex: 1, color: raised ? '#000' : '#000', fontWeight: raised ? 600 : 400 }}>{sk.name}{sk.vocational ? '*' : ''}</span>
                <span style={{ fontSize: '7pt', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: raised ? '#000' : val < 0 ? '#000' : '#000', minWidth: '14pt', textAlign: 'right' }}>{sgn(val)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Unarmed + Secondary Stats — side by side */}
      <div style={{ display: 'flex', gap: '6pt', marginBottom: '6pt' }}>
        {/* Unarmed Attack */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 6pt', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6pt' }}>
          <span style={{ fontSize: '7pt', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', color: '#000' }}>👊 Unarmed Attack</span>
          <span style={{ fontSize: '7pt', color: '#000' }}>
            Damage: <span style={{ color: '#000', fontWeight: 700 }}>1d3{unarmedBonus !== 0 ? `+${unarmedBonus}` : ''}</span> (PHY + Unarmed)
          </span>
        </div>
        {/* Secondary stats */}
        <div style={{ display: 'flex', gap: '2pt' }}>
          {[
            { l: 'Init', v: sgn(derived.initiative) },
            { l: 'Perc', v: sgn(derived.perception) },
            { l: 'Enc', v: derived.encumbrance },
            { l: 'Stress Mod', v: sgn(derived.stressModifier) },
            { l: 'DMM', v: sgn(derived.meleeDefense) },
            { l: 'DMR', v: sgn(derived.rangedDefense) },
          ].map(s => (
            <div key={s.l} style={{ background: '#fff', border: '1px solid #000', borderRadius: '2pt', padding: '2pt 4pt', textAlign: 'center', minWidth: '28pt' }}>
              <div style={{ fontSize: '5pt', color: '#000', textTransform: 'uppercase' }}>{s.l}</div>
              <div style={{ fontSize: '9pt', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: '#000' }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weapons — side by side */}
      <div style={{ display: 'flex', gap: '6pt', marginBottom: '6pt' }}>
        {[{ wep: pWep, label: 'Primary', ammo: state.primaryAmmo }, { wep: sWep, label: 'Secondary', ammo: state.secondaryAmmo }].map(({ wep, label, ammo }) => (
          <div key={label} style={{ flex: 1, background: '#fff', border: '1px solid #000', borderRadius: '3pt', overflow: 'hidden' }}>
            <div style={{ padding: '3pt 6pt', borderBottom: '1px solid #000', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '7pt', fontWeight: 700, fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', color: '#000' }}>{label}</span>
              <span style={{ fontSize: '7pt', fontWeight: 700, color: '#000' }}>{wep?.name ?? 'None'}</span>
            </div>
            {wep && (
              <>
                <div style={{ display: 'flex', padding: '3pt 6pt', gap: '4pt', fontSize: '6pt' }}>
                  {[
                    { l: 'Range', v: wep.range },
                    { l: 'Damage', v: 'damageBase' in wep ? `${'damageDice' in wep && wep.damageDice ? `${wep.damageBase}+${wep.damageDice}` : wep.damageBase}` : '' },
                    { l: 'RP%', v: 'rpPercent' in wep ? `${wep.rpPercent}%` : '' },
                    { l: 'ENC', v: wep.enc },
                    { l: 'Cond', v: 'Used' },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ flex: 1 }}>
                      <div style={{ color: '#000', textTransform: 'uppercase', fontSize: '5pt' }}>{l}</div>
                      <div style={{ fontWeight: 700, color: '#000', fontSize: '7pt' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {wep.cat === 'ranged' && 'clipSize' in wep && (
                  <div style={{ padding: '2pt 6pt', borderTop: '1px solid #000', display: 'flex', alignItems: 'center', gap: '4pt' }}>
                    <span style={{ fontSize: '5pt', color: '#000' }}>Ammo ({wep.clipSize}):</span>
                    <div style={{ display: 'flex', gap: '1.5pt', flexWrap: 'wrap' }}>
                      {Array.from({ length: Math.min(wep.clipSize as number, 30) }).map((_, i) => (
                        <div key={i} style={{ width: '5pt', height: '5pt', border: '0.5pt solid #000', background: 'transparent' }} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Bottom row: Equipment, Relationships, Lasting Wounds */}
      <div style={{ display: 'flex', gap: '6pt', marginBottom: '6pt' }}>
        {/* Equipment */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 6pt' }}>
          <div style={{ fontSize: '6pt', color: '#000', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>Equipment & Gear</div>
          {state.equipment && <div style={{ fontSize: '7pt', fontWeight: 600, color: '#000' }}>{state.equipment}</div>}
          {state.incidentalItem && <div style={{ fontSize: '6pt', color: '#000' }}>Incidental: {state.incidentalItem}</div>}
          {state.rations && <div style={{ fontSize: '6pt', color: '#000' }}>Rations: {state.rations}</div>}
          {!state.equipment && !state.incidentalItem && <div style={{ fontSize: '6pt', color: '#000' }}>None</div>}
        </div>
        {/* Relationships */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 6pt' }}>
          <div style={{ fontSize: '6pt', color: '#000', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>Relationships / CMod</div>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ borderBottom: '0.5pt solid #000', height: '10pt' }} />)}
        </div>
        {/* Lasting Wounds */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 6pt' }}>
          <div style={{ fontSize: '6pt', color: '#000', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>Lasting Wounds & Notes</div>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ borderBottom: '0.5pt solid #000', height: '10pt' }} />)}
        </div>
      </div>

      {/* Backstory */}
      {state.concept && (
        <div style={{ background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 6pt' }}>
          <div style={{ fontSize: '6pt', color: '#000', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>Backstory</div>
          <div style={{ fontSize: '7pt', color: '#000', lineHeight: 1.4 }}>
            {[state.steps[0]?.note, state.steps[1]?.note, state.steps[2]?.note, state.steps[3]?.note, state.steps[4]?.note].filter(Boolean).join(' ')}
          </div>
        </div>
      )}

    </div>
  )
}
