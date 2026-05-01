import { RuleHero, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Introduction — XSE SRD §01' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('overview')!} />
      <RuleHero
        eyebrow="§01 · Overview › Introduction"
        title="What XSE Is"
        intro={
          <>
            The Xero Sum Engine (XSE) is a tabletop roleplaying game
            framework designed for <Term>2–6 players</Term>, with robust
            core mechanics that can be applied to most genres or settings,
            while remaining lightweight enough to keep the story at the
            centre of the action.
          </>
        }
      />
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
        This document outlines the{' '}
        <Term>Community Resources & Morale Rules</Term> added with the XSE
        SRD 1.1. A worksheet to make tracking community resources and
        morale easier is available for download at xerosumgames.com.
      </P>
    </>
  )
}
