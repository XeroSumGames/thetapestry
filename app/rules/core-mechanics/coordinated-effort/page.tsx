import { RuleHero, TryIt, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Coordinated Effort — XSE SRD §02' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('core-mechanics')!} />
      <RuleHero
        eyebrow="§02 · Core Mechanics › Coordinated Effort"
        title="Coordinated Effort"
        intro={
          <>
            A <Term>Coordinated Effort</Term> is a chain of skill checks
            where multiple PCs work together on a sequence of actions
            toward a shared goal. There is no fixed &quot;leader&quot; or
            &quot;final&quot; role — the <strong>first roll</strong> in
            the chain sets the tone, and its outcome propagates as a CMod
            that benefits or burdens every subsequent roll. Each
            participant rolls whatever skill suits the action they&apos;re
            personally doing.
          </>
        }
      />
      <P>
        <strong>Initiation.</strong> Any player declares a Coordinated
        Effort, picks the participants, and picks the skill they
        themselves will roll first. That skill can be anything that fits
        the opening action — Tactics* for a plan, Manipulation for a
        distraction, Mechanic* for disabling alarms, Perception for
        reconnaissance, and so on.
      </P>
      <P>
        <strong>First / lead roll.</strong> The initiator rolls with a
        bonus of <strong>+1 CMod per other participant</strong> (3 total
        participants → +2; 4 total → +3). The outcome of this roll
        becomes the <Term>lead CMod</Term> propagated to every
        subsequent roll in the chain.
      </P>
      <P>
        <strong>Subsequent rolls.</strong> Each participant rolls the
        skill that suits their part of the plan. One participant can
        roll multiple times in the same chain. Every roll gets{' '}
        <strong>+1 CMod per other participant</strong> plus the{' '}
        <strong>lead CMod</strong>. Subsequent outcomes do{' '}
        <strong>not</strong> propagate further — only the first roll&apos;s
        outcome carries through the whole chain.
      </P>
      <h3 style={{ fontSize: 20, color: '#f5f2ee', marginTop: '1.4rem', marginBottom: '.6rem' }}>Lead-roll outcome → chain CMod</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0 0 1rem', fontSize: 15, color: '#d4cfc9' }}>
        <thead>
          <tr style={{ background: '#1a1a1a', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', border: '1px solid #3a3a3a' }}>First-roll outcome</th>
            <th style={{ padding: '8px 12px', border: '1px solid #3a3a3a' }}>Lead CMod</th>
            <th style={{ padding: '8px 12px', border: '1px solid #3a3a3a' }}>Effect on chain</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Moment of High Insight (6+6)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>+3</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Chain at +3; first roller gets a personal Insight Die.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Wild Success (14+)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>+2</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>All subsequent rolls +2.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Success (9-13)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>+1</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>All subsequent rolls +1.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Failure (4-8)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>-1</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Chain continues at -1.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Dire Failure (0-3)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>-3</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Chain continues at -3, heavily penalized.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Moment of Low Insight (1+1)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>—</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Chain collapses immediately. First roller still earns an Insight Die per canon HI/LI rules.</td></tr>
        </tbody>
      </table>
      <P>
        The asymmetry between the success and failure sides is
        intentional — bad lead rolls cascade hard, and the worst single
        roll outcome (Low Insight) ends the effort outright.
      </P>
      <P>
        <strong>Chain end.</strong> Goal achieved, any participant opts
        out, narrative impossibility, or LI on the lead roll.
      </P>
      <P>
        <strong>Insight Dice during a Coordinated Effort.</strong> Any
        participant can spend an Insight Die on their own roll (3d6 keep
        all 3, or +3 CMod) — same as any normal skill check. Any
        participant who personally rolls HI or LI on their own roll earns
        a +1 Insight Die personally, independent of the overall outcome.
      </P>
      <P>
        <strong>In combat.</strong> Each roll consumes 1 combat action
        from the roller, including the lead roll. The chain resolves on
        the initiator&apos;s turn — initiative pauses until the chain
        ends or someone opts out. Out of combat, rolls are free.
      </P>
      <TryIt href="/dashboard">
        On the table page, open the <strong>Checks</strong> menu in the
        header bar and pick <strong>Coordinated Effort</strong> to start
        a chain.
      </TryIt>
    </>
  )
}
