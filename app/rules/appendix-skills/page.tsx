import {
  RuleHero,
  RuleTable,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../components/rules/RuleSection'
import { SKILLS } from '../../../lib/xse-schema'

export const metadata = { title: 'Appendix B — Skills — XSE SRD' }

export default function Page() {
  return (
    <>
      <RuleHero
        eyebrow="Appendix B · Skills"
        title="Skills (Full Reference)"
        intro={
          <>
            All 29 skills with attribute pairings and one-line
            descriptions. <Term>Vocational skills</Term> (marked{' '}
            <Term>*</Term>) start at <Term>−3 (Inept)</Term>; the first
            level taken jumps the skill to <Term>+1 (Beginner)</Term>.
          </>
        }
      />

      <P>
        For the level scale (Inept / Untrained / Beginner / Journeyman /
        Professional / Life's Work), see{' '}
        <a href="/rules/core-mechanics/modifiers#smod" style={{ color: '#7ab3d4' }}>
          §02 Modifiers → SMod
        </a>
        .
      </P>

      <RuleTable>
        <thead>
          <tr>
            <th style={ruleTableThStyle}>Skill</th>
            <th style={{ ...ruleTableThStyle, width: 80, textAlign: 'center' }}>Attr.</th>
            <th style={{ ...ruleTableThStyle, width: 80, textAlign: 'center' }}>Voc.</th>
            <th style={ruleTableThStyle}>Description</th>
          </tr>
        </thead>
        <tbody>
          {SKILLS.map(s => (
            <tr key={s.name}>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 200, fontWeight: 700, color: '#f5f2ee' }}>
                {s.name}
              </td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: '#7ab3d4' }}>
                {s.attribute}
              </td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', color: s.vocational ? '#cce0f5' : '#5a5550' }}>
                {s.vocational ? '★' : '—'}
              </td>
              <td style={ruleTableTdStyle}>{s.description}</td>
            </tr>
          ))}
        </tbody>
      </RuleTable>
    </>
  )
}
