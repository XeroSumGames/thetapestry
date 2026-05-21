import {
  RuleHero,
  RuleTable,
  TryIt,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Secondary Stats - XSE SRD §03' }

const row = (stat: string, abbrev: string, formula: string, desc: string): React.ReactNode => (
  <tr>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 200 }}>
      <Term>{stat}</Term>{' '}
      <span style={{ color: '#7a7a7a', fontFamily: 'Carlito, sans-serif', fontSize: 13 }}>({abbrev})</span>
    </td>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 200, color: '#cce0f5', fontWeight: 700 }}>{formula}</td>
    <td style={ruleTableTdStyle}>{desc}</td>
  </tr>
)

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('character-overview')!} />
      <RuleHero
        eyebrow="§03 · Character Overview › Secondary Stats"
        title="Secondary Stats"
        intro={
          <>
            PCs have a series of <Term>Secondary Stats</Term> derived from
            attributes and skills. They affect combat, social interactions,
            and the wider narrative.
          </>
        }
      />
      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Stat</th>
            <th style={ruleTableThStyle}>Formula</th>
            <th style={ruleTableThStyle}>What it represents</th>
          </tr>
        </thead>
        <tbody>
          {row('Wound Points', 'WP', '10 + PHY + DEX', 'How much physical damage a character can take before becoming Mortally Wounded and dying.')}
          {row('Resilience Points', 'RP', '6 + PHY', 'How much damage or stress it takes to incapacitate a character.')}
          {row('Melee Defense Mod', 'MDM', 'PHY', 'Lowers the chance of getting hit by melee attacks and mitigates damage.')}
          {row('Ranged Defense Mod', 'RDM', 'DEX', 'Lowers the chance of getting hit by ranged attacks and mitigates damage.')}
          {row('Initiative Mod', 'INIT', 'ACU + DEX', 'Added to initiative checks to determine the order in which participants act during combat.')}
          {row('Encumbrance', 'ENC', '6 + PHY', 'How much weight a character can carry before needing to stop and rest, or drop something.')}
          {row('Perception', 'PER', 'RSN + ACU', 'How well a character picks up on subtleties and how tuned in they are to their environment.')}
          {row('Stress Modifier', 'SM', 'RSN + ACU', 'Added to Stress Checks at the end of brutal scenes - see §06 Combat → Stress.')}
          {row('Stress Level', 'SL', 'starts at 0, max 5', 'Rises by 1 on a failed Stress Check (manual) or when entering 0 WP / 0 RP (automatic). At pip 5, the character makes a Hold It Together save (2d6 + RSN + ACU + CMod ≥ 7); failure triggers a Breaking Point reaction from Table 13. See §06 Combat → Stress.')}
          {row('Morality', 'MOR', '3', "How true a character is acting to their own ethical compass. Affects how they interact with the world.")}
        </tbody>
      </RuleTable>
      <P>
        Defense Mods serve double duty: they lower the chance of getting
        hit AND mitigate any damage that does land - so a high PHY
        character is harder to hit in melee AND takes less damage when hit.
      </P>
      <P>
        <Term>Encumbrance limit</Term> is <strong>6 + PHY AMod</strong>,
        plus <strong>2</strong> if the character is carrying a Backpack or
        Military Backpack. A character can carry right up to their limit
        with no penalty.
      </P>
      <P>
        <Term>Overloaded.</Term> The moment a character exceeds their
        Encumbrance limit, two things happen until they drop weight or
        rest: their <strong>movement speed drops by half</strong>, and they
        take <strong>1 RP damage per hour for each point they are over the
        limit</strong> (so being 3 over costs 3 RP every hour, not 1). If
        this drives them to 0 RP they become Incapacitated - they come to
        within moments and recover 1 RP, but must then rest for four hours
        to recover half their RP before carrying on. Alternatively they can
        drop enough gear to get back within their limit, at which point the
        RP damage stops immediately.
      </P>
      <TryIt href="/dashboard">
        Every character sheet shows the live derived stats - open one to
        see them computed from your RAPID values.
      </TryIt>
    </>
  )
}
