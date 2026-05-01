import {
  RuleHero,
  RuleTable,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Dice & Naming Conventions — XSE SRD §01' }

const row = (term: React.ReactNode, desc: React.ReactNode): React.ReactNode => (
  <tr>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 200 }}>
      <Term>{term}</Term>
    </td>
    <td style={ruleTableTdStyle}>{desc}</td>
  </tr>
)

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('overview')!} />
      <RuleHero
        eyebrow="§01 · Overview › Conventions"
        title="Dice & Naming Conventions"
        intro="Shorthand used throughout the SRD. Bookmark this if you're new to the system."
      />
      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Term</th>
            <th style={ruleTableThStyle}>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {row('2d6', 'Most checks use 2 six-sided dice, summed for a final tally.')}
          {row('xd6', <>Multiple dice. Written as <code>3d6</code>, <code>4d6</code>, etc. Final score is the sum.</>)}
          {row('1d3', 'Roll a d6 and halve the result (rounding up) for a result of 1–3.')}
          {row('Game Master (GM)', 'The player who facilitates, narrates, and referees. Defines the environment and propels the story.')}
          {row('PC', "A Player Character — also just called a character — is the player's representation in the story.")}
          {row('NPC', 'Non-player characters — others in the world the players interact with, brought to life by the GM.')}
          {row('Dice Check', 'The basic mechanic for resolving an action: roll 2d6 + AMod + SMod + CMod and consult the outcome ladder.')}
          {row('Modifiers', 'Each Dice Check can be positively or negatively affected by modifiers tied to attributes, skills, and conditions.')}
        </tbody>
      </RuleTable>
    </>
  )
}
