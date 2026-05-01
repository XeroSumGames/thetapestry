import { RuleHero, TryIt, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Insight Dice — XSE SRD §02' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('core-mechanics')!} />
      <RuleHero
        eyebrow="§02 · Core Mechanics › Insight Dice"
        title="Insight Dice"
        intro={
          <>
            <Term>Insight Dice</Term> let players directly affect and
            influence the narrative. Characters get{' '}
            <Term>2 Insight Dice</Term> on creation and gain an additional
            one each time they roll a Moment of Insight (double-1 or
            double-6).
          </>
        }
      />
      <P>Common uses, agreed between GM and players:</P>
      <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
        <li>Roll an extra d6 prior to the Dice Check (3d6 total).</li>
        <li>Add a +3 CMod to the Dice Check before rolling.</li>
        <li>After a Dice Check, drop one or both dice and replace them with an Insight Die rolled fresh.</li>
        <li>Spend Insight Dice for a flashback, retcon, or anything else the player can <Term>Make The Case</Term> for.</li>
        <li>Spend an Insight Die to introduce a story element (e.g. trying the door again and finding it unlocked) — with GM approval and a successful Make The Case.</li>
        <li>Spend ALL available Insight Dice to recover 1 Wound Point + 1 Resilience Point per die and save the character from Death.</li>
      </ul>
      <P>
        Once a player uses an Insight Die, they surrender it back to the
        GM. Insight Dice cannot transfer between characters and cannot
        re-roll a Moment of Low Insight, but they do carry over from
        session to session.
      </P>
      <TryIt href="/dashboard">
        Insight Dice are tracked on every character sheet — open one to see
        the running count.
      </TryIt>
    </>
  )
}
