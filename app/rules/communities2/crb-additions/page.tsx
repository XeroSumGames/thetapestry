import {
  RuleHero,
  RuleSection,
  P,
  Term,
} from '../../../../components/rules/RuleSection'
import StyleBanner from '../../../../components/rules/StyleBanner'
import SubNav from '../../../../components/rules/communities/SubNav'

export const metadata = { title: 'CRB Additions — XSE SRD §08' }

export default function CRBAdditionsPage() {
  return (
    <>
      <StyleBanner
        current="B"
        otherHref="/rules/communities#crb-additions"
        otherLabel="Style A"
        description="Style B: setting-flavour additions on their own page. Style A appends them to the end of the long Communities page."
      />
      <SubNav />
      <RuleHero
        eyebrow="§08 · Communities › CRB Additions"
        title="Distemper CRB additions"
        intro="The Distemper Core Rulebook layers a few setting-flavour additions on top of the SRD §08 baseline. They activate when a PC has the relevant skill level."
      />

      <RuleSection id="inspiration" title="Inspiration — +1 SMod per level">
        <P>
          For each level in <Term>Inspiration</Term>, a PC gets a +1 SMod on
          any attempt to get NPCs behind an idea, including any NPC
          Recruitment Check. This stacks on top of the core skill being used
          (Barter, Psychology*, Tactics*, etc.).
        </P>
      </RuleSection>

      <RuleSection id="inspiration-lv4" title="Inspiration Lv4 — Beacon of Hope">
        <P>
          At <Term>Inspiration Level 4</Term>, the character adds{' '}
          <Term>+4 to any Community Morale Check</Term> they participate in.
          They can also make rousing speeches that convince any community they
          are a part of to risk everything — including their own lives — for
          the good of the larger group.
        </P>
      </RuleSection>

      <RuleSection id="psychology-lv4" title="Psychology* Lv4 — Insightful Counselor">
        <P>
          At <Term>Psychology* Level 4</Term>, a character who has spent time
          as part of a community is able to understand them and help the
          community leaders see what they need, and may add a{' '}
          <Term>+3 CMod</Term> to the community's weekly Morale Checks.
        </P>
      </RuleSection>
    </>
  )
}
