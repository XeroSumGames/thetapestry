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

export const metadata = { title: 'Item Traits — XSE SRD §07' }

const TRAITS: Array<[string, string]> = [
  ['Automatic Burst (X)', 'Can fire X rounds simultaneously at anyone at Engaged range. Uses listed number of rounds per burst.'],
  ['Blast Radius', 'Causes damage within an area. Engaged = full damage, Close = 50%, further = 25%.'],
  ['Burning (X)', 'Beyond initial damage, the target suffers an additional X WP/RP per round for 1d3 rounds.'],
  ['Close-Up', 'Hits indiscriminately at Engaged range — anyone caught in the cone takes 50% damage.'],
  ['Cumbersome (X)', 'Requires Physicality of X to use comfortably; otherwise incurs −X CMod.'],
  ['Stun', 'Deals no WP damage. On Wild Success or Moment of High Insight, target is Incapacitated for 1d6 − PHY AMod rounds (minimum 1).'],
  ['Tracking', 'When the wielder Readies their Weapon before an attack, they also track their target — gaining +1 CMod on the next attack.'],
  ['Unwieldy (X)', 'Requires Dexterity of X to use correctly; otherwise incurs −X CMod.'],
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('equipment')!} />
      <RuleHero
        eyebrow="§07 · Equipment › Item Traits"
        title="Item Traits"
        intro={
          <>
            Some weapons and equipment have <Term>Traits</Term> that
            modify how they behave. Items can have multiple Traits.
            Numbers in parentheses (e.g. <Term>Automatic Burst (3)</Term>)
            are the rounds, charges, or threshold value for that Trait.
          </>
        }
      />

      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Trait</th>
            <th style={ruleTableThStyle}>Effect</th>
          </tr>
        </thead>
        <tbody>
          {TRAITS.map(([trait, effect]) => (
            <tr key={trait}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 220, fontWeight: 700, color: '#f5f2ee' }}>{trait}</td>
              <td style={ruleTableTdStyle}>{effect}</td>
            </tr>
          ))}
        </tbody>
      </RuleTable>

      <P>
        For the full weapon catalog with Traits applied per weapon, see{' '}
        <a href="/rules/appendix-equipment" style={{ color: '#7ab3d4' }}>
          Appendix C — Weapons & Equipment
        </a>
        .
      </P>
    </>
  )
}
