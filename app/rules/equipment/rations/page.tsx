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

export const metadata = { title: 'Rations — XSE SRD §07' }

const RATIONS: Array<[string, string, string, string]> = [
  ['Standard Rations',       'Common',   '0.5',  '1 day food + water.'],
  ['Luxury Rations',         'Common',   '0.5',  '1 day food + water; small morale bump.'],
  ['Military Grade Rations', 'Uncommon', '0.25', 'Compact, calorie-dense; 1 day food + water.'],
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('equipment')!} />
      <RuleHero
        eyebrow="§07 · Equipment › Rations"
        title="Rations"
        intro={
          <>
            One <Term>Ration</Term> covers a character's food and water
            for a single day. Without one, the character starts taking{' '}
            <a href="/rules/combat/damage#subsistence" style={{ color: '#7ab3d4' }}>
              Subsistence Damage
            </a>{' '}
            after 24 hours.
          </>
        }
      />

      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Type</th>
            <th style={{ ...ruleTableThStyle, width: 110, textAlign: 'center' }}>Rarity</th>
            <th style={{ ...ruleTableThStyle, width: 70, textAlign: 'center' }}>ENC</th>
            <th style={ruleTableThStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {RATIONS.map(([name, rarity, enc, notes]) => (
            <tr key={name}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{name}</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', color: rarity === 'Uncommon' ? '#7ab3d4' : '#7fc458' }}>{rarity}</td>
              <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{enc}</td>
              <td style={ruleTableTdStyle}>{notes}</td>
            </tr>
          ))}
        </tbody>
      </RuleTable>

      <P>
        Characters begin play with <Term>2 Rations</Term> by default.
        Unless otherwise stated by the GM, these are Standard Rations.
      </P>
    </>
  )
}
