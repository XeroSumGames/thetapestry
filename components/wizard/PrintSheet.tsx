'use client'
import { WizardState, getCumulativeAttributes, getCumulativeSkills } from '../../lib/xse-engine'
import { SKILLS, deriveSecondaryStats } from '../../lib/xse-schema'
import { ALL_WEAPONS } from '../../lib/weapons'

// Optional live-state payload for printing an existing campaign character.
// Wizard print paths don't pass liveState — they get a blank-form sheet.
// CharacterCard's print path passes the player's current relationships,
// lasting wounds, and progression-log history so the printout doubles as
// a "here's what's happened" record between sessions.
//
// 2026-05-01 redesign per Xero feedback: trackers are NEVER pre-filled
// (players hand-tally during play); RAPID and skill rows show their
// CDP-derived values in light grey AS A HINT inside hand-fill boxes; the
// header is trimmed (no Distemper wordmark, no complication/motivation
// sidebar); progression log added at the bottom.
export interface PrintLiveState {
  relationships?: { name: string; cmod: number }[]
  wounds?: string[]
  progressionLog?: { date: string; type: string; text: string }[]
}

interface Props {
  state: WizardState
  liveState?: PrintLiveState
}

export default function PrintSheet({ state, liveState }: Props) {
  const rapid = getCumulativeAttributes(state.steps)
  const derived = deriveSecondaryStats(rapid)
  const skills = getCumulativeSkills(state.steps)
  const step4 = state.steps[3] ?? {}

  const pWep = ALL_WEAPONS.find(w => w.name === state.weaponPrimary)
  const sWep = ALL_WEAPONS.find(w => w.name === state.weaponSecondary)

  function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

  const ATTR_KEYS = ['RSN', 'ACU', 'PHY', 'INF', 'DEX'] as const

  // Light grey hint colour used for any pre-printed CDP-derived value
  // sitting inside a hand-fill box. The player can pencil over it; the
  // grey just says "this is what you started with."
  const HINT = '#999'

  const unarmedBonus = (rapid.PHY ?? 0) + (skills['Unarmed Combat'] ?? 0)

  return (
    <div id="print-sheet-inner" style={{ fontFamily: 'Barlow, Arial, sans-serif', color: '#000', background: '#fff', width: '100%', fontSize: '8pt', padding: '8pt' }}>

      {/* Header — name + demographics only. Distemper wordmark / URL
          and the Complication / Motivation / Personality sidebar were
          removed per Xero feedback to clean up the printable. */}
      <div style={{ borderBottom: '2px solid #000', paddingBottom: '4pt', marginBottom: '6pt' }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18pt', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#000' }}>{state.name || 'Unnamed'}</div>
        <div style={{ fontSize: '7pt', color: '#000' }}>
          {step4.profession ?? ''} · {state.age ? `Age ${state.age}` : ''} {state.gender ? `· ${state.gender}` : ''} {state.height ? `· ${state.height}` : ''} {state.weight ? `· ${state.weight}` : ''}
        </div>
        {state.concept && <div style={{ fontSize: '7pt', color: '#000', fontStyle: 'italic', marginTop: '2pt' }}>{state.concept}</div>}
      </div>

      {/* RAPID Attributes — empty hand-fill boxes with the CDP-derived
          value pre-printed in light grey as a starting hint. Player
          tracks current value in pencil; grey value is for reference. */}
      <div style={{ display: 'flex', gap: '3pt', marginBottom: '6pt' }}>
        {ATTR_KEYS.map(k => {
          const v = rapid[k]
          return (
            <div key={k} style={{ flex: 1, background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 2pt', textAlign: 'center' }}>
              <div style={{ fontSize: '6pt', color: '#000', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ height: '18pt', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14pt', fontWeight: 400, fontFamily: 'Carlito, sans-serif', color: HINT, lineHeight: 1 }}>{sgn(v)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* WP / RP — circles stay blank for hand-tally. */}
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

      {/* Trackers row: Stress, Insight, CDP, Morality. ALWAYS blank for
          hand-tally per Xero feedback — values change between sessions
          and a frozen print snapshot was unhelpful. */}
      <div style={{ display: 'flex', gap: '8pt', marginBottom: '6pt' }}>
        {[
          { label: 'Stress',   count: 5  },
          { label: 'Insight',  count: 10 },
          { label: 'CDP',      count: 10 },
          { label: 'Morality', count: 7  },
        ].map(t => (
          <div key={t.label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '6pt', color: '#000', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>{t.label}</div>
            <div style={{ display: 'flex', gap: '1.5pt', justifyContent: 'center' }}>
              {Array.from({ length: t.count }).map((_, i) => (
                <div key={i} style={{ width: '7pt', height: '7pt', borderRadius: '1pt', border: '0.5pt solid #000', background: 'transparent' }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Skills grid — each skill is a hand-fill box with the CDP-derived
          value pre-printed in light grey when the player has invested
          (and an empty box otherwise). Vocational skills marked with *. */}
      <div style={{ background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt', marginBottom: '6pt' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {SKILLS.map(sk => {
            const val = skills[sk.name]
            const base = sk.vocational ? -3 : 0
            const raised = val !== base
            // Show the value as a grey hint inside a small fill-box; if
            // the player hasn't invested (value matches the base), the
            // box is just blank so they can write it themselves.
            return (
              <div key={sk.name} style={{ width: '25%', display: 'flex', alignItems: 'center', padding: '1pt 3pt', fontSize: '6.5pt', gap: '3pt' }}>
                <span style={{ flex: 1, color: '#000' }}>{sk.name}{sk.vocational ? '*' : ''}</span>
                <div style={{ width: '20pt', height: '10pt', border: '0.5pt solid #000', borderRadius: '1pt', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {raised && (
                    <span style={{ fontSize: '7pt', fontFamily: 'Carlito, sans-serif', color: HINT, lineHeight: 1 }}>{sgn(val)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Unarmed + Secondary Stats — Unarmed reduced and de-emoji'd per
          Xero feedback; secondary stats unchanged. */}
      <div style={{ display: 'flex', gap: '6pt', marginBottom: '6pt' }}>
        {/* Unarmed Attack — compact line, no icon. */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '2pt 6pt', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6pt' }}>
          <span style={{ fontSize: '6pt', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', color: '#000', letterSpacing: '.06em' }}>Unarmed</span>
          <span style={{ fontSize: '7pt', color: '#000' }}>
            <span style={{ fontWeight: 700 }}>1d3{unarmedBonus !== 0 ? `+${unarmedBonus}` : ''}</span> (PHY + Unarmed)
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
                    { l: 'Damage', v: wep.damage },
                    { l: 'RP%', v: `${wep.rpPercent}%` },
                    { l: 'ENC', v: wep.enc },
                    { l: 'Cond', v: 'Used' },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ flex: 1 }}>
                      <div style={{ color: '#000', textTransform: 'uppercase', fontSize: '5pt' }}>{l}</div>
                      <div style={{ fontWeight: 700, color: '#000', fontSize: '7pt' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {wep.clip != null && (
                  <div style={{ padding: '2pt 6pt', borderTop: '1px solid #000', display: 'flex', alignItems: 'center', gap: '4pt' }}>
                    <span style={{ fontSize: '5pt', color: '#000' }}>Ammo ({wep.clip}):</span>
                    <div style={{ display: 'flex', gap: '1.5pt', flexWrap: 'wrap' }}>
                      {Array.from({ length: Math.min(wep.clip, 30) }).map((_, i) => (
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
        {/* Relationships — pre-fills from npc_relationships when liveState
            is provided; falls back to 4 empty rule-lines for hand-fill. */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 6pt' }}>
          <div style={{ fontSize: '6pt', color: '#000', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>Relationships / CMod</div>
          {(() => {
            const rels = liveState?.relationships ?? []
            const lines = Math.max(4, rels.length)
            return Array.from({ length: lines }).map((_, i) => {
              const r = rels[i]
              return (
                <div key={i} style={{ borderBottom: '0.5pt solid #000', height: '10pt', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '7pt', fontFamily: 'Carlito, sans-serif', color: '#000' }}>
                  {r ? (
                    <>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.name}</span>
                      <span style={{ fontWeight: 700 }}>{r.cmod > 0 ? `+${r.cmod}` : r.cmod}</span>
                    </>
                  ) : null}
                </div>
              )
            })
          })()}
        </div>
        {/* Lasting Wounds — pulled from progression_log entries with
            type='wound' when liveState is provided; blank rule-lines
            for the wizard print path. */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 6pt' }}>
          <div style={{ fontSize: '6pt', color: '#000', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>Lasting Wounds & Notes</div>
          {(() => {
            const wounds = liveState?.wounds ?? []
            const lines = Math.max(4, wounds.length)
            return Array.from({ length: lines }).map((_, i) => {
              const w = wounds[i]
              return (
                <div key={i} style={{ borderBottom: '0.5pt solid #000', height: '10pt', display: 'flex', alignItems: 'center', fontSize: '7pt', fontFamily: 'Carlito, sans-serif', color: '#000' }}>
                  {w ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🩸 {w}</span> : null}
                </div>
              )
            })
          })()}
        </div>
      </div>

      {/* Backstory */}
      {state.concept && (
        <div style={{ background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 6pt', marginBottom: '6pt' }}>
          <div style={{ fontSize: '6pt', color: '#000', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>Backstory</div>
          <div style={{ fontSize: '7pt', color: '#000', lineHeight: 1.4 }}>
            {[state.steps[0]?.note, state.steps[1]?.note, state.steps[2]?.note, state.steps[3]?.note, state.steps[4]?.note].filter(Boolean).join(' ')}
          </div>
        </div>
      )}

      {/* Progression Log — surfaced for the player so a printout months
          after creation still shows the journey markers (level-ups,
          deaths-and-back, lasting wounds, milestone moments). Only
          renders when liveState provides the log; the wizard print
          path has no log to show. */}
      {liveState?.progressionLog && liveState.progressionLog.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #000', borderRadius: '3pt', padding: '4pt 6pt' }}>
          <div style={{ fontSize: '6pt', color: '#000', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2pt' }}>Progression Log</div>
          {liveState.progressionLog.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: '4pt', fontSize: '6.5pt', color: '#000', lineHeight: 1.4, borderBottom: i < liveState.progressionLog!.length - 1 ? '0.25pt solid #ccc' : 'none', padding: '1pt 0' }}>
              <span style={{ color: HINT, fontFamily: 'Carlito, sans-serif', minWidth: '46pt' }}>
                {(() => { try { return new Date(entry.date).toLocaleDateString() } catch { return '' } })()}
              </span>
              <span style={{ flex: 1 }}>{entry.text}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
