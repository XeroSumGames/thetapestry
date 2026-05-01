import {
  RuleHero,
  RuleSection,
  RuleTable,
  TryIt,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../../components/rules/RuleSection'
import StyleBanner from '../../../../components/rules/StyleBanner'
import SubNav from '../../../../components/rules/communities/SubNav'

const moodRow = (
  roll: string,
  effect: string,
  mood: string,
  emphasized = false,
): React.ReactNode => (
  <tr style={emphasized ? { background: '#150f0e', borderLeft: '2px solid #c0392b' } : undefined}>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
      <Term>{roll}</Term>
    </td>
    <td style={ruleTableTdStyle}>{effect}</td>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#cce0f5' }}>
      {mood}
    </td>
  </tr>
)

export const metadata = { title: 'Morale Check — XSE SRD §08' }

export default function MoralePage() {
  return (
    <>
      <StyleBanner
        current="B"
        otherHref="/rules/communities#morale"
        otherLabel="Style A"
        description="Style B: Morale lives on its own page. Style A keeps Recruitment / Apprentices / Morale / Structure all on one scrolling page."
      />
      <SubNav />
      <RuleHero
        eyebrow="§08 · Communities › Morale"
        title="Morale Check"
        intro={
          <>
            Each week, a Community must make a Morale Check to maintain the
            cohesion required to stay together. The check is{' '}
            <Term>2d6 + leader's AMod + leader's SMod + six modifier slots</Term>.
            If leadership is co-equal, they make a <Term>Group Check</Term>.
          </>
        }
      />

      <RuleSection id="modifiers" title="Modifier slots">
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Slot</th>
              <th style={ruleTableThStyle}>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={ruleTableTdStyle}><Term>Mood Around The Campfire</Term></td>
              <td style={ruleTableTdStyle}>From the previous Morale Check's outcome. If none: 0.</td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}><Term>Fed</Term></td>
              <td style={ruleTableTdStyle}>From the weekly Fed Check (Gatherers).</td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}><Term>Clothed</Term></td>
              <td style={ruleTableTdStyle}>From the weekly Clothed Check (Maintainers).</td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}><Term>Enough Hands</Term></td>
              <td style={ruleTableTdStyle}>+1 if all role minimums met; else −1 per group short, max −3.</td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}><Term>A Clear Voice</Term></td>
              <td style={ruleTableTdStyle}>0 if a clear leader exists; −1 if leaderless.</td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}><Term>Someone To Watch Over Me</Term></td>
              <td style={ruleTableTdStyle}>−1 if Safety &lt; 5%; +1 if Safety ≥ 10%; otherwise 0.</td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}><Term>Adjusted CMods</Term></td>
              <td style={ruleTableTdStyle}>GM- or player-Filled-In events: raids, miracles, plague, festivals.</td>
            </tr>
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="outcomes" title="Outcomes">
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
              <th style={{ ...ruleTableThStyle, width: 120, textAlign: 'center' }}>Next Mood</th>
            </tr>
          </thead>
          <tbody>
            {moodRow('Moment of High Insight (6+6)', 'Belief in leadership and the community is high.', '+2', true)}
            {moodRow('Wild Success (14+)', 'Morale stays strong or improves.', '+1', true)}
            {moodRow('Success (9–13)', 'Morale remains steady.', '0')}
            {moodRow('Failure (4–8)', 'Morale slipping. 25% of the community will leave unless stopped.', '−1')}
            {moodRow('Dire Failure (0–3)', 'Morale collapses. 50% of the community leaves.', '−2')}
            {moodRow('Moment of Low Insight (1+1)', 'Infighting and violence. 75% of the community leaves.', '−3')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="dissolution" title="Dissolution & Retention">
        <P>
          After <Term>three consecutive failures</Term>, a community has
          degraded to the point of immediately and irreconcilably falling
          apart and dissolving.
        </P>
        <P>
          A fast-acting leader wishing to retain fragments of a dissolving
          community may make an <Term>immediate Morale Check</Term> using the
          result of the preceding Morale Check as the Mood Around The
          Campfire CMod.
        </P>
      </RuleSection>

      <TryIt href="/communities">
        Run a weekly Morale Check on one of your Communities — every CMod is
        computed and shown for review before the roll.
      </TryIt>
    </>
  )
}
