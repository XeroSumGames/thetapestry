import {
  RuleHero,
  RuleSection,
  RuleTable,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../components/rules/RuleSection'

export const metadata = { title: 'Appendix A — Tables — XSE SRD' }

const LASTING: Array<[number, string, string]> = [
  [2, 'Lost Eye', '−1 ACU. Damaged'],
  [3, 'Brain Injury', '−2 RSN'],
  [4, 'Disfigurement', '−1 INF'],
  [5, 'Spine Injury', '−1 movement. Reduced RP'],
  [6, 'Wasted Limb', '−1 movement. Wound Points reduced'],
  [7, 'Shocked', '−1 INIT'],
  [8, 'Slowed', '−1 INIT'],
  [9, 'Frail', '−1 PHY'],
  [10, 'Hearing Loss', '−1 ACU'],
  [11, 'Compound Injury', '−1 PHY and −1 ACU'],
  [12, 'Severe Spine', '−2 DEX'],
]
const BREAKING: Array<[number, string, string]> = [
  [2, 'Catatonic', '−1 movement. Damaged'],
  [3, 'Cold Fury', '−2 RSN'],
  [4, 'Berserker Rage', '−1 DEX'],
  [5, 'Despair', '−1 morale, lost RP'],
  [6, 'Obsessed', '−1 morale. Wound Points reduced'],
  [7, 'Panic Spiral', '−1 INIT'],
  [8, 'Frozen', '−1 INF'],
  [9, 'Reckless Abandon', '−1 PHY'],
  [10, 'Self-Harm', '−1 ACU'],
  [11, 'Self-Destructive Urge', '−1 PHY and −1 ACU'],
  [12, 'Identity Off', '−2 DEX'],
]

const link = (href: string, text: string): React.ReactNode => (
  <a href={href} style={{ color: '#7ab3d4', textDecoration: 'underline' }}>{text}</a>
)

const tocRow = (n: string, name: string, page: React.ReactNode): React.ReactNode => (
  <tr>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 80, fontWeight: 700, color: '#cce0f5' }}>{n}</td>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{name}</td>
    <td style={ruleTableTdStyle}>{page}</td>
  </tr>
)

const rollRow = ([roll, name, effect]: [number, string, string]): React.ReactNode => (
  <tr key={roll}>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 50, fontWeight: 700, color: '#cce0f5' }}>{roll}</td>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{name}</td>
    <td style={ruleTableTdStyle}>{effect}</td>
  </tr>
)

export default function Page() {
  return (
    <>
      <RuleHero
        eyebrow="Appendix A · Tables"
        title="All Reference Tables"
        intro="Every numbered table in the SRD, in one place. Each row links back to the section the table lives in."
      />

      <RuleSection id="index" title="Table index">
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>#</th>
              <th style={ruleTableThStyle}>Title</th>
              <th style={ruleTableThStyle}>Lives in</th>
            </tr>
          </thead>
          <tbody>
            {tocRow('1', 'Outcomes', link('/rules/core-mechanics/dice-check', '§02 Dice Check Outcomes'))}
            {tocRow('2', 'Attribute Mod (AMod)', link('/rules/core-mechanics/modifiers#amod', '§02 Modifiers → AMod'))}
            {tocRow('3', 'Skill Mod (SMod)', link('/rules/core-mechanics/modifiers#smod', '§02 Modifiers → SMod'))}
            {tocRow('4', 'Conditional Mod (CMod)', link('/rules/core-mechanics/modifiers#cmod', '§02 Modifiers → CMod'))}
            {tocRow('5', 'Secondary Stats', link('/rules/character-overview/secondary-stats', '§03 Secondary Stats'))}
            {tocRow('6', 'Complications', link('/rules/character-overview/fleshing-out#complications-motivations', '§03 Complications & Motivations'))}
            {tocRow('7', 'Motivations', link('/rules/character-overview/fleshing-out#complications-motivations', '§03 Complications & Motivations'))}
            {tocRow('8', 'Professions & Skills', link('/rules/character-creation/backstory-generation', '§04 Backstory Generation'))}
            {tocRow('9', 'Skills', link('/rules/skills/skill-list', '§05 Skill List'))}
            {tocRow('10', 'Combat Actions', link('/rules/combat/combat-rounds#actions', '§06 Combat Actions'))}
            {tocRow('11', 'Range Bands', link('/rules/combat/range', '§06 Range'))}
            {tocRow('12', 'Lasting Wounds', '§06 Combat → below')}
            {tocRow('13', 'Breaking Point', '§06 Combat → below')}
            {tocRow('14', 'Item Condition', link('/rules/equipment/item-condition', '§07 Item Condition'))}
            {tocRow('15', 'Item Traits', link('/rules/equipment/item-traits', '§07 Item Traits'))}
            {tocRow('16', 'Melee Weapons', link('/rules/appendix-equipment#melee', 'App C Equipment'))}
            {tocRow('17', 'Ranged Weapons', link('/rules/appendix-equipment#ranged', 'App C Equipment'))}
            {tocRow('18', 'Explosive Weapons', link('/rules/appendix-equipment#explosive', 'App C Equipment'))}
            {tocRow('19', 'Specialist Weapons', link('/rules/appendix-equipment#specialist', 'App C Equipment'))}
            {tocRow('20', 'Equipment', link('/rules/appendix-equipment#equipment', 'App C Equipment'))}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="lasting-wounds" title="Table 12 — Lasting Wounds">
        <P>
          Roll <Term>2d6</Term> when a Mortally Wounded character fails
          their Physicality check to avoid a permanent wound.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>2d6</th>
              <th style={ruleTableThStyle}>Wound</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>{LASTING.map(rollRow)}</tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="breaking-point" title="Table 13 — Breaking Point">
        <P>
          Roll <Term>2d6</Term> when a character's Stress Level reaches
          their Breaking Point.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>2d6</th>
              <th style={ruleTableThStyle}>Reaction</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>{BREAKING.map(rollRow)}</tbody>
        </RuleTable>
      </RuleSection>
    </>
  )
}
