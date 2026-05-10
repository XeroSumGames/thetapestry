import {
  RuleHero,
  RuleSection,
  RuleTable,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Infection — XSE §06' }

const WOUND_OUTCOMES: Array<[string, string]> = [
  ['Wild Success / High Insight', 'No infection. High Insight earns 1 Insight Die.'],
  ['Success', 'No infection.'],
  ['Failure', 'Sick for 1d3 days. Lasting Damage risk unless treated.'],
  ['Dire Failure / Low Insight', 'Sick for 1d6 days. Automatic Lasting Damage on Day 0.'],
]

const SICKNESS_OUTCOMES: Array<[string, string]> = [
  ['Wild Success / Success / High Insight', 'Shake it off. No progression.'],
  ['Failure', 'Progressively unwell for 1d3 days. On final day, Mortally Wounded.'],
  ['Dire Failure / Low Insight', 'Progressively unwell for 1d6 days. On final day, Mortally Wounded.'],
]

const TREATMENT_OUTCOMES: Array<[string, string]> = [
  ['Wild Success', 'Cuts remaining sick days in half (round up). Clears Lasting Damage risk.'],
  ['High Insight', 'Wild Success outcome plus 1 Insight Die.'],
  ['Success', 'Clears Lasting Damage risk. Days unchanged.'],
  ['Failure', 'No help, no harm. The sick character cannot be treated again this incident.'],
  ['Dire Failure', '+1 day to remaining sick duration (botched care).'],
  ['Low Insight', 'Dire Failure outcome plus the medic earns 1 Stress pip plus 1 Insight Die.'],
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('combat')!} />
      <RuleHero
        eyebrow="§06 · Combat › Infection"
        title="Infection, Sickness & Disease"
        intro={
          <>
            Two related but distinct damage-over-time tracks. Both
            check <Term>Physicality</Term>, both resolve over days,
            and both can end at <a href="/rules/combat/incapacitation#lasting-wounds" style={{ color: '#7ab3d4' }}>Lasting Wounds (Table 12)</a>.
          </>
        }
      />

      <RuleSection id="wound-infection" title="Wound Infection (post-combat)">
        <P>
          Once combat ends, any character who took at least one
          shot, stab, or cut wound during the fight makes a single{' '}
          <Term>Physicality check</Term> to see if their wounds
          become Infected. One check per character per combat —
          regardless of how many hits they took.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={{ ...ruleTableThStyle, width: 240 }}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {WOUND_OUTCOMES.map(([roll, effect]) => (
              <tr key={roll}>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#cce0f5' }}>{roll}</td>
                <td style={ruleTableTdStyle}>{effect}</td>
              </tr>
            ))}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="sickness-disease" title="Sickness & Disease (environmental)">
        <P>
          A year on from the dog flu, disease and pestilence remain
          rife. Characters exposed to particularly toxic conditions
          — a pit of dead bodies, a sewer wade, contaminated water —
          may need to make a <Term>Physicality check</Term> to
          avoid getting sick. The GM decides when the trigger fires.
        </P>
        <P>
          If the first check fails, the character makes a{' '}
          <Term>second Physicality check</Term> to avoid the disease
          progressing:
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={{ ...ruleTableThStyle, width: 280 }}>Progression Check</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {SICKNESS_OUTCOMES.map(([roll, effect]) => (
              <tr key={roll}>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#cce0f5' }}>{roll}</td>
                <td style={ruleTableTdStyle}>{effect}</td>
              </tr>
            ))}
          </tbody>
        </RuleTable>
        <P>
          When a Sickness & Disease countdown reaches Day 0, the
          character drops to <Term>WP = 0</Term> and enters the
          standard <a href="/rules/combat/incapacitation#mortally-wounded" style={{ color: '#7ab3d4' }}>Mortally Wounded</a> flow:
          they will die in 4 + PHY AMod rounds unless Stabilised.
        </P>
      </RuleSection>

      <RuleSection id="sick-state" title="The 'Sick' state — what it costs">
        <P>
          While a character is sick (either branch), they suffer
          mechanical penalties for the duration:
        </P>
        <ul style={{ margin: '0 0 1rem 1.25rem', color: '#d4cfc9', lineHeight: 1.65 }}>
          <li><Term>-2 CMod</Term> on physical checks: Athletics, Melee Combat, Ranged Combat, Stealth, Survival, Unarmed Combat. Applied automatically by the platform — when the roll fires, a <Term>🤒 Sick</Term> note lands in the roll-feed traitNotes so the deduction is visible.</li>
          <li><Term>RP capped at half-max</Term> (round down). If the character was above the cap when they got sick, current RP gets clamped down.</li>
          <li>WP regen still works at the standard <Term>1 WP per day of rest</Term>. RP regen still works at the standard rate, but the half-max cap is the ceiling until they recover.</li>
        </ul>
        <P>
          When the day counter ticks to 0, all sick-state penalties
          clear: RP cap lifts, CMod is restored. Lasting Damage may
          still apply depending on whether the original check was a
          Failure or Dire Failure, and whether the character received
          Medicine* treatment.
        </P>
      </RuleSection>

      <RuleSection id="treatment" title="Treatment — Medicine* check">
        <P>
          An ally with Medicine* may attempt to treat a sick
          character. <Term>One check per sick incident</Term> — not
          per day. After this attempt, the patient cannot be treated
          again until they recover (or relapse from a fresh trigger).
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={{ ...ruleTableThStyle, width: 200 }}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {TREATMENT_OUTCOMES.map(([roll, effect]) => (
              <tr key={roll}>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#cce0f5' }}>{roll}</td>
                <td style={ruleTableTdStyle}>{effect}</td>
              </tr>
            ))}
          </tbody>
        </RuleTable>
        <P>
          The medic must be at <Term>Engaged</Term> range to treat
          (matches Stabilise). A <a href="/rules/equipment/upkeep" style={{ color: '#7ab3d4' }}>Doctor's Bag or First Aid Kit</a> in the
          medic's inventory grants the listed bonus to the Medicine*
          check.
        </P>
      </RuleSection>

      <RuleSection id="lasting-damage" title="Lasting Damage">
        <P>
          On Day 0 of a sick period, if{' '}
          <Term>infection_lasting_risk</Term> is still set (i.e. a
          Failure was rolled and Medicine* didn't clear the risk),
          the character makes a final <Term>Physicality check</Term>{' '}
          to avoid Lasting Damage. Failure rolls 2d6 on{' '}
          <a href="/rules/combat/incapacitation#lasting-wounds" style={{ color: '#7ab3d4' }}>Table 12: Lasting Wounds</a>.
          Dire Failure on the original Infection check skips this
          step — the Lasting Damage applies automatically.
        </P>
      </RuleSection>
    </>
  )
}
