import { RuleHero, P, Term } from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'

export const metadata = { title: 'In-World Time - XSE SRD §01' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('overview')!} />
      <RuleHero
        eyebrow="§01 · Overview › In-World Time"
        title="In-World Time"
        intro={
          <>
            The Distemper world has a shared canonical calendar anchored
            to the first recorded H724 death. Every campaign has an
            in-world clock that the GM advances; that clock determines
            what year and date the campaign is in, and powers all
            time-driven systems (rations, healing, subsistence damage,
            world events).
          </>
        }
      />
      <P>
        <strong>Anchor.</strong> The first recorded H724 (Dog Flu /
        Distemper) death occurred on <strong>March 2nd, Year 0</strong>.
        This is canon_day 0 - the system&apos;s zero point for all
        calendar math.
      </P>
      <P>
        <strong>Year 0 is the pandemic year itself.</strong> The
        outbreak begins, spreads through Year 0, and by the end of Year
        0 the world is in collapse. <Term>Year 1</Term> is the first
        year after the pandemic. <Term>Year 2</Term> is the second year
        after. And so on.
      </P>
      <P>
        <strong>Pre-pandemic prologue.</strong> January and February of
        Year 0 (~60 days before the first recorded death) are
        playable for campaigns set in the run-up to the outbreak. These
        days have a <strong>negative canon_day</strong>: January 1,
        Year 0 = canon_day -60.
      </P>
      <P>
        <strong>Campaign Day vs canon_day.</strong> Every campaign
        records the canon_day it started on. The Campaign Sheet header
        shows three pieces of time:
      </P>
      <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
        <li><strong>Campaign Day N</strong> - days since the campaign started (Day 1 on the first day).</li>
        <li><strong>Time, date, year</strong> - e.g. &quot;6 PM, September 15th, Year 1&quot;.</li>
        <li><strong>X days after the first recorded death</strong> - the canon_day value, for situating the campaign on the universal timeline.</li>
      </ul>
      <P>
        Module authors can stamp a canonical start date onto their
        module so any campaign cloned from it opens on that in-world
        day automatically.
      </P>
    </>
  )
}
