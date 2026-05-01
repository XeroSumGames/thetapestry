import { RuleHero, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Skills (Overview) — XSE SRD §03' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('character-overview')!} />
      <RuleHero
        eyebrow="§03 · Character Overview › Skills"
        title="Skills"
        intro={
          <>
            Characters have a variety of skills based on their life
            experiences. Most skills range from{' '}
            <Term>0 (Untrained)</Term> to <Term>+4 (Life's Work)</Term>;
            several skills are <Term>vocational</Term> and start at{' '}
            <Term>−3 (Inept)</Term>.
          </>
        }
      />
      <P>
        The skill level is a <Term>Skill Modifier (SMod)</Term> added to
        any Dice Check using that skill. Each skill is associated with an
        attribute (e.g. Barter is tied to Influence; Unarmed Combat to
        Physicality). Dice Checks usually combine both AMod and SMod.
      </P>
      <P>
        Vocational skills are marked with an asterisk (e.g.{' '}
        <Term>Psychology*</Term>). They start at −3 (Inept) instead of 0.
        When a character earns 1 level in a vocational skill, they advance
        from −3 (Inept) directly to +1 (Beginner) — the asterisk
        represents that one-time jump for a non-trivially-trained skill.
      </P>
      <P>
        For the full skill list with attribute pairings and level
        descriptions, see{' '}
        <a href="/rules/skills" style={{ color: '#7ab3d4' }}>§05 Skills</a>{' '}
        (gameplay context) or{' '}
        <a href="/rules/appendix-skills" style={{ color: '#7ab3d4' }}>Appendix B</a>{' '}
        (full reference).
      </P>
    </>
  )
}
