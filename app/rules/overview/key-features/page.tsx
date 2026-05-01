import { RuleHero, RuleSection, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Key Features — XSE SRD §01' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('overview')!} />
      <RuleHero
        eyebrow="§01 · Overview › Key Features"
        title="Key Features of XSE"
        intro="Three pillars set XSE apart: grounded realism, fast play, and shared direction across the table."
      />

      <RuleSection id="realism" title="Realism">
        <P>
          XSE is a good fit for games with grounded storylines, particularly
          those in the survival, noir, espionage, western, war, low fantasy,
          or hard sci-fi genres. The focus is on{' '}
          <Term>ordinary people in extraordinary situations</Term>: while
          the actions of the characters might be heroic, they are not
          super-heroes, gods, wizards, or chosen ones.
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

      <RuleSection id="fast-play" title="Fast Play">
        <P>
          The Xero Sum Engine utilises a simple d6 game mechanic that can
          intuitively facilitate any challenge or task resolution with
          ease. XSE prioritises realism and momentum over needlessly
          complex rules to keep the narrative at the centre of the game.
        </P>
      </RuleSection>

      <RuleSection id="shared-direction" title="Shared Direction">
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
    </>
  )
}
