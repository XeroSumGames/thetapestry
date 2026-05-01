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

export const metadata = { title: 'Modifiers — XSE SRD §02' }

const modRow = (mod: string, label: string): React.ReactNode => (
  <tr>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 60, fontWeight: 700, color: '#cce0f5' }}>{mod}</td>
    <td style={ruleTableTdStyle}>{label}</td>
  </tr>
)

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('core-mechanics')!} />
      <RuleHero
        eyebrow="§02 · Core Mechanics › Modifiers"
        title="Modifiers (AMod · SMod · CMod)"
        intro={
          <>
            Dice Checks are influenced by up to three modifiers, all
            cumulative: <Term>Attribute Modifier (AMod)</Term>,{' '}
            <Term>Skill Modifier (SMod)</Term>, and{' '}
            <Term>Conditional Modifier (CMod)</Term>.
          </>
        }
      />

      <RuleSection id="amod" title="Attribute Modifier (AMod)">
        <P>
          Each character has five attributes — <Term>R A P I D</Term>{' '}
          (Reason, Acuity, Physicality, Influence, Dexterity). Attributes
          range from −2 to +4 for humans (animals and machines can reach
          +5). Each value is the AMod applied to any Dice Check using that
          attribute.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Mod</th>
              <th style={ruleTableThStyle}>Label</th>
            </tr>
          </thead>
          <tbody>
            {modRow('−2', 'Diminished')}
            {modRow('−1', 'Weak')}
            {modRow('0', 'Average')}
            {modRow('+1', 'Good')}
            {modRow('+2', 'Strong')}
            {modRow('+3', 'Exceptional')}
            {modRow('+4', 'Human Peak')}
            {modRow('+5', 'Superhuman')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="smod" title="Skill Modifier (SMod)">
        <P>
          Each character has skills that range from −3 to +4 based on
          expertise. Each skill is linked to an attribute (e.g.
          Physicality → Unarmed Combat) — a Dice Check often combines both
          AMod and SMod.
        </P>
        <P>
          Vocational skills (marked with an asterisk, e.g.{' '}
          <Term>Psychology*</Term>) start at −3 (Inept) instead of 0
          (Untrained). Earning 1 level in a vocational skill jumps it
          straight from Inept (−3) to Beginner (+1).
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Mod</th>
              <th style={ruleTableThStyle}>Label</th>
            </tr>
          </thead>
          <tbody>
            {modRow('−3', 'Inept')}
            {modRow('0', 'Untrained')}
            {modRow('+1', 'Beginner')}
            {modRow('+2', 'Journeyman')}
            {modRow('+3', 'Professional')}
            {modRow('+4', "Life's Work")}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="cmod" title="Conditional Modifier (CMod)">
        <P>
          Any number of external, unplanned, and unanticipated factors can
          influence a Dice Check. CMods are applied at GM discretion or at
          the request of a player who can <Term>Make The Case</Term> for
          them. CMods are a powerful narrative tool for the GM.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Mod</th>
              <th style={ruleTableThStyle}>Label</th>
            </tr>
          </thead>
          <tbody>
            {modRow('−5', 'Doomed To Fail')}
            {modRow('−4', 'Insurmountable')}
            {modRow('−3', 'Hard')}
            {modRow('−2', 'Difficult')}
            {modRow('−1', 'Challenging')}
            {modRow('0', 'Average')}
            {modRow('+1', 'Simple')}
            {modRow('+2', 'Slight Favor')}
            {modRow('+3', 'Easy')}
            {modRow('+4', 'Trivial')}
            {modRow('+5', 'Divinely Inspired')}
          </tbody>
        </RuleTable>
      </RuleSection>
    </>
  )
}
