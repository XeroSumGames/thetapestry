import {
  RuleHero,
  RuleSection,
  RuleTable,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../components/rules/RuleSection'

// /rules/overview — XSE SRD §01. Source extract:
// docs/Rules/XSE SRD v1.1.17 (Small).pdf §01 Overview, pp. 3.

export const metadata = {
  title: 'Overview — XSE SRD',
  description:
    'What the Xero Sum Engine is, who it\'s for, and the core dice & naming conventions.',
}

export default function OverviewPage() {
  return (
    <>
      <RuleHero
        eyebrow="§01 · Overview"
        title="Xero Sum Engine"
        intro={
          <>
            The Xero Sum Engine (XSE) is a tabletop roleplaying game
            framework designed for <Term>2–6 players</Term>, with robust core
            mechanics that can be applied to most genres or settings, while
            remaining lightweight enough to keep the story at the centre of
            the action.
          </>
        }
      />

      <RuleSection id="introduction" title="Introduction">
        <P>
          One player takes on the role of the <Term>Game Master (GM)</Term>{' '}
          and acts as both referee and storyteller; everyone else is a{' '}
          <Term>Player Character (PC)</Term> within the unfolding story.
        </P>
        <P>
          The rules, skills, and equipment included in this SRD do not cover
          more fantastical elements such as magic or psionics. This SRD will
          be updated as new rules are play-tested and refined.
        </P>
        <P>
          This document outlines the <Term>Community Resources & Morale Rules</Term>{' '}
          added with the XSE SRD 1.1. A worksheet to make tracking community
          resources and morale easier is available for download at
          xerosumgames.com.
        </P>
      </RuleSection>

      <RuleSection id="key-features" title="Key Features of XSE">
        <RuleSection id="realism" title="Realism" level={3}>
          <P>
            XSE is a good fit for games with grounded storylines, particularly
            those in the survival, noir, espionage, western, war, low fantasy,
            or hard sci-fi genres. The focus is on <Term>ordinary people in
            extraordinary situations</Term>: while the actions of the
            characters might be heroic, they are not super-heroes, gods,
            wizards, or chosen ones.
          </P>
          <P>
            Combat in the Xero Sum Engine is brutal, unforgiving, and can
            have lasting consequences for characters. Players should never
            enter combat lightly and should actively seek alternatives.
            Combat is not the only threat — starvation, sickness, dying of
            exposure, and falling from a window can all be lethal.
          </P>
          <P>
            To ensure long-term survival, players will need to focus on
            problem solving, diplomacy, and the use of social skills.
          </P>
        </RuleSection>

        <RuleSection id="fast-play" title="Fast Play" level={3}>
          <P>
            The Xero Sum Engine utilises a simple d6 game mechanic that can
            intuitively facilitate any challenge or task resolution with
            ease. XSE prioritises realism and momentum over needlessly
            complex rules to keep the narrative at the centre of the game.
          </P>
        </RuleSection>

        <RuleSection id="shared-direction" title="Shared Direction" level={3}>
          <P>
            Collaborative storytelling fuels the Xero Sum Engine, and it
            provides players with various tools to drive the narrative.
            These tools include <Term>Insight Dice</Term>,{' '}
            <Term>Filling In The Gaps</Term>, <Term>Making The Case</Term>,{' '}
            <Term>First Impressions</Term>, and <Term>Gut Instincts</Term>{' '}
            — as well as rules for <Term>Recruitment</Term> and{' '}
            <Term>Communities</Term>.
          </P>
        </RuleSection>
      </RuleSection>

      <RuleSection id="naming-conventions" title="Dice & Naming Conventions">
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Term</th>
              <th style={ruleTableThStyle}>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>2d6</Term>
              </td>
              <td style={ruleTableTdStyle}>
                Most checks in the XSE SRD use 2 six-sided dice, adding the
                scores together to get a final tally.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>xd6</Term>
              </td>
              <td style={ruleTableTdStyle}>
                When multiple dice are required for a dice check, it is
                written in the format <code>xd6</code> — for example{' '}
                <code>3d6</code> or <code>4d6</code>. The final score is the
                sum of all dice.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>1d3</Term>
              </td>
              <td style={ruleTableTdStyle}>
                Rolling a six-sided dice and halving the result (rounding up)
                for a result of 1–3.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>Game Master (GM)</Term>
              </td>
              <td style={ruleTableTdStyle}>
                The player who takes on the role of facilitator,
                storyteller, and referee. The GM defines the environment,
                populates the world, and propels the story forward.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>PC</Term>
              </td>
              <td style={ruleTableTdStyle}>
                A player character (also called a character) is the
                personification of the player in the story.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>NPC</Term>
              </td>
              <td style={ruleTableTdStyle}>
                Non-player characters — other characters the players
                interact with, brought to life by the GM.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>Dice Check</Term>
              </td>
              <td style={ruleTableTdStyle}>
                Also called Dice Rolls. The basic mechanic for resolving
                whether a character's action is successful: roll 2d6 and sum
                the dice.
              </td>
            </tr>
            <tr>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>
                <Term>Modifiers</Term>
              </td>
              <td style={ruleTableTdStyle}>
                Each Dice Check can be positively or negatively affected by
                modifiers tied to attributes, skills, and conditions.
              </td>
            </tr>
          </tbody>
        </RuleTable>
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
        Source: <code>XSE SRD v1.1.17 §01 Overview</code>.
      </p>
    </>
  )
}
