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

const outcomeRow = (
  roll: string,
  effect: string,
  emphasized = false,
): React.ReactNode => (
  <tr style={emphasized ? { background: '#150f0e', borderLeft: '2px solid #c0392b' } : undefined}>
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 220 }}>
      <Term>{roll}</Term>
    </td>
    <td style={ruleTableTdStyle}>{effect}</td>
  </tr>
)

export const metadata = { title: 'Recruitment Check — XSE SRD §08' }

export default function RecruitmentPage() {
  return (
    <>
      <StyleBanner
        current="B"
        otherHref="/rules/communities#recruitment"
        otherLabel="Style A"
        description="Style B: this subsection is its own page. Style A puts everything on one page with anchor links."
      />
      <SubNav />
      <RuleHero
        eyebrow="§08 · Communities › Recruitment"
        title="Recruitment Check"
        intro={
          <>
            A Recruitment Check uses a skill that aligns with the approach the
            PCs are taking — most commonly <Term>Barter</Term>,{' '}
            <Term>Psychology*</Term>, or <Term>Tactics*</Term>. The First
            Impression a player made on the NPC applies as a CMod.
          </>
        }
      />

      <P>
        The choice of recruitment approach sets commitment duration and shifts
        the flavour of the result:
      </P>
      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Approach</th>
            <th style={ruleTableThStyle}>Basis</th>
            <th style={ruleTableThStyle}>Commitment</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={ruleTableTdStyle}><Term>Cohort</Term></td>
            <td style={ruleTableTdStyle}>Shared interest or goal with the PC</td>
            <td style={ruleTableTdStyle}>Joins until next Morale Check</td>
          </tr>
          <tr>
            <td style={ruleTableTdStyle}><Term>Conscript</Term></td>
            <td style={ruleTableTdStyle}>Coerced — requires a credible threat</td>
            <td style={ruleTableTdStyle}>While the coercion holds</td>
          </tr>
          <tr>
            <td style={ruleTableTdStyle}><Term>Convert</Term></td>
            <td style={ruleTableTdStyle}>Shared belief, ideology, or vision</td>
            <td style={ruleTableTdStyle}>Probationary through first Morale Check</td>
          </tr>
        </tbody>
      </RuleTable>

      <RuleSection id="cohort" title="Cohort outcomes">
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {outcomeRow('Wild Success (14+)', 'NPC becomes a Cohort immediately (no probation).', true)}
            {outcomeRow('Moment of High Insight (6+6)', 'Same as Wild Success + may take the NPC as Apprentice.', true)}
            {outcomeRow('Success (9–13)', 'NPC joins until next Morale Check.')}
            {outcomeRow('Failure (4–8)', 'Does not join. Retry only if circumstances materially change.')}
            {outcomeRow('Dire Failure (0–3)', 'No interest in joining.')}
            {outcomeRow('Moment of Low Insight (1+1)', 'NPC is alienated or offended. Possible escalation, including violent rejection.')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="conscript" title="Conscript outcomes">
        <P>
          Conscripts are forced into service through coercion, threats, or
          leverage. The PCs must present a credible threat for Conscription to
          work.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {outcomeRow('Wild Success (14+)', 'Joins willingly — fully committed, loyal follower.', true)}
            {outcomeRow('Moment of High Insight (6+6)', 'Wild Success + Apprentice option.', true)}
            {outcomeRow('Success (9–13)', 'Complies under duress. Will follow orders until next Morale Check.')}
            {outcomeRow('Failure (4–8)', 'Appears to comply but will attempt to escape at first opportunity.')}
            {outcomeRow('Dire Failure (0–3)', 'Steadfastly refuses to join.')}
            {outcomeRow('Moment of Low Insight (1+1)', 'Refuses + hostile or violent response possible.')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="convert" title="Convert outcomes">
        <P>
          Converts are recruited through a shared belief or ideology — promised
          answers, direction, or security, ultimately joining because they
          believe in the message or vision presented by the PC.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {outcomeRow('Wild Success (14+)', 'Committed believer and follower.', true)}
            {outcomeRow('Moment of High Insight (6+6)', 'Wild Success + Apprentice option.', true)}
            {outcomeRow('Success (9–13)', 'Joins as probationary Convert. Commits after first Morale Check passes.')}
            {outcomeRow('Failure (4–8)', 'No interest. Retry allowed if PCs Fill In The Gaps on a different approach.')}
            {outcomeRow('Dire Failure (0–3)', 'Becomes wary and distances themselves from the PC.')}
            {outcomeRow('Moment of Low Insight (1+1)', 'So unwilling to join they may become hostile or violent.')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <TryIt href="/communities">
        Open one of your Communities to run a Recruitment Check with full
        modifier breakdown.
      </TryIt>
    </>
  )
}
