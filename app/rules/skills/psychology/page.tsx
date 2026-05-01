import { RuleHero, RuleSection, TryIt, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Psychology* — XSE SRD §05' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('skills')!} />
      <RuleHero
        eyebrow="§05 · Skills › Psychology*"
        title="Psychology*"
        intro={
          <>
            <Term>Psychology*</Term> (RSN, vocational) — leveraging an
            understanding of human behaviour to influence, predict,
            exploit, or manipulate outcomes.
          </>
        }
      />

      <P>
        Psychology* is a vocational skill governed by{' '}
        <Term>Reason (RSN)</Term>. It starts at <Term>−3 (Inept)</Term>{' '}
        for any character who hasn't paid for it, and the first level
        taken jumps it directly to <Term>+1 (Beginner)</Term>. Common Dice
        Checks include reading a suspect, calming a panic, defusing
        domestic conflict, or recognising a pattern of abuse.
      </P>

      <RuleSection id="lv4-trait" title="Level 4 — Insightful Counselor">
        <P>
          At <Term>Psychology* Level 4 (Life's Work)</Term>, a character
          who has spent time as part of a community is able to understand
          them and help the community leaders see what they need, and may
          add a <Term>+3 CMod</Term> to the community's weekly Morale
          Check.
        </P>
        <P>
          The bonus is gated on tenure with the community — the character
          must actually be a member long enough to know its rhythms. See{' '}
          <a href="/rules/communities/morale" style={{ color: '#7ab3d4' }}>
            §08 Communities → Morale Check
          </a>{' '}
          for the full Morale modifier slot list.
        </P>
      </RuleSection>

      <TryIt href="/communities">
        The +3 Insightful Counselor CMod is auto-applied to Morale Checks
        when a Lv4 Psychology* PC is a community member.
      </TryIt>
    </>
  )
}
