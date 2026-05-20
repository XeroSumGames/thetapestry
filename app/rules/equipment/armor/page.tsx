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
import { ARMOR } from '../../../../lib/xse-schema'
import { rarityColor } from '../../../../lib/rarity-colors'

export const metadata = { title: 'Armor - XSE §07' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('equipment')!} />
      <RuleHero
        eyebrow="§07 · Equipment › Armor"
        title="Armor"
        intro={
          <>
            Armor is uncommon but life-saving. Each piece has a{' '}
            <Term>Defensive Modifier (DM)</Term> that lowers attack
            chance and reduces damage that lands. DMs <Term>stack</Term>:
            wear a Metal Helmet, Riot Gear, and a Riot Shield and
            their DMs add together, capped only by your{' '}
            <a href="/rules/equipment/upkeep" style={{ color: '#7ab3d4' }}>Encumbrance</a>.
          </>
        }
      />

      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Name</th>
            <th style={{ ...ruleTableThStyle, width: 110, textAlign: 'center' }}>Rarity</th>
            <th style={{ ...ruleTableThStyle, width: 60, textAlign: 'center' }}>ENC</th>
            <th style={{ ...ruleTableThStyle, width: 60, textAlign: 'center' }}>DM</th>
            <th style={ruleTableThStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {ARMOR.map(a => (
            <tr key={a.name}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{a.name}</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', color: rarityColor(a.rarity) }}>{a.rarity}</td>
              <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.enc}</td>
              <td style={{ ...ruleTableTdStyle, textAlign: 'center', color: '#cce0f5', fontWeight: 700 }}>−{a.dm}</td>
              <td style={ruleTableTdStyle}>{a.notes}</td>
            </tr>
          ))}
        </tbody>
      </RuleTable>

      <RuleSection id="stacking" title="Stacking & encumbrance">
        <P>
          Armor pieces stack additively. A character wearing
          Tactical Armor (DM 2), a Metal Helmet (DM 1), and carrying
          a Riot Shield (DM 1, reactive - see below) is at{' '}
          <Term>−4 DM</Term> against melee attackers, <Term>−3 DM</Term>{' '}
          against ranged.
        </P>
        <P>
          The natural cap is <Term>Encumbrance</Term>: every piece
          adds to your carry weight, and the heavy stuff (Plate Steel
          ENC 3, Improvised ENC 2, Riot Gear ENC 2) eats your
          capacity fast. A wearer encumbered enough to drop their
          effective movement and CMod will feel the trade-off
          before the DM stack runs away.
        </P>
      </RuleSection>

      <RuleSection id="reactive" title="Reactive armor (Riot Shield)">
        <P>
          The <Term>Riot Shield</Term> has the{' '}
          <Term>reactive (melee-only)</Term> trait: its DM applies
          only to melee or unarmed attacks. A bullet ignores the
          shield entirely; a baseball bat or grappler reckons with
          the full DM.
        </P>
        <P>
          This is a deliberate departure from the QS Table 7 default
          (where Riot Shield was a flat DM 2 that worked against
          everything). The reactive flag stops Riot Gear + Riot
          Shield from double-stacking against ranged combat - they
          cover overlapping gaps in a head-on firefight.
        </P>
      </RuleSection>

      <RuleSection id="phy-requirements" title="Physicality requirements">
        <P>
          <Term>Improvised</Term> and <Term>Plate Steel</Term> are
          heavy enough that wearers without the strength to manage
          them suffer a CMod penalty:
        </P>
        <ul style={{ margin: '0 0 1rem 1.25rem', color: '#d4cfc9', lineHeight: 1.65 }}>
          <li><Term>Improvised</Term>: requires PHY 1 to wear, or <Term>−1 CMod</Term> on all actions while worn.</li>
          <li><Term>Plate Steel</Term>: requires PHY 1 to wear, or <Term>−2 CMod</Term> on all actions while worn.</li>
        </ul>
        <P>
          PHY 0 wearers can still strap into either, they just
          fight slower and clumsier the entire time.
        </P>
      </RuleSection>

      <RuleSection id="upkeep" title="Upkeep & Damage">
        <P>
          Armor degrades with use. After each combat where the
          armor was struck, the wearer (or a willing helper) makes
          an <a href="/rules/equipment/upkeep" style={{ color: '#7ab3d4' }}>Upkeep Check</a> on
          each piece to prevent it dropping a level of condition.
        </P>
        <P>
          Phase 1 of the platform implementation surfaces a manual
          Upkeep button on each worn armor item. Phase 2 will
          auto-fire upkeep on any armor "involved" in a Moment of
          Low Insight (1+1) during combat - same trigger pattern as
          weapon upkeep.
        </P>
      </RuleSection>
    </>
  )
}
