import {
  RuleHero,
  RuleTable,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Activity Blocks - XSE SRD §08' }

export default function ActivityBlocksPage() {
  return (
    <>
      <SectionSubNav section={findSection('communities')!} />
      <RuleHero
        eyebrow="§08 · Communities › Activity Blocks"
        title="Activity Blocks"
        intro="Named time tiers the GM uses to advance the clock between scenes."
      />

      <P>
        When the table jumps between scenes, the GM advances time in
        <Term> Activity Blocks </Term> - named tiers that frame what a
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
        not a separate resource that gets spent - they&apos;re a
        shared vocabulary so &quot;Junie spends a Daily Block on
        Stress recovery for Marv&quot; means the same thing at every
        table.
      </P>
    </>
  )
}
