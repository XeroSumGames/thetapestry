import { RuleHero, TryIt, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Character Evolution — XSE SRD §04' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('character-creation')!} />
      <RuleHero
        eyebrow="§04 · Character Creation › Evolution"
        title="Character Evolution"
        intro={
          <>
            How characters grow between sessions: <Term>Character
            Development Points (CDP)</Term> earned at the GM's discretion
            and spent on attributes or skills using the same cost ladder
            as Backstory Generation.
          </>
        }
      />

      <P>
        At the end of each game session, the Game Master has the
        discretion to award <Term>2+ CDP</Term> that the players can spend
        on improving their characters' attributes or skills.
      </P>

      <P>
        CDP can be saved across sessions, but the spending costs are the
        same as during Backstory Generation:
      </P>

      <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
        <li>
          <Term>Learn a new skill</Term>: 1 CDP (from Inept or Untrained
          to Beginner).
        </li>
        <li>
          <Term>Raise a skill</Term>: current + target level CDP. So{' '}
          <Term>+1 → +2 = 3 CDP</Term>, <Term>+2 → +3 = 5 CDP</Term>,{' '}
          <Term>+3 → +4 = 7 CDP</Term>.
        </li>
        <li>
          <Term>Raise an attribute</Term>: 3× the level being raised. So{' '}
          <Term>+1 → +2 = 6 CDP</Term>, <Term>+2 → +3 = 9 CDP</Term>,{' '}
          <Term>+3 → +4 = 12 CDP</Term>.
        </li>
      </ul>

      <P>
        Apprentices can also be progressed with their master PC's CDP if
        the player chooses to spend that way (see{' '}
        <a href="/rules/communities/apprentices" style={{ color: '#7ab3d4' }}>
          §08 → Apprentices
        </a>
        ).
      </P>

      <TryIt href="/dashboard">
        Tapestry tracks per-character CDP balance and validates each spend
        against the cost ladder.
      </TryIt>
    </>
  )
}
