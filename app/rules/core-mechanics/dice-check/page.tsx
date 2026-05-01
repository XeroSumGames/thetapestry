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

export const metadata = { title: 'Dice Check Outcomes — XSE SRD §02' }

const row = (range: string, label: string, desc: string, emphasized = false): React.ReactNode => (
  <tr style={emphasized ? { background: '#150f0e', borderLeft: '2px solid #c0392b' } : undefined}>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 90, fontWeight: 700 }}>{range}</td>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 220 }}><Term>{label}</Term></td>
    <td style={ruleTableTdStyle}>{desc}</td>
  </tr>
)

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('core-mechanics')!} />
      <RuleHero
        eyebrow="§02 · Core Mechanics › Dice Check"
        title="Dice Check Outcomes"
        intro={
          <>
            If a character does something that will affect the storyline,
            they make a <Term>Dice Check</Term>:{' '}
            <Term>2d6 + AMod + SMod + CMod</Term>. Although a total of 9 or
            above is a Success, there are gradations of success and failure.
          </>
        }
      />

      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Total</th>
            <th style={ruleTableThStyle}>Outcome</th>
            <th style={ruleTableThStyle}>Effect</th>
          </tr>
        </thead>
        <tbody>
          {row('14+', 'Wild Success', "The action succeeds — and there is an additional positive result that benefits the character. The safe opens AND there's something unexpected of value inside.", true)}
          {row('6+6', 'Moment of High Insight', 'A double-six. Counts as a Wild Success AND grants an Insight Die.', true)}
          {row('9–13', 'Success', 'The action or task succeeds.')}
          {row('4–8', 'Failure', 'The action or task fails.')}
          {row('0–3', 'Dire Failure', 'Not only unsuccessful — there is an additional setback or consequence. A failed safe-cracking attempt irreparably jams the lock.')}
          {row('1+1', 'Moment of Low Insight', 'A double-one. Counts as a Dire Failure AND grants an Insight Die.')}
        </tbody>
      </RuleTable>

      <RuleSection id="moments-of-insight" title="Moments of Insight">
        <P>
          When characters perform exceptionally well or disastrously badly,
          they have a <Term>Moment of Insight</Term> and gain a deeper
          understanding of exactly why they succeeded or failed. Insight
          Dice cannot be used to re-roll dice in a Moment of Low Insight.
        </P>
      </RuleSection>
    </>
  )
}
