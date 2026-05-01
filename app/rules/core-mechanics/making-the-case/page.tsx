import { RuleHero, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Making The Case — XSE SRD §02' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('core-mechanics')!} />
      <RuleHero
        eyebrow="§02 · Core Mechanics › Make The Case"
        title="Making The Case"
        intro="A player's pitch to the GM for narrative leverage on a Dice Check."
      />
      <P>
        Similar to <Term>Filling In The Gaps</Term>, a character can{' '}
        <Term>Make The Case</Term> and offer further context on how their
        actions are shaping the outcome of a Dice Check.
      </P>
      <P>
        If the GM agrees that what the player is proposing makes narrative
        sense, they may add a CMod to the Dice Check. The CMod's size is
        proportional to how compelling the case is — a casual observation
        might earn +1, while a fully-realised plan with payoff against
        established setup might earn +3 or more.
      </P>
    </>
  )
}
