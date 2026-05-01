import { RuleHero, RuleSection, TryIt, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Paradigms & Pregens — XSE SRD §04' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('character-creation')!} />
      <RuleHero
        eyebrow="§04 · Character Creation › Paradigms"
        title="Paradigms & Pregens"
        intro={
          <>
            Two faster routes to a playable character. <Term>Paradigms</Term>{' '}
            ship with attributes and skills predefined; the player picks a
            name, Motivation, Complication, 3 Words, weapons, and gear.{' '}
            <Term>Pregenerated Characters</Term> (Pregens) ship fully built
            — read the sheet and play.
          </>
        }
      />

      <RuleSection id="paradigms" title="Paradigms">
        <P>
          Paradigms are intended to facilitate streamlined gameplay by
          providing familiar tropes or roles instead of using the Backstory
          Generation method.
        </P>
        <P>
          Paradigms come with attributes and skills predefined — a player
          only needs to pick a name, Motivation, Complication, 3 Words,
          weapons, and equipment in order to start playing.
        </P>
        <P>
          Paradigms are setting-specific. The 12 Paradigms from Distemper
          are detailed in{' '}
          <a href="/rules/appendix-paradigms" style={{ color: '#7ab3d4' }}>
            Appendix D — Paradigms
          </a>
          .
        </P>
      </RuleSection>

      <RuleSection id="pregens" title="Pregenerated Characters">
        <P>
          Going one step further than a Paradigm, a Pregenerated Character
          comes fully ready to play, with their name, attributes, skills,
          Motivations, Complications, 3 Words, weapons, equipment, and
          backstory defined.
        </P>
        <P>
          Players need only take a moment to read over the character sheet
          before starting to play. Pregens are available for download at{' '}
          xerosumgames.com/Pregens.
        </P>
      </RuleSection>

      <TryIt href="/characters/quick">
        On Tapestry, the Quick Character flow is the Paradigm method.
        Random Character picks a Paradigm for you and rolls Motivation /
        Complication. Both leave room for the personal touches.
      </TryIt>
    </>
  )
}
