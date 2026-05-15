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

export const metadata = { title: 'Community Structure — XSE SRD §08' }

export default function StructurePage() {
  return (
    <>
      <SectionSubNav section={findSection('communities')!} />
      <RuleHero
        eyebrow="§08 · Communities › Structure"
        title="Community Structure"
        intro="For a community to function, a certain number of members must be dedicated to specific tasks."
      />

      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Role</th>
            <th style={ruleTableThStyle}>Minimum</th>
            <th style={ruleTableThStyle}>Responsibility</th>
            <th style={ruleTableThStyle}>Weekly check</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={ruleTableTdStyle}><Term>Gatherers</Term></td>
            <td style={ruleTableTdStyle}>33% (round down)</td>
            <td style={ruleTableTdStyle}>Hunt, forage, farm, fish, scavenge — bring in Rations.</td>
            <td style={ruleTableTdStyle}>Fed Check</td>
          </tr>
          <tr>
            <td style={ruleTableTdStyle}><Term>Maintainers</Term></td>
            <td style={ruleTableTdStyle}>20% (round down)</td>
            <td style={ruleTableTdStyle}>Collect Supplies, repair / maintain buildings, equipment, vehicles.</td>
            <td style={ruleTableTdStyle}>Clothed Check</td>
          </tr>
          <tr>
            <td style={ruleTableTdStyle}><Term>Safety</Term></td>
            <td style={ruleTableTdStyle}>5–10%</td>
            <td style={ruleTableTdStyle}>Policing, patrol, firefighting, emergency services. Leadership comes from here.</td>
            <td style={ruleTableTdStyle}>Drives Morale modifiers only.</td>
          </tr>
        </tbody>
      </RuleTable>

      <RuleSection id="fed" title="Fed Check (Gatherers)">
        <P>
          Results feed the next Morale Check as the <Term>Fed</Term> CMod:
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
              <th style={{ ...ruleTableThStyle, width: 120, textAlign: 'center' }}>CMod</th>
            </tr>
          </thead>
          <tbody>
            {moodRow('Moment of High Insight (6+6)', 'Enough luxury items are found to give the community a real boost.', '+2', true)}
            {moodRow('Wild Success (14+)', 'Rations surplus.', '+1', true)}
            {moodRow('Success (9–13)', 'Baseline ration needs are met.', '0')}
            {moodRow('Failure (4–8)', 'Shortfall in Rations leading to only 1 meal a day.', '−1')}
            {moodRow('Dire Failure (0–3)', 'Continuously hungry, sometimes days between Rations.', '−2')}
            {moodRow('Moment of Low Insight (1+1)', 'Food contamination, famine onset.', '−3')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="clothed" title="Clothed Check (Maintainers)">
        <P>
          Results feed the next Morale Check as the <Term>Clothed</Term> CMod:
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Roll</th>
              <th style={ruleTableThStyle}>Effect</th>
              <th style={{ ...ruleTableThStyle, width: 120, textAlign: 'center' }}>CMod</th>
            </tr>
          </thead>
          <tbody>
            {moodRow('Moment of High Insight (6+6)', 'Buildings and equipment in perfect working order; project goes well.', '+2', true)}
            {moodRow('Wild Success (14+)', 'Buildings and equipment adequately repaired, maintained, even improved.', '+1', true)}
            {moodRow('Success (9–13)', 'All systems, buildings, and equipment adequately maintained.', '0')}
            {moodRow('Failure (4–8)', 'Minor breakdowns, or a deficit in required Supplies.', '−1')}
            {moodRow('Dire Failure (0–3)', 'Continued breakdowns impacting the community.', '−2')}
            {moodRow('Moment of Low Insight (1+1)', 'Critical infrastructure damaged or destroyed.', '−3')}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="safety" title="Safety">
        <P>
          5–10% of any community is required for policing, patrol,
          firefighting, and other emergency services. This group is also where
          community leadership is drawn from.
        </P>
        <P>
          There is no weekly Safety check, but staffing affects Morale slots
          directly: <Term>Someone To Watch Over Me</Term> swings from −1
          (Safety &lt; 5%) to +1 (Safety ≥ 10%), and Safety counts toward
          the <Term>Enough Hands</Term> tally.
        </P>
      </RuleSection>

      <RuleSection id="pc-help" title="PC contribution">
        <P>
          Unless explicitly stated, the Fed and Clothed Checks are assumed to
          be performed by NPCs of somewhat-proficient skill. Players may
          choose to spend their time contributing to these tasks and use their
          own AMods or SMods if they can <Term>Fill In The Gaps</Term> on how
          they contributed.
        </P>
      </RuleSection>

      <RuleSection id="activity-blocks" title="Activity Blocks">
        <P>
          When the table jumps between scenes, the GM advances time in
          <Term> Activity Blocks </Term> — named tiers that frame what a
          character can credibly accomplish without a scene playing out
          on screen. Anything narratively appropriate inside one Block
          can be Filled In The Gaps; anything bigger needs to spend
          multiple Blocks, or its own scene.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Block</th>
              <th style={ruleTableThStyle}>Duration</th>
              <th style={ruleTableThStyle}>Typical scope</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Daily</Term></td>
              <td style={ruleTableTdStyle}>~8 hours of focused effort within a single day.</td>
              <td style={ruleTableTdStyle}>One Psychology* stress-recovery session with another character. A day's labour on a building project. One Medicine* day-tick of treatment. One day's worth of foraging or hunting.</td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Weekly</Term></td>
              <td style={ruleTableTdStyle}>One in-game week (drives Morale / Fed / Clothed checks).</td>
              <td style={ruleTableTdStyle}>A community's weekly Morale Check fires; Gatherers and Maintainers resolve their Fed and Clothed Checks; one increment of training an Apprentice in a skill (one month of training = ~4 Weekly Blocks).</td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Monthly</Term></td>
              <td style={ruleTableTdStyle}>~4 weeks of in-game time.</td>
              <td style={ruleTableTdStyle}>Finishing Apprentice skill training (PC can train Apprentice one level in any single skill the PC has, up to PC level − 1, in one Monthly Block). Major construction milestones; long-distance trade-route runs.</td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}><Term>Seasonal</Term></td>
              <td style={ruleTableTdStyle}>~3 months / a quarter of the year.</td>
              <td style={ruleTableTdStyle}>Long-term community shifts: a hard winter's siege, a growing season's harvest, persistent migration of NPCs, slow-burn faction politics.</td>
            </tr>
          </tbody>
        </RuleTable>
        <P>
          Activity Blocks are the canonical names for time granularity
          when GMs and players talk about off-screen work. They&apos;re
          not a separate resource that gets spent — they&apos;re a
          shared vocabulary so &quot;Junie spends a Daily Block on
          Stress recovery for Marv&quot; means the same thing at every
          table.
        </P>
      </RuleSection>
    </>
  )
}
