import {
  RuleHero,
  RuleSection,
  RuleTable,
  TryIt,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../components/rules/RuleSection'

// /rules/character-overview — XSE SRD §03. Source: SRD v1.1.17 §03.

const formulaRow = (
  stat: string,
  abbrev: string,
  formula: string,
  desc: string,
): React.ReactNode => (
  <tr>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 200 }}>
      <Term>{stat}</Term>{' '}
      <span style={{ color: '#7a7a7a', fontFamily: 'Carlito, sans-serif', fontSize: 13 }}>({abbrev})</span>
    </td>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 200, color: '#cce0f5', fontWeight: 700 }}>
      {formula}
    </td>
    <td style={ruleTableTdStyle}>{desc}</td>
  </tr>
)

export const metadata = {
  title: 'Character Overview — XSE SRD',
  description:
    'RAPID Range Attributes, Skills, Secondary Stats, and the personality elements that flesh a character out.',
}

export default function CharacterOverviewPage() {
  return (
    <>
      <RuleHero
        eyebrow="§03 · Character Overview"
        title="Character Overview"
        intro={
          <>
            A Player Character (PC) is the player's representation in the
            game world — their eyes, ears, hands, and mouth. In game terms,
            a character is composed of <Term>physical and mental
            attributes</Term>, <Term>skills</Term>, and{' '}
            <Term>secondary statistics</Term> derived from those.
          </>
        }
      />

      <RuleSection id="rapid" title="RAPID Range Attributes">
        <P>
          Each character has five attributes — <Term>R · A · P · I · D</Term>
          {' '}— referred to as the RAPID Range. Attributes start at 0
          (Average) but range from −2 (Diminished) up to +4 (Human Peak).
          Animals and machines can reach +5 (Superhuman).
        </P>
        <P>
          RAPID Range Attributes are written in the format{' '}
          <Term>R-A-P-I-D</Term> — so a character with all 0 attributes has
          a RAPID Range of <code>00000</code>. Each value is also its{' '}
          <Term>Attribute Modifier (AMod)</Term> applied to relevant Dice
          Checks.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Attribute</th>
              <th style={ruleTableThStyle}>What it represents</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 160 }}>
                <Term>Reason (RSN)</Term>
              </td>
              <td style={ruleTableTdStyle}>
                The ability to process data, think critically, and make
                logical assumptions.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>Acuity (ACU)</Term>
              </td>
              <td style={ruleTableTdStyle}>
                The mixture of instinct and cunning required for good
                situational awareness.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>Physicality (PHY)</Term>
              </td>
              <td style={ruleTableTdStyle}>
                A measure of athleticism, conditioning, discipline, and
                self-control.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>Influence (INF)</Term>
              </td>
              <td style={ruleTableTdStyle}>
                A combination of charisma, charm, and attractiveness.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>Dexterity (DEX)</Term>
              </td>
              <td style={ruleTableTdStyle}>
                A reflection of agility, reflexes, and hand-eye coordination.
              </td>
            </tr>
          </tbody>
        </RuleTable>
        <P>
          For the AMod scale (−2 Diminished … +4 Human Peak …), see{' '}
          <a href="/rules/core-mechanics#amod" style={{ color: '#7ab3d4' }}>
            Core Mechanics → AMod table
          </a>
          .
        </P>
      </RuleSection>

      <RuleSection id="skills" title="Skills">
        <P>
          Characters have a variety of skills based on their life
          experiences. Most skills range from <Term>0 (Untrained)</Term> to{' '}
          <Term>+4 (Life's Work)</Term>; several skills are{' '}
          <Term>vocational</Term> and start at <Term>−3 (Inept)</Term>.
        </P>
        <P>
          The skill level is a <Term>Skill Modifier (SMod)</Term> added to
          any Dice Check using that skill. Each skill is associated with an
          attribute (e.g. Barter is tied to Influence; Unarmed Combat to
          Physicality). Dice Checks usually combine both AMod and SMod.
        </P>
        <P>
          Vocational skills are marked with an asterisk (e.g.{' '}
          <Term>Psychology*</Term>). They start at −3 (Inept) instead of 0.
          When a character earns 1 level in a vocational skill, they
          advance from −3 (Inept) directly to +1 (Beginner).
        </P>
        <P>
          For the full skill list with attribute pairings and descriptions,
          see <a href="/rules/skills" style={{ color: '#7ab3d4' }}>§05 Skills</a>
          {' '}or <a href="/rules/appendix-skills" style={{ color: '#7ab3d4' }}>Appendix B</a>.
        </P>
      </RuleSection>

      <RuleSection id="secondary-stats" title="Secondary Stats">
        <P>
          PCs have a series of <Term>Secondary Stats</Term> derived from
          attributes and skills. They affect combat, social interactions,
          and the wider narrative.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Stat</th>
              <th style={ruleTableThStyle}>Formula</th>
              <th style={ruleTableThStyle}>What it represents</th>
            </tr>
          </thead>
          <tbody>
            {formulaRow('Wound Points', 'WP', '10 + PHY + DEX', 'How much physical damage a character can take before becoming Mortally Wounded and dying.')}
            {formulaRow('Resilience Points', 'RP', '6 + PHY', 'How much damage or stress it takes to incapacitate a character.')}
            {formulaRow('Melee Defense Mod', 'MDM', 'PHY', 'Lowers the chance of getting hit by melee attacks and mitigates damage.')}
            {formulaRow('Ranged Defense Mod', 'RDM', 'DEX', 'Lowers the chance of getting hit by ranged attacks and mitigates damage.')}
            {formulaRow('Initiative Mod', 'INIT', 'ACU + DEX', 'Added to initiative checks to determine the order in which participants act during combat.')}
            {formulaRow('Encumbrance', 'ENC', '6 + PHY', 'How much weight a character can carry before needing to stop and rest, or drop something.')}
            {formulaRow('Perception', 'PER', 'RSN + ACU', 'How well a character picks up on subtleties and how tuned in they are to their environment.')}
            {formulaRow('Stress Modifier', 'SM', 'RSN + ACU', 'Added to Stress Checks at the end of brutal scenes — see §06 Combat → Stress.')}
            {formulaRow('Breaking Point', 'BP', '3 (default)', 'Stress starts at 0 and culminates at 5; reaching the Breaking Point triggers a Lasting Wound.')}
          </tbody>
        </RuleTable>
        <TryIt href="/dashboard">
          Every character sheet shows the live derived stats — open one to
          see them computed from your RAPID values.
        </TryIt>
      </RuleSection>

      <RuleSection id="fleshing-out" title="Fleshing A Character Out">
        <RuleSection id="three-words" title="Three Words" level={3}>
          <P>
            Players should choose <Term>three words</Term> that define the
            PC's core behaviours or personality traits. These serve as a
            roleplaying anchor and guide how the character reacts to people
            and situations during the course of the game.
          </P>
          <P>
            Specific words tend to be more useful than broad or generic
            ones, but anything that helps tie a player to their character
            is acceptable. The three words can be shared with other
            players, kept secret, or woven into gameplay by the GM.
          </P>
        </RuleSection>

        <RuleSection id="complications-motivations" title="Complications & Motivations" level={3}>
          <P>
            Each character has both a <Term>Complication</Term> and a{' '}
            <Term>Motivation</Term> that drive them and serve as narrative
            tools. Players can choose from Tables 6 and 7 or roll{' '}
            <Term>2d6</Term> for a random pick.
          </P>

          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>2d6</th>
                <th style={ruleTableThStyle}>Complication (Table 6)</th>
                <th style={ruleTableThStyle}>Motivation (Table 7)</th>
              </tr>
            </thead>
            <tbody>
              {[
                [2, 'Addiction', 'Accumulate'],
                [3, 'Betrayed', 'Build'],
                [4, 'Code of Honor', 'Find Safety'],
                [5, 'Criminal Past', 'Hedonism'],
                [6, 'Daredevil', 'Make Amends'],
                [7, 'Dark Secret', 'Preach'],
                [8, 'Family Obligation', 'Protect'],
                [9, 'Famous', 'Reunite'],
                [10, 'Loss', 'Revenge'],
                [11, 'Outstanding Debt', 'Stay Alive'],
                [12, 'Personal Enemy', 'Take Advantage'],
              ].map(([roll, comp, mot]) => (
                <tr key={roll as number}>
                  <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 50, fontWeight: 700, color: '#cce0f5' }}>
                    {roll}
                  </td>
                  <td style={ruleTableTdStyle}>{comp}</td>
                  <td style={ruleTableTdStyle}>{mot}</td>
                </tr>
              ))}
            </tbody>
          </RuleTable>
        </RuleSection>
      </RuleSection>

      <p
        style={{
          marginTop: '4rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #2e2e2e',
          fontSize: 13,
          color: '#7a7a7a',
          lineHeight: 1.7,
        }}
      >
        Source: <code>XSE SRD v1.1.17 §03 Character Overview</code>.
      </p>
    </>
  )
}
