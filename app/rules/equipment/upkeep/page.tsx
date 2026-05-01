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

export const metadata = { title: 'Upkeep — XSE SRD §07' }

const OUT: Array<[string, string, boolean]> = [
  ['Moment of High Insight (6+6)', "Condition raised by 2 levels (max Used).", true],
  ['Wild Success (14+)', "Condition raised by 1 level (max Used).", true],
  ['Success (9–13)', "No change to the item's condition.", false],
  ['Failure (4–8)', "Condition reduced by 1 level.", false],
  ['Dire Failure (0–3)', 'The item breaks immediately.', false],
  ['Moment of Low Insight (1+1)', 'Item breaks immediately AND deals 1 WP damage to the character.', false],
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('equipment')!} />
      <RuleHero
        eyebrow="§07 · Equipment › Upkeep"
        title="Upkeep"
        intro={
          <>
            When an item is subjected to heavy, sustained, prolonged, or
            rough use, it requires an <Term>Upkeep check</Term>. The roll
            uses Mechanic*, Tinkerer, or a weapon-related skill (Ranged
            Combat, Melee Combat, Heavy Weapons*, Demolitions*, or
            Weaponsmith*).
          </>
        }
      />

      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Roll</th>
            <th style={ruleTableThStyle}>Effect</th>
          </tr>
        </thead>
        <tbody>
          {OUT.map(([roll, effect, emp]) => (
            <tr key={roll} style={emp ? { background: '#150f0e', borderLeft: '2px solid #c0392b' } : undefined}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 280 }}><Term>{roll}</Term></td>
              <td style={ruleTableTdStyle}>{effect}</td>
            </tr>
          ))}
        </tbody>
      </RuleTable>

      <P>
        Note that an Upkeep check can only restore an item to{' '}
        <Term>Used</Term> condition — the +1 CMod of <Term>Pristine</Term>{' '}
        is reserved for genuinely new or freshly factory-maintained gear.
      </P>
    </>
  )
}
