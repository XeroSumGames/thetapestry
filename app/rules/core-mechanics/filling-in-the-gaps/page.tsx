import { RuleHero, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Filling In The Gaps — XSE SRD §02' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('core-mechanics')!} />
      <RuleHero
        eyebrow="§02 · Core Mechanics › Fill In The Gaps"
        title="Filling In The Gaps"
        intro="Worldbuilding and stage-setting that the whole table participates in."
      />
      <P>
        <Term>Filling In The Gaps</Term> directly involves the group with
        worldbuilding and stage setting. The Game Master should prompt
        players to provide additional detail, context, or flavour during
        gameplay about what their character is seeing or experiencing.
      </P>
      <P>
        The mechanic is collaborative: a player offers something, the GM
        either confirms it (yes), modifies it (yes-and / yes-but), or
        gracefully sets it aside. The result is a richer scene than either
        party could have built alone.
      </P>
    </>
  )
}
