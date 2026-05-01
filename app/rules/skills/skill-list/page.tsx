import {
  RuleHero,
  RuleTable,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'
import { SKILLS } from '../../../../lib/xse-schema'

export const metadata = { title: 'Skill List — XSE SRD §05' }

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('skills')!} />
      <RuleHero
        eyebrow="§05 · Skills › Skill List"
        title="Skill List"
        intro={
          <>
            All 29 skills, paired with their governing RAPID attribute.
            Vocational skills are marked with <Term>*</Term> — they start
            at <Term>−3 (Inept)</Term> instead of 0 (Untrained) and the
            first level taken jumps the skill straight to{' '}
            <Term>+1 (Beginner)</Term>.
          </>
        }
      />

      <P>
        Skill levels are <Term>SMods</Term> added to any Dice Check using
        that skill. Most checks use <Term>AMod + SMod</Term> together
        (e.g. PHY + Unarmed Combat for a punch).
      </P>

      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Skill</th>
            <th style={{ ...ruleTableThStyle, width: 80 }}>Attribute</th>
            <th style={ruleTableThStyle}>Description</th>
          </tr>
        </thead>
        <tbody>
          {SKILLS.map(s => (
            <tr key={s.name}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 200, fontWeight: 700, color: s.vocational ? '#cce0f5' : '#f5f2ee' }}>
                {s.name}
              </td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#7ab3d4' }}>
                {s.attribute}
              </td>
              <td style={ruleTableTdStyle}>{s.description}</td>
            </tr>
          ))}
        </tbody>
      </RuleTable>

      <P>
        For the level scale (Inept / Untrained / Beginner / Journeyman /
        Professional / Life's Work), see{' '}
        <a href="/rules/core-mechanics/modifiers#smod" style={{ color: '#7ab3d4' }}>
          Modifiers → SMod
        </a>
        . Two skills get featured pages because the Distemper CRB layers
        Level 4 traits on top of the SRD baseline:{' '}
        <a href="/rules/skills/inspiration" style={{ color: '#7ab3d4' }}>Inspiration</a>{' '}
        and{' '}
        <a href="/rules/skills/psychology" style={{ color: '#7ab3d4' }}>Psychology*</a>.
      </P>
    </>
  )
}
