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

export const metadata = { title: 'Fleshing A Character Out — XSE SRD §03' }

const COMP_MOT: Array<[number, string, string]> = [
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
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('character-overview')!} />
      <RuleHero
        eyebrow="§03 · Character Overview › Personality"
        title="Fleshing A Character Out"
        intro="Beyond stats and skills, three personality elements anchor a character's identity at the table."
      />

      <RuleSection id="three-words" title="Three Words">
        <P>
          Players should choose <Term>three words</Term> that define the
          PC's core behaviours or personality traits. These serve as a
          roleplaying anchor and guide how the character reacts to people
          and situations during the course of the game.
        </P>
        <P>
          Specific words tend to be more useful than broad or generic
          ones, but anything that helps tie a player to their character is
          acceptable. The three words can be shared with other players,
          kept secret, or woven into gameplay by the GM.
        </P>
      </RuleSection>

      <RuleSection id="complications-motivations" title="Complications & Motivations">
        <P>
          Each character has both a <Term>Complication</Term> and a{' '}
          <Term>Motivation</Term> that drive them and serve as narrative
          tools. Players can choose from Tables 6 and 7, or roll{' '}
          <Term>2d6</Term> for a random pick. These can be openly shared
          or woven into the narrative.
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
            {COMP_MOT.map(([roll, comp, mot]) => (
              <tr key={roll}>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 50, fontWeight: 700, color: '#cce0f5' }}>{roll}</td>
                <td style={ruleTableTdStyle}>{comp}</td>
                <td style={ruleTableTdStyle}>{mot}</td>
              </tr>
            ))}
          </tbody>
        </RuleTable>
      </RuleSection>
    </>
  )
}
