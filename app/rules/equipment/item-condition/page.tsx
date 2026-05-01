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

export const metadata = { title: 'Item Condition — XSE SRD §07' }

const COND: Array<[string, string, string]> = [
  ['Pristine', '+1 CMod', 'Top condition. Equipment is new or freshly maintained.'],
  ['Used', '0 CMod', 'Default condition for working gear.'],
  ['Worn', '−1 CMod', 'Beginning to show wear from use.'],
  ['Damaged', '−2 CMod', 'Visibly damaged but still functional.'],
  ['Broken', 'Unusable', "Doesn't function. Requires Upkeep to recover."],
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('equipment')!} />
      <RuleHero
        eyebrow="§07 · Equipment › Item Condition"
        title="Item Condition"
        intro={
          <>
            Items are in one of five conditions —{' '}
            <Term>Pristine</Term>, <Term>Used</Term>, <Term>Worn</Term>,{' '}
            <Term>Damaged</Term>, <Term>Broken</Term> — each tied to a
            CMod that applies to any check made with that item.
          </>
        }
      />
      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Condition</th>
            <th style={{ ...ruleTableThStyle, width: 110 }}>CMod</th>
            <th style={ruleTableThStyle}>What it means</th>
          </tr>
        </thead>
        <tbody>
          {COND.map(([name, cmod, desc]) => (
            <tr key={name}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{name}</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', color: '#cce0f5', fontWeight: 700 }}>{cmod}</td>
              <td style={ruleTableTdStyle}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </RuleTable>
      <P>
        Regular usage causes no change in condition. But if an item is
        subjected to heavy, sustained, prolonged, or rough use, it
        requires an <a href="/rules/equipment/upkeep" style={{ color: '#7ab3d4' }}>Upkeep check</a>{' '}
        to determine whether it survives the strain.
      </P>
    </>
  )
}
