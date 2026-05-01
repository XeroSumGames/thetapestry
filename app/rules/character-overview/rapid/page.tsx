import {
  RuleHero,
  RuleTable,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'RAPID Range Attributes — XSE SRD §03' }

const row = (name: string, desc: string): React.ReactNode => (
  <tr>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 180 }}><Term>{name}</Term></td>
    <td style={ruleTableTdStyle}>{desc}</td>
  </tr>
)

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('character-overview')!} />
      <RuleHero
        eyebrow="§03 · Character Overview › RAPID"
        title="RAPID Range Attributes"
        intro={
          <>
            Each character has five attributes — <Term>R · A · P · I · D</Term>.
            Attributes start at 0 (Average) and range from −2 (Diminished)
            to +4 (Human Peak). RAPID values are written together in the
            format <Term>R-A-P-I-D</Term>; an all-Average character is{' '}
            <code>00000</code>.
          </>
        }
      />
      <P>
        Each value is also that attribute's <Term>AMod</Term>, applied to
        any Dice Check involving it. For the full label scale, see{' '}
        <a href="/rules/core-mechanics/modifiers" style={{ color: '#7ab3d4' }}>
          Modifiers → AMod
        </a>.
      </P>
      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Attribute</th>
            <th style={ruleTableThStyle}>What it represents</th>
          </tr>
        </thead>
        <tbody>
          {row('Reason (RSN)', 'The ability to process data, think critically, and make logical assumptions.')}
          {row('Acuity (ACU)', 'The mixture of instinct and cunning required for good situational awareness.')}
          {row('Physicality (PHY)', 'A measure of athleticism, conditioning, discipline, and self-control.')}
          {row('Influence (INF)', 'A combination of charisma, charm, and attractiveness.')}
          {row('Dexterity (DEX)', 'A reflection of agility, reflexes, and hand-eye coordination.')}
        </tbody>
      </RuleTable>
    </>
  )
}
