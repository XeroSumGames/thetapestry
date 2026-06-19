import { RuleHero, TryIt, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Healing - XSE SRD §06' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('combat')!} />
      <RuleHero
        eyebrow="§06 · Combat › Healing"
        title="Healing"
        intro={
          <>
            A successful <Term>Medicine*</Term> check on a target queues
            a pending heal that applies over the next 24 hours of in-world
            time: 50% at the +12 hour mark and 50% at the +24 hour mark.
            The healer can roll naked or use a First Aid Kit (Common,
            +1 CMod) or a Doctor&apos;s Bag (Uncommon, +2 CMod). The
            healer and target must be at Engaged range (matches Stabilise).
          </>
        }
      />
      <h3 style={{ fontSize: 20, color: '#f5f2ee', marginTop: '1.4rem', marginBottom: '.6rem' }}>WP healed by outcome and equipment</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0 0 1rem', fontSize: 15, color: '#f5f2ee' }}>
        <thead>
          <tr style={{ background: '#1a1a1a', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', border: '1px solid #3a3a3a' }}>Outcome</th>
            <th style={{ padding: '8px 12px', border: '1px solid #3a3a3a' }}>Naked Medicine* check</th>
            <th style={{ padding: '8px 12px', border: '1px solid #3a3a3a' }}>First Aid Kit</th>
            <th style={{ padding: '8px 12px', border: '1px solid #3a3a3a' }}>Doctor&apos;s Bag</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Wild Success</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Medicine* level + 1</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>1+1d3 + 1</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>1+2d3 + 1</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>High Insight (6+6)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Medicine* level + 2</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>1+1d3 + 2</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>1+2d3 + 2</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Success</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Medicine* level</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>1+1d3</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>1+2d3</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Failure</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }} colSpan={3}>0 WP. No effect.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Dire Failure</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }} colSpan={3}>Target loses 1 WP immediately (botched care).</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Low Insight (1+1)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }} colSpan={3}>Target makes a Wound Infection check (canon §06 → Infection).</td></tr>
        </tbody>
      </table>
      <P>
        High Insight and Low Insight also award the healer a +1 Insight
        Die personally per the standard canon HI/LI rules.
      </P>
      <P>
        <strong>Banking.</strong> When the heal queues, the total WP is
        split 50/50 across two checkpoints - the first at +12 hours of
        in-world time, the second at +24 hours. Odd totals split with
        the larger half at +24h (a heal of 5 → +2 WP at +12h, +3 WP at
        +24h). Any GM-driven time advance that crosses a checkpoint
        applies that chunk to the target&apos;s record.
      </P>
      <P>
        <strong>Target queue.</strong> The pending heal lives on the
        target, not the healer. If the healer dies, leaves the map, or
        is otherwise unavailable when the +12h or +24h checkpoint hits,
        the target still gets the queued WP.
      </P>
      <P>
        <strong>Stacking.</strong> Multiple successful heals on the same
        target stack - each pending heal is its own queue entry with its
        own +12h / +24h schedule from its check time. Heals queued at
        different in-world hours apply at different actual tick moments.
      </P>
      <P>
        <strong>Dire Failure interrupt.</strong> The -1 WP from a Dire
        Failure applies immediately, not over 24h. If the target drops
        to 0 WP from this, the standard Mortally Wounded flow fires.
      </P>
      <TryIt href="/dashboard">
        On the table page, open the <strong>Checks</strong> menu and
        pick <strong>Heal</strong> to fire the modal.
      </TryIt>
    </>
  )
}
