'use client'
import { WizardState, getCumulativeAttributes } from '../../lib/xse-engine'
import { ATTRIBUTE_LABELS, deriveSecondaryStats, type AttributeName } from '../../lib/xse-schema'
import HelpTooltip from '../HelpTooltip'
import { ATTRIBUTE_DESCRIPTIONS, ENCUMBRANCE_DESCRIPTION } from '../../lib/help-text'

const ATTR_KEYS: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<string, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity'
}

// Per-derived-stat help copy. Plain prose so tooltips can paint
// quickly without crossing libraries.
const DERIVED_DESCRIPTIONS: Record<string, string> = {
  'Wound Points': 'Wound Points (WP) — physical hit points. PCs go Mortally Wounded at 0 and roll a death countdown. Max = 6 + PHY AMod.',
  'Resilience Points': 'Resilience Points (RP) — short-term toughness, used to soak grit + adrenaline checks. Max = 6 + PHY AMod.',
  'Initiative': 'Initiative — turn order in combat. Roll 2d6 + DEX AMod + ACU AMod. Higher rolls go first.',
  'Perception': 'Perception modifier — added to spotting / awareness checks. Equals RSN AMod + ACU AMod.',
  'Encumbrance': ENCUMBRANCE_DESCRIPTION,
  'Stress Modifier': 'Stress Modifier — added to Stress Checks (the gate roll when stress hits 5). Equals RSN AMod + ACU AMod.',
  'Melee Defence': 'Melee Defence Modifier (DMM) — subtracted from incoming melee damage. Equals PHY AMod.',
  'Ranged Defence': 'Ranged Defence Modifier (DMR) — subtracted from incoming ranged damage. Equals DEX AMod.',
  'Morality': 'Morality — moral compass tracker, 0–7. GM-driven; affects how NPCs read your PC. Starts at 3 (neutral).',
}

interface Props {
  state: WizardState
}

export default function StepSeven({ state }: Props) {
  const rapid = getCumulativeAttributes(state.steps)
  const derived = deriveSecondaryStats(rapid)

  const secondaryStats = [
    { label: 'Wound Points',      value: derived.woundPoints,       hi: true },
    { label: 'Resilience Points', value: derived.resiliencePoints,  hi: true },
    { label: 'Initiative',        value: derived.initiative,        hi: false },
    { label: 'Perception',        value: derived.perception,        hi: false },
    { label: 'Encumbrance',       value: derived.encumbrance,       hi: false },
    { label: 'Stress Modifier',   value: derived.stressModifier,    hi: false },
    { label: 'Melee Defence',     value: derived.meleeDefense,      hi: false },
    { label: 'Ranged Defence',    value: derived.rangedDefense,     hi: false },
    { label: 'Morality',          value: 3,                         hi: false },
  ]

  function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

  return (
    <div>

      {/* RAPID attributes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '1rem' }}>
        {ATTR_KEYS.map(k => {
          const val = rapid[k]
          return (
            <div key={k} style={{
              background: val > 0 ? '#2a1210' : '#242424',
              border: `1px solid ${val > 0 ? '#c0392b' : '#3a3a3a'}`,
              borderRadius: '3px', padding: '8px 4px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.06em', fontFamily: 'Carlito, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {k}
                <HelpTooltip title={`${k} — ${ATTR_FULL[k]}`} text={ATTRIBUTE_DESCRIPTIONS[k]} iconStyle={{ width: '13px', height: '13px', fontSize: '13px' }} />
              </div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '5px', lineHeight: 1.2 }}>{ATTR_FULL[k]}</div>
              <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: val > 0 ? '#f5a89a' : '#f5f2ee', margin: '4px 0' }}>
                {sgn(val)}
              </div>
              <div style={{ fontSize: '13px', color: val > 0 ? '#f5a89a' : '#d4cfc9' }}>{ATTRIBUTE_LABELS[val]}</div>
            </div>
          )
        })}
      </div>

      {/* Secondary stats */}
      <div style={sh}>Secondary stats</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
        {secondaryStats.map(({ label, value, hi }) => (
          <div key={label} style={{
            background: '#242424', border: `1px solid ${hi ? '#7a1f16' : '#2e2e2e'}`,
            borderRadius: '3px', padding: '8px 10px',
          }}>
            <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '1px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>{label}</span>
              {DERIVED_DESCRIPTIONS[label] && (
                <HelpTooltip title={label} text={DERIVED_DESCRIPTIONS[label]} iconStyle={{ width: '12px', height: '12px', fontSize: '13px' }} />
              )}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: hi ? '#f5a89a' : '#f5f2ee' }}>
              {typeof value === 'number' && value <= 3 && label !== 'Morality' && label !== 'Wound Points' && label !== 'Resilience Points' && label !== 'Encumbrance' ? sgn(value) : value}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6 }}>
        All values auto-calculated from RAPID attributes.
      </p>

    </div>
  )
}

const sh: React.CSSProperties = {
  fontFamily: 'Carlito, sans-serif',
  fontSize: '13px', fontWeight: 600, color: '#f5f2ee',
  textTransform: 'uppercase', letterSpacing: '.1em',
  margin: '1.25rem 0 8px', borderBottom: '1px solid #2e2e2e',
  paddingBottom: '4px',
}