import { RuleHero, RuleSection, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Attribute, Group & Opposed Checks — XSE SRD §02' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('core-mechanics')!} />
      <RuleHero
        eyebrow="§02 · Core Mechanics › Check Types"
        title="Attribute, Group, and Opposed Checks"
        intro="Beyond the standard Dice Check, XSE has shorthand for raw-attribute, multi-character, and head-to-head rolls."
      />

      <RuleSection id="attribute-check" title="Attribute Check">
        <P>
          Players can use a character's RAPID Range attributes for checks
          that do not require a specific skill — e.g. Reason for a riddle
          or Physicality for a feat of strength. Only the relevant{' '}
          <Term>AMod</Term> applies.
        </P>
      </RuleSection>

      <RuleSection id="group-check" title="Group Check">
        <P>
          Multiple players attempting the same task can work together to
          increase their chances of success. To take part in a Group Check,
          everyone must be using the same attribute or skill (even if they
          have 0). The player with the highest relevant AMod or SMod makes
          the check and applies any AMods or SMods from the other characters
          taking part.
        </P>
        <P>
          Insight Dice cannot be spent as part of a Group Check, but if the
          outcome is a Moment of Insight, all participants receive an
          Insight Die. Group Checks are at GM discretion and must make
          logical sense within the narrative.
        </P>
      </RuleSection>

      <RuleSection id="opposed-check" title="Opposed Check">
        <P>
          Characters competing directly against one another make Opposed
          Checks — both attempting to gain the upper hand until there is a
          clear winner and loser (e.g. an arm-wrestling contest).
        </P>
        <P>
          The outcome of an Opposed Check is determined by the first side
          to roll a Success, Wild Success, or Moment of High Insight while
          the other side simultaneously rolls a Failure, Dire Failure, or
          Moment of Low Insight. If both sides roll the same outcome, the
          result is negated and play continues until a clear winner emerges
          or one side changes their strategy.
        </P>
      </RuleSection>

      <RuleSection id="perception-check" title="Perception Check">
        <P>
          If a player wants to know whether their character has picked up
          on unspoken cues or subtle details, they may make a{' '}
          <Term>Perception Check</Term> using the secondary stat{' '}
          <Term>Perception</Term> as a modifier. The GM helps Fill In The
          Gaps with whatever is noticed.
        </P>
      </RuleSection>
    </>
  )
}
