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
import StyleBanner from '../../../components/rules/StyleBanner'

// /rules/communities — full long-page test of the Blades-style anchored
// reference. Source: tasks/rules-extract-communities.md (canonical, with
// errata applied to the SRD §08 PDF).

const outcomeRow = (
  roll: string,
  effect: string,
  emphasized = false,
): React.ReactNode => (
  <tr
    style={
      emphasized
        ? { background: '#150f0e', borderLeft: '2px solid #c0392b' }
        : undefined
    }
  >
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 220 }}>
      <Term>{roll}</Term>
    </td>
    <td style={ruleTableTdStyle}>{effect}</td>
  </tr>
)

const moodRow = (
  roll: string,
  effect: string,
  mood: string,
  emphasized = false,
): React.ReactNode => (
  <tr
    style={
      emphasized
        ? { background: '#150f0e', borderLeft: '2px solid #c0392b' }
        : undefined
    }
  >
    <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
      <Term>{roll}</Term>
    </td>
    <td style={ruleTableTdStyle}>{effect}</td>
    <td
      style={{
        ...ruleTableTdStyle,
        whiteSpace: 'nowrap',
        textAlign: 'center',
        fontWeight: 700,
        color: '#cce0f5',
      }}
    >
      {mood}
    </td>
  </tr>
)

export const metadata = {
  title: 'Communities — XSE SRD',
  description:
    'XSE SRD §08 — Recruitment, Apprentices, Morale, and Community Structure.',
}

