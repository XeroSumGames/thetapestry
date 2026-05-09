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
import { rarityColor } from '../../../../lib/rarity-colors'
import { RATIONS } from '../../../../lib/xse-schema'

export const metadata = { title: 'Rations — XSE SRD §07' }

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
          {RATIONS.map(r => (
            <tr key={r.name}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{r.name}</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', color: rarityColor(r.rarity) }}>{r.rarity}</td>
              <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{r.enc}</td>
              <td style={ruleTableTdStyle}>{r.notes}</td>
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
