import {
  RuleHero,
  TryIt,
  P,
  Term,
} from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Apprentices — XSE SRD §08' }

export default function ApprenticesPage() {
  return (
    <>
      <SectionSubNav section={findSection('communities')!} />
      <RuleHero
        eyebrow="§08 · Communities › Apprentices"
        title="Apprentices"
        intro={
          <>
            The Apprentice option is unlocked only by a{' '}
            <Term>Moment of High Insight (6+6)</Term> on a Recruitment Check.
            A plain Wild Success (total ≥ 14 without matching faces) does{' '}
            <em>not</em> unlock Apprentice.
          </>
        }
      />

      <P>
        A player may also seek out a specific NPC and make a deliberate
        Recruitment attempt aimed at Apprenticeship — same roll, same
        threshold, still needs the double-six.
      </P>
      <P>
        Apprentices can undertake tasks and activities on behalf of, or act
        as <Term>proxy</Term> for, their PC. Each PC may have only{' '}
        <Term>one Apprentice</Term> at a time.
      </P>

      <P>On recruit, the player:</P>
      <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
        <li>Names the Apprentice (if they don't already have one).</li>
        <li>
          Rolls 2d6 on both the <Term>Motivation</Term> and{' '}
          <Term>Complication</Term> tables (SRD Appendix A).
        </li>
        <li>Works with the GM to Fill In The Gaps on background.</li>
        <li>Spends <Term>3 CDP</Term> on RAPID Range Attributes.</li>
        <li>Spends <Term>5 CDP</Term> on skills.</li>
        <li>
          Picks one setting-appropriate <Term>Paradigm</Term> (SRD Table 8 —
          Paradigms & Vibe Shifts).
        </li>
      </ul>

      <P>
        Over <Term>1 month of game-time</Term>, the PC can train the
        Apprentice in any single skill the PC has, up to{' '}
        <Term>(PC skill level − 1)</Term>. So a PC with Barter 3 can train
        their Apprentice up to Barter 2.
      </P>
      <P>
        If the PC earns Character Development Points later, they may choose to
        spend those CDP on the Apprentice instead of themselves.
      </P>

      <TryIt href="/characters/new">
        Apprentice creation lives inside Character Creation — start a
        character to spend the 3 / 5 CDP and pick a Paradigm.
      </TryIt>
    </>
  )
}
