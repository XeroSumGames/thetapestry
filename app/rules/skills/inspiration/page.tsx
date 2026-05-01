import { RuleHero, RuleSection, TryIt, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Inspiration — XSE SRD §05' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('skills')!} />
      <RuleHero
        eyebrow="§05 · Skills › Inspiration"
        title="Inspiration"
        intro={
          <>
            <Term>Inspiration</Term> (INF) — being able to boost the
            morale of individuals or groups, or motivate them behind a
            shared vision or belief.
          </>
        }
      />

      <P>
        Inspiration is a non-vocational skill governed by{' '}
        <Term>Influence (INF)</Term>. Common Dice Checks include rallying
        a faltering group, leading a charge, delivering a sermon, or
        writing copy that moves people to action.
      </P>

      <RuleSection id="crb-bonus" title="Distemper CRB: +1 SMod per level on Recruitment">
        <P>
          For each level in <Term>Inspiration</Term>, a PC gets a +1 SMod
          on any attempt to get NPCs behind an idea, including any NPC
          Recruitment Check. This stacks on top of whatever core skill is
          being used for the recruitment (Barter, Psychology*, Tactics*,
          etc.).
        </P>
      </RuleSection>

      <RuleSection id="lv4-trait" title="Level 4 — Beacon of Hope">
        <P>
          At <Term>Inspiration Level 4 (Life's Work)</Term>, the character
          adds <Term>+4 to any Community Morale Check</Term> they
          participate in. They can also make rousing speeches that
          convince any community they are a part of to risk everything —
          including their own lives — for the good of the larger group.
        </P>
        <P>
          See{' '}
          <a href="/rules/communities/morale" style={{ color: '#7ab3d4' }}>
            §08 Communities → Morale Check
          </a>{' '}
          for the full Morale Check mechanic and modifier slot list.
        </P>
      </RuleSection>

      <TryIt href="/communities">
        Both the +1-per-level Recruitment bonus and the +4 Lv4 Morale
        bonus are auto-applied in Tapestry's Recruitment and Morale
        modals.
      </TryIt>
    </>
  )
}
