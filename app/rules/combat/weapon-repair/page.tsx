import { RuleHero, TryIt, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'Weapon Repair - XSE SRD §06' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('combat')!} />
      <RuleHero
        eyebrow="§06 · Combat › Weapon Repair"
        title="Weapon Repair"
        intro={
          <>
            On a <Term>Moment of Low Insight</Term> with a weapon, the
            weapon malfunctions: it&apos;s flagged as jammed (firearms)
            or broken-state (melee) AND its condition degrades by one
            level. A character can spend a Ready Weapon action to attempt
            a recovery roll. Firearms call it <strong>Unjam</strong>;
            melee weapons call it <strong>Repair</strong>. The mechanic
            is identical - only the narrative verb and skill set differ.
          </>
        }
      />
      <P>
        <strong>Skill pool.</strong> The roller picks the best of three
        candidate skills they have access to:
      </P>
      <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
        <li><strong>Firearms (Unjam):</strong> Tinkerer, Weaponsmith*, or Ranged Combat</li>
        <li><strong>Melee (Repair):</strong> Tinkerer, Weaponsmith*, or Melee Combat</li>
      </ul>
      <P>
        Whichever has the highest level is the skill rolled; the
        roller&apos;s relevant attribute AMod is applied (DEX for the
        first two, the weapon&apos;s combat attribute for the combat skill).
      </P>
      <h3 style={{ fontSize: 20, color: '#f5f2ee', marginTop: '1.4rem', marginBottom: '.6rem' }}>Outcome effects on weapon condition</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0 0 1rem', fontSize: 15, color: '#f5f2ee' }}>
        <thead>
          <tr style={{ background: '#1a1a1a', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', border: '1px solid #3a3a3a' }}>Outcome</th>
            <th style={{ padding: '8px 12px', border: '1px solid #3a3a3a' }}>Effect</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Wild Success (14+)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Condition improved by 1 level. Jam cleared.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>High Insight (6+6)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Condition improved by 2 levels. Jam cleared. Insight Die awarded.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Success (9-13)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>If condition is Worn or worse, improve by 1 level. Jam cleared.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Failure (4-8)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>No change. Jam still in place.</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Dire Failure (0-3)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Weapon breaks (condition jumps to Broken).</td></tr>
          <tr><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Low Insight (1+1)</td><td style={{ padding: '6px 12px', border: '1px solid #3a3a3a' }}>Weapon breaks AND the roller takes 1 WP damage. Insight Die awarded.</td></tr>
        </tbody>
      </table>
      <P>
        Condition ladder (worst to best): Broken → Damaged → Worn →
        Used → Pristine. A Broken weapon can&apos;t be used at all
        until its condition is improved past Damaged. Improvements
        beyond Pristine do nothing.
      </P>
      <TryIt href="/dashboard">
        On the table page, open the Ready Weapon modal (your weapon must
        be jammed or its condition Worn or worse). The button reads{' '}
        <strong>Unjam</strong> for firearms or <strong>Repair</strong>{' '}
        for melee weapons.
      </TryIt>
    </>
  )
}
