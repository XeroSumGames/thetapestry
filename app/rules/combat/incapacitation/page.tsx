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

export const metadata = { title: 'Incapacitation — XSE SRD §06' }

const LASTING: Array<[number, string, string]> = [
  [2, 'Lost Eye', '−1 on checks using Dexterity'],
  [3, 'Brain Injury', '−2 Reason'],
  [4, 'Diminished', '−1 Dexterity'],
  [5, 'Shaken', '−1 Max. Resilience Points'],
  [6, 'Weakened', '−1 Max. Wound Points'],
  [7, 'Skittish', '−1 Initiative Modifier'],
  [8, 'Scarring', '−1 Influence'],
  [9, 'Fragile', '−1 Physicality'],
  [10, 'Hearing Loss', '−1 Acumen'],
  [11, 'Crippled', '−1 Perception & −1 Acumen'],
  [12, 'Shell Shock', '−2 Dexterity'],
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('combat')!} />
      <RuleHero
        eyebrow="§06 · Combat › Incapacitation"
        title="Incapacitation, Mortal Wounds & Death"
        intro={
          <>
            <Term>RP = 0</Term> means a character is incapacitated.{' '}
            <Term>WP = 0</Term> means they're <Term>Mortally Wounded</Term>{' '}
            and dying. Quick action and a Medicine* check can save them.
          </>
        }
      />

      <RuleSection id="incapacitation" title="Incapacitation (RP = 0)">
        <P>
          Once a character's <Term>Resilience Points</Term> reach 0, they
          experience Incapacitation for <Term>4 − PHY AMod rounds</Term>{' '}
          (minimum 1 round). They regain consciousness with 1 RP and
          recover an additional 1 RP per round if they're not in combat.
        </P>
      </RuleSection>

      <RuleSection id="mortally-wounded" title="Mortally Wounded (WP = 0)">
        <P>
          If a character's <Term>Wound Points</Term> reach 0, they become
          Mortally Wounded. They will <Term>die in 4 + PHY AMod rounds</Term>{' '}
          unless they are <Term>Stabilised</Term>.
        </P>
      </RuleSection>

      <RuleSection id="stabilise" title="Stabilise">
        <P>
          To save a Mortally Wounded character, another character must
          succeed on a <Term>Medicine* check</Term>, or roll a Wild
          Success on a <Term>Reason check</Term> (improvising care without
          formal training).
        </P>
        <P>
          Once Stabilised, the character remains Incapacitated for{' '}
          <Term>16 − PHY AMod rounds</Term> (minimum 1 round). They then
          regain consciousness with 1 WP and 1 RP.
        </P>
      </RuleSection>

      <RuleSection id="death" title="Death">
        <P>
          Mortally Wounded characters who are not Stabilised within{' '}
          <Term>4 + PHY AMod rounds</Term> die.
        </P>
        <P>
          The only option to prevent death is to{' '}
          <Term>spend ALL of the character's Insight Dice</Term>. The
          character remains alive with 1 WP and 1 RP. (See{' '}
          <a href="/rules/core-mechanics/insight-dice" style={{ color: '#7ab3d4' }}>
            Insight Dice
          </a>
          .)
        </P>
      </RuleSection>

      <RuleSection id="healing" title="Healing">
        <P>
          Injured characters who were never Mortally Wounded heal{' '}
          <Term>1 WP per day of rest</Term>. If they were Mortally
          Wounded, they heal <Term>1 WP per 2 days of rest</Term>.
        </P>
        <P>
          A character who is Resting and not undertaking any activity
          recovers <Term>1 RP per hour</Term>.
        </P>
      </RuleSection>

      <RuleSection id="lasting-wounds" title="Lasting Wounds (Table 12)">
        <P>
          A character who is Mortally Wounded must make a Physicality
          check to avoid taking 1 Lasting Wound. If they fail, roll{' '}
          <Term>2d6</Term> on Table 12. <Term>Lasting Wounds are
          permanent</Term> and cannot be healed.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>2d6</th>
              <th style={ruleTableThStyle}>Wound</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {LASTING.map(([roll, name, effect]) => (
              <tr key={roll}>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 50, fontWeight: 700, color: '#cce0f5' }}>{roll}</td>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{name}</td>
                <td style={ruleTableTdStyle}>{effect}</td>
              </tr>
            ))}
          </tbody>
        </RuleTable>
      </RuleSection>
    </>
  )
}