export default function CommunitiesRulesPage() {
  return (
    <>
      <StyleBanner
        current="A"
        otherHref="/rules/communities2"
        otherLabel="Style B"
        description="One long page. Every subsection on this single URL — ⌘-F finds anything, but the page is a long scroll. Style B splits each subsection into its own URL."
      />
      <RuleHero
        eyebrow="§08 · Communities"
        title="Communities"
        intro={
          <>
            When a Group of player characters and recruited NPCs reaches{' '}
            <Term>13 or more members</Term>, it becomes a <Term>Community</Term>{' '}
            — and the survival of that community becomes its own game. This
            section covers how PCs recruit followers, how Communities check
            their morale week-to-week, and how the structure of roles in a
            Community shapes whether it thrives or falls apart.
          </>
        }
      />

      <RuleSection id="overview" title="Group vs Community">
        <P>
          Player characters working together are a <Term>Group</Term>. PCs can
          recruit NPCs to their Group via a <Term>Recruitment Check</Term>.
        </P>
        <P>
          If a Group grows to a combined total of <Term>13 or more</Term> PCs
          and NPCs, it becomes a <Term>Community</Term>. Communities require
          regular <Term>Morale Checks</Term> to ensure they have the cohesion
          to remain together. Morale Checks are usually weekly, but the exact
          cadence is up to the GM and the campaign being played.
        </P>
        <P>Groups do not require Morale Checks.</P>
        <TryIt href="/communities">
          See your Communities — recruit, run weekly Morale, and track member
          rosters.
        </TryIt>
      </RuleSection>

      <RuleSection id="recruitment" title="Recruitment Check">
        <P>
          A Recruitment Check uses a skill that appropriately aligns with the
          approach the PCs are taking — most commonly <Term>Barter</Term>,{' '}
          <Term>Psychology*</Term>, or <Term>Tactics*</Term>. Recruitment
          Checks can be influenced by the <Term>First Impression</Term> a
          player made on the NPC.
        </P>
        <P>
          No matter how NPCs are being recruited, each Community must make a
          Morale Check regularly to ensure it remains cohesive. The choice of
          recruitment approach sets commitment duration and shifts the
          flavour of the result:
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
              <td style={ruleTableTdStyle}>
                <Term>Cohort</Term>
              </td>
              <td style={ruleTableTdStyle}>
                Shared interest or goal with the PC
              </td>
              <td style={ruleTableTdStyle}>
                Joins until next Morale Check, then re-evaluated
              </td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}>
                <Term>Conscript</Term>
              </td>
              <td style={ruleTableTdStyle}>
                Coerced — requires a credible threat
              </td>
              <td style={ruleTableTdStyle}>
                Follows orders while the coercion holds
              </td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}>
                <Term>Convert</Term>
              </td>
              <td style={ruleTableTdStyle}>
                Shared belief, ideology, or vision
              </td>
              <td style={ruleTableTdStyle}>
                Probationary through first Morale Check, then committed
              </td>
            </tr>
          </tbody>
        </RuleTable>

        <RuleSection id="recruitment-cohort" title="Cohort outcomes" level={3}>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Roll</th>
                <th style={ruleTableThStyle}>Effect</th>
              </tr>
            </thead>
            <tbody>
              {outcomeRow(
                'Wild Success (14+)',
                'NPC becomes a Cohort immediately (no probation).',
                true,
              )}
              {outcomeRow(
                'Moment of High Insight (6+6)',
                'Same as Wild Success + may take the NPC as Apprentice.',
                true,
              )}
              {outcomeRow(
                'Success (9–13)',
                'NPC joins until next Morale Check.',
              )}
              {outcomeRow(
                'Failure (4–8)',
                'Does not join. Retry only if circumstances materially change.',
              )}
              {outcomeRow(
                'Dire Failure (0–3)',
                'No interest in joining.',
              )}
              {outcomeRow(
                'Moment of Low Insight (1+1)',
                'NPC is alienated or offended. Possible escalation, including violent rejection.',
              )}
            </tbody>
          </RuleTable>
        </RuleSection>

        <RuleSection
          id="recruitment-conscript"
          title="Conscript outcomes"
          level={3}
        >
          <P>
            Conscripts are forced into service through coercion, threats, or
            leverage. The PCs must present a credible threat for Conscription
            to work.
          </P>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Roll</th>
                <th style={ruleTableThStyle}>Effect</th>
              </tr>
            </thead>
            <tbody>
              {outcomeRow(
                'Wild Success (14+)',
                'Joins willingly — fully committed, loyal follower.',
                true,
              )}
              {outcomeRow(
                'Moment of High Insight (6+6)',
                'Wild Success + Apprentice option.',
                true,
              )}
              {outcomeRow(
                'Success (9–13)',
                'Complies under duress. Will follow orders until next Morale Check.',
              )}
              {outcomeRow(
                'Failure (4–8)',
                'Appears to comply but will attempt to escape at first opportunity.',
              )}
              {outcomeRow(
                'Dire Failure (0–3)',
                'Steadfastly refuses to join.',
              )}
              {outcomeRow(
                'Moment of Low Insight (1+1)',
                'Refuses + hostile or violent response possible.',
              )}
            </tbody>
          </RuleTable>
        </RuleSection>

        <RuleSection id="recruitment-convert" title="Convert outcomes" level={3}>
          <P>
            Converts are recruited through a shared belief or ideology —
            promised answers, direction, or security, ultimately joining
            because they believe in the message or vision presented by the PC.
          </P>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Roll</th>
                <th style={ruleTableThStyle}>Effect</th>
              </tr>
            </thead>
            <tbody>
              {outcomeRow(
                'Wild Success (14+)',
                'Committed believer and follower.',
                true,
              )}
              {outcomeRow(
                'Moment of High Insight (6+6)',
                'Wild Success + Apprentice option.',
                true,
              )}
              {outcomeRow(
                'Success (9–13)',
                'Joins as probationary Convert. Commits after first Morale Check passes.',
              )}
              {outcomeRow(
                'Failure (4–8)',
                'No interest. Retry allowed if PCs Fill In The Gaps on a different approach.',
              )}
              {outcomeRow(
                'Dire Failure (0–3)',
                'Becomes wary and distances themselves from the PC.',
              )}
              {outcomeRow(
                'Moment of Low Insight (1+1)',
                'So unwilling to join they may become hostile or violent.',
              )}
            </tbody>
          </RuleTable>
        </RuleSection>

        <TryIt href="/communities">
          Open one of your Communities to run a Recruitment Check with full
          modifier breakdown.
        </TryIt>
      </RuleSection>

      <RuleSection id="apprentices" title="Apprentices">
        <P>
          The Apprentice option is unlocked only by a{' '}
          <Term>Moment of High Insight (6+6)</Term> on a Recruitment Check. A
          plain Wild Success (total ≥ 14 without matching faces) does{' '}
          <em>not</em> unlock Apprentice. A player may also seek out a specific
          NPC and make a deliberate Recruitment attempt aimed at
          Apprenticeship — same roll, same threshold, still needs the
          double-six.
        </P>
        <P>
          Apprentices can undertake tasks and activities on behalf of, or act
          as <Term>proxy</Term> for, their PC. Each PC may have only{' '}
          <Term>one Apprentice</Term> at a time.
        </P>
        <P>On recruit, the player:</P>
        <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
          <li>Names the Apprentice (if they don't already have one).</li>
          <li>
            Rolls 2d6 on both the <Term>Motivation</Term> and{' '}
            <Term>Complication</Term> tables (SRD Appendix A).
          </li>
          <li>Works with the GM to Fill In The Gaps on background.</li>
          <li>Spends <Term>3 CDP</Term> on RAPID Range Attributes.</li>
          <li>Spends <Term>5 CDP</Term> on skills.</li>
          <li>
            Picks one setting-appropriate <Term>Paradigm</Term> (SRD Table 8 —
            Paradigms & Vibe Shifts).
          </li>
        </ul>
        <P>
          Over <Term>1 month of game-time</Term>, the PC can train the
          Apprentice in any single skill the PC has, up to{' '}
          <Term>(PC skill level − 1)</Term>. So a PC with Barter 3 can train
          their Apprentice up to Barter 2.
        </P>
        <P>
          If the PC earns Character Development Points later, they may choose
          to spend those CDP on the Apprentice instead of themselves.
        </P>
        <TryIt href="/characters/new">
          Apprentice creation lives inside Character Creation — start a
          character to spend the 3/5 CDP and pick a Paradigm.
        </TryIt>
      </RuleSection>

      <RuleSection id="morale" title="Morale Check">
        <P>
          For each week that passes in the game, a Community must make a
          successful Morale Check to ensure they maintain the cohesion
          required to stay together. Morale Checks are made at the beginning
          of the week. The outcome might outline the steps leadership will
          need to take in order to ensure the continued well-being of the
          community.
        </P>
        <P>
          Whether the leader is an NPC or PC, it is assumed there is an
          acknowledged and recognized community leader who will make the
          check using any AMods or SMods that might be appropriate. If there
          are several characters viewed as leaders in equal standing, they
          may make a <Term>Group Check</Term>.
        </P>

        <RuleSection id="morale-modifiers" title="Morale Modifiers" level={3}>
          <P>
            A Morale Check is{' '}
            <Term>2d6 + AMod + SMod + the six modifier slots below</Term>.
            Two of the slots — Fed and Clothed — are themselves derived from
            their own checks made earlier in the week. The other four require
            no dice check but reflect the structure and health of the
            community.
          </P>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Slot</th>
                <th style={ruleTableThStyle}>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={ruleTableTdStyle}>
                  <Term>Mood Around The Campfire</Term>
                </td>
                <td style={ruleTableTdStyle}>
                  Carried in from the previous Morale Check's outcome. If
                  there was no previous check, 0 CMod.
                </td>
              </tr>
              <tr>
                <td style={ruleTableTdStyle}>
                  <Term>Fed</Term>
                </td>
                <td style={ruleTableTdStyle}>
                  From the weekly Fed Check (Gatherers).
                </td>
              </tr>
              <tr>
                <td style={ruleTableTdStyle}>
                  <Term>Clothed</Term>
                </td>
                <td style={ruleTableTdStyle}>
                  From the weekly Clothed Check (Maintainers).
                </td>
              </tr>
              <tr>
                <td style={ruleTableTdStyle}>
                  <Term>Enough Hands</Term>
                </td>
                <td style={ruleTableTdStyle}>
                  +1 if all three role groups meet their minimums; otherwise
                  −1 per group short, max −3.
                </td>
              </tr>
              <tr>
                <td style={ruleTableTdStyle}>
                  <Term>A Clear Voice</Term>
                </td>
                <td style={ruleTableTdStyle}>
                  0 if a clear leader exists; −1 if the community is
                  leaderless.
                </td>
              </tr>
              <tr>
                <td style={ruleTableTdStyle}>
                  <Term>Someone To Watch Over Me</Term>
                </td>
                <td style={ruleTableTdStyle}>
                  −1 if Safety &lt; 5% of community; +1 if Safety ≥ 10%;
                  otherwise 0.
                </td>
              </tr>
              <tr>
                <td style={ruleTableTdStyle}>
                  <Term>Adjusted CMods</Term>
                </td>
                <td style={ruleTableTdStyle}>
                  GM- or player-added CMods for unmodelled events: raids,
                  miracles, plague, festivals.
                </td>
              </tr>
            </tbody>
          </RuleTable>
        </RuleSection>

        <RuleSection id="morale-outcomes" title="Morale Outcomes" level={3}>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Roll</th>
                <th style={ruleTableThStyle}>Effect</th>
                <th
                  style={{
                    ...ruleTableThStyle,
                    width: 120,
                    textAlign: 'center',
                  }}
                >
                  Next Mood
                </th>
              </tr>
            </thead>
            <tbody>
              {moodRow(
                'Moment of High Insight (6+6)',
                'Belief in leadership and the community is high.',
                '+2',
                true,
              )}
              {moodRow(
                'Wild Success (14+)',
                'Morale stays strong or improves.',
                '+1',
                true,
              )}
              {moodRow(
                'Success (9–13)',
                'Morale remains steady.',
                '0',
              )}
              {moodRow(
                'Failure (4–8)',
                'Morale slipping. 25% of the community will leave in the next week unless stopped.',
                '−1',
              )}
              {moodRow(
                'Dire Failure (0–3)',
                'Morale collapses. Major consequences with 50% of the community leaving.',
                '−2',
              )}
              {moodRow(
                'Moment of Low Insight (1+1)',
                'Infighting, rioting, outbreaks of anger or violence. 75% of the community leaves.',
                '−3',
              )}
            </tbody>
          </RuleTable>
        </RuleSection>

        <RuleSection
          id="dissolution"
          title="Dissolution & Retention"
          level={3}
        >
          <P>
            After <Term>three consecutive failures</Term>, a community has
            degraded to the point of immediately and irreconcilably falling
            apart and dissolving. Fast-acting leaders may retain remnants of
            the group or specific members.
          </P>
          <P>
            Any leader wishing to unite or retain fragments of a dissolving
            community will need to make an <Term>immediate Morale Check</Term>{' '}
            as part of this attempt, using the result of the preceding Morale
            Check as the Mood Around The Campfire CMod.
          </P>
        </RuleSection>

        <TryIt href="/communities">
          Run a weekly Morale Check on one of your Communities — every CMod
          is computed and shown for review before the roll.
        </TryIt>
      </RuleSection>

      <RuleSection id="structure" title="Community Structure">
        <P>
          For a community to function, a certain number of members must be
          dedicated to specific tasks.
        </P>
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
              <td style={ruleTableTdStyle}>
                <Term>Gatherers</Term>
              </td>
              <td style={ruleTableTdStyle}>33% (round down)</td>
              <td style={ruleTableTdStyle}>
                Hunt, forage, farm, fish, scavenge — bring in Rations.
              </td>
              <td style={ruleTableTdStyle}>Fed Check</td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}>
                <Term>Maintainers</Term>
              </td>
              <td style={ruleTableTdStyle}>20% (round down)</td>
              <td style={ruleTableTdStyle}>
                Collect Supplies (clothing, tools, batteries) and repair /
                maintain buildings, equipment, and vehicles.
              </td>
              <td style={ruleTableTdStyle}>Clothed Check</td>
            </tr>
            <tr>
              <td style={ruleTableTdStyle}>
                <Term>Safety</Term>
              </td>
              <td style={ruleTableTdStyle}>5–10%</td>
              <td style={ruleTableTdStyle}>
                Policing, patrol, firefighting, emergency services. Community
                leadership is also drawn from here.
              </td>
              <td style={ruleTableTdStyle}>
                No weekly check — drives Morale modifiers only.
              </td>
            </tr>
          </tbody>
        </RuleTable>

        <RuleSection
          id="structure-gatherers"
          title="Gatherers — Fed Check"
          level={3}
        >
          <P>
            This group is responsible for the Fed Check. The possible results
            of a Fed Check feed into the next Morale Check as the{' '}
            <Term>Fed</Term> CMod:
          </P>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Roll</th>
                <th style={ruleTableThStyle}>Effect</th>
                <th
                  style={{
                    ...ruleTableThStyle,
                    width: 120,
                    textAlign: 'center',
                  }}
                >
                  CMod
                </th>
              </tr>
            </thead>
            <tbody>
              {moodRow(
                'Moment of High Insight (6+6)',
                'Enough luxury items are found to give the community a real boost.',
                '+2',
                true,
              )}
              {moodRow(
                'Wild Success (14+)',
                'Rations surplus.',
                '+1',
                true,
              )}
              {moodRow('Success (9–13)', 'Baseline ration needs are met.', '0')}
              {moodRow(
                'Failure (4–8)',
                'Shortfall in Rations leading to only 1 meal a day.',
                '−1',
              )}
              {moodRow(
                'Dire Failure (0–3)',
                'Community members are continuously hungry, sometimes going days between Rations.',
                '−2',
              )}
              {moodRow(
                'Moment of Low Insight (1+1)',
                'An additional complication: food contamination, famine onset.',
                '−3',
              )}
            </tbody>
          </RuleTable>
        </RuleSection>

        <RuleSection
          id="structure-maintainers"
          title="Maintainers — Clothed Check"
          level={3}
        >
          <P>
            This group is responsible for the Clothed Check. Results feed the
            next Morale Check as the <Term>Clothed</Term> CMod:
          </P>
          <RuleTable>
            <thead>
              <tr>
                <th style={ruleTableThStyle}>Roll</th>
                <th style={ruleTableThStyle}>Effect</th>
                <th
                  style={{
                    ...ruleTableThStyle,
                    width: 120,
                    textAlign: 'center',
                  }}
                >
                  CMod
                </th>
              </tr>
            </thead>
            <tbody>
              {moodRow(
                'Moment of High Insight (6+6)',
                'Buildings and equipment are in perfect working order. A project or improvement goes well.',
                '+2',
                true,
              )}
              {moodRow(
                'Wild Success (14+)',
                'Buildings and equipment are adequately repaired, maintained, and even improved.',
                '+1',
                true,
              )}
              {moodRow(
                'Success (9–13)',
                'All systems, buildings, and equipment are adequately maintained.',
                '0',
              )}
              {moodRow(
                'Failure (4–8)',
                'Minor breakdowns, or there is a deficit in required Supplies.',
                '−1',
              )}
              {moodRow(
                'Dire Failure (0–3)',
                'Continued breakdowns of buildings, systems, or equipment that impact the community.',
                '−2',
              )}
              {moodRow(
                'Moment of Low Insight (1+1)',
                'Critical infrastructure damaged or destroyed.',
                '−3',
              )}
            </tbody>
          </RuleTable>
        </RuleSection>

        <RuleSection id="structure-safety" title="Safety" level={3}>
          <P>
            5–10% of any community is required for policing, patrol,
            firefighting, and other emergency services that keep the members
            safe. This group is also made up of community leadership.
          </P>
          <P>
            There is no weekly Safety check, but staffing affects two slots
            of the Morale Check directly:
          </P>
          <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
            <li>
              <Term>Someone To Watch Over Me</Term>: −1 CMod if Safety &lt; 5%
              of community, +1 if ≥ 10%.
            </li>
            <li>
              <Term>Enough Hands</Term>: feeds in alongside Gatherer and
              Maintainer staffing.
            </li>
          </ul>
        </RuleSection>

        <RuleSection
          id="structure-pc-help"
          title="PC contribution"
          level={3}
        >
          <P>
            Unless explicitly stated, the Fed and Clothed Checks are assumed
            to be performed by NPCs of somewhat-proficient skill. Players may
            choose to spend their time contributing to these tasks and use
            their own AMods or SMods if they can <Term>Fill In The Gaps</Term>{' '}
            on how they contributed.
          </P>
        </RuleSection>
      </RuleSection>

      <RuleSection id="crb-additions" title="Distemper CRB additions">
        <P>
          The Distemper Core Rulebook layers a few setting-flavour additions
          on top of the SRD §08 baseline. They live here because they only
          activate when a PC has the relevant skill level.
        </P>
        <RuleSection
          id="crb-inspiration"
          title="Inspiration — +1 SMod per level"
          level={3}
        >
          <P>
            For each level in <Term>Inspiration</Term>, a PC gets a +1 SMod
            on any attempt to get NPCs behind an idea, including any NPC
            Recruitment Check. This stacks on top of the core skill being
            used (Barter, Psychology*, Tactics*, etc.).
          </P>
        </RuleSection>
        <RuleSection
          id="crb-inspiration-lv4"
          title="Inspiration Lv4 — Beacon of Hope"
          level={3}
        >
          <P>
            At <Term>Inspiration Level 4</Term>, the character adds{' '}
            <Term>+4 to any Community Morale Check</Term> they participate
            in. They can also make rousing speeches that convince any
            community they are a part of to risk everything — including
            their own lives — for the good of the larger group.
          </P>
        </RuleSection>
        <RuleSection
          id="crb-psychology-lv4"
          title="Psychology* Lv4 — Insightful Counselor"
          level={3}
        >
          <P>
            At <Term>Psychology* Level 4</Term>, a character who has spent
            time as part of a community is able to understand them and help
            the community leaders see what they need, and may add a{' '}
            <Term>+3 CMod</Term> to the community's weekly Morale Checks.
          </P>
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
        Source: <code>XSE SRD v1.1.17 §08 Communities</code>, with Distemper
        CRB v0.9.2 additions. Implementation notes:{' '}
        <code>tasks/rules-extract-communities.md</code>.
      </p>
    </>
  )
}
