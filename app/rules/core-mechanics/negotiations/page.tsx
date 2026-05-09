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

export const metadata = { title: 'Negotiations — XSE SRD §02' }

const gambitRow = (label: string, effect: string, emphasized = false): React.ReactNode => (
  <tr style={emphasized ? { background: '#150f0e', borderLeft: '2px solid #c0392b' } : undefined}>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 220 }}><Term>{label}</Term></td>
    <td style={ruleTableTdStyle}>{effect}</td>
  </tr>
)

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('core-mechanics')!} />
      <RuleHero
        eyebrow="§02 · Core Mechanics › Negotiations"
        title="Negotiations"
        intro={
          <>
            Two parties haggling, demanding, threatening, persuading.{' '}
            <Term>Negotiations</Term> are an Opposed Check resolved through{' '}
            <Term>Gambit</Term> and <Term>Rebuttal</Term>. Used for
            anything from price haggling to hostage trades.
          </>
        }
      />

      <P>
        Negotiations open when one party (PC or NPC) wants something the
        other has, or wants the other to do something. Both sides should
        Fill In The Gaps as the negotiation unfolds — the mechanic is just
        the spine, the role-play is the meat.
      </P>

      <RuleSection id="gambit" title="The Gambit">
        <P>
          The side leading the Negotiation makes a <Term>Gambit check</Term>{' '}
          to state their position. Roll{' '}
          <Term>2d6 + Influence AMod + an appropriate skill SMod</Term>.
          The skill choice depends on the approach:
        </P>
        <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
          <li><Term>Barter</Term> — haggling, deal-making, "what's it worth to you?"</li>
          <li><Term>Inspiration</Term> — appealing to higher purpose or shared belief</li>
          <li><Term>Manipulation</Term> — playing on emotions, leverage, half-truths</li>
          <li><Term>Psychology*</Term> — reading the target's pressure points</li>
        </ul>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Outcome</th>
              <th style={ruleTableThStyle}>Effect on the Rebuttal</th>
            </tr>
          </thead>
          <tbody>
            {gambitRow('Wild Success (14+)', 'The Gambit truly resonates. Other side gets −3 CMod on their Rebuttal.', true)}
            {gambitRow('Success (9–13)', 'The Gambit lands. Other side gets −1 CMod on their Rebuttal.')}
            {gambitRow('Failure (4–8)', 'Argument falls short. Other side gets +1 CMod on their Rebuttal.')}
            {gambitRow('Dire Failure (0–3)', 'So weak or so offensive that the other side does not respond at all. Negotiation is over — possibly hostile.')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="rebuttal" title="The Rebuttal">
        <P>
          The other party responds with a <Term>Rebuttal check</Term>. Roll{' '}
          <Term>2d6 + Acumen AMod + an appropriate skill SMod</Term>. The
          skill choice can be any of the Gambit options PLUS{' '}
          <Term>Tactics*</Term> (used for picking apart an argument).
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Outcome</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {gambitRow('Wild Success (14+)', 'The Rebuttal is a compelling counteroffer. Other side is very likely to consider their proposal.', true)}
            {gambitRow('Success (9–13)', 'Counter is met favourably. A deal or agreement can be reached.')}
            {gambitRow('Failure (4–8)', 'Cannot present a cogent counterargument. Negotiations are at an impasse — no deal, no harm.')}
            {gambitRow('Dire Failure (0–3)', 'Things go spectacularly wrong. Negotiation is immediately over and the situation could turn hostile.')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="retry" title="Retrying">
        <P>
          If a Negotiation is a Failure, another attempt cannot be made
          until the situation changes. This might be the offered terms
          changing, more information being uncovered, or external events
          shifting the leverage between the parties. A second Negotiation
          on the same terms with the same parties is not a Negotiation —
          it's nagging.
        </P>
      </RuleSection>
    </>
  )
}
