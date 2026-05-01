import {
  RuleHero,
  RuleSection,
  RuleTable,
  TryIt,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../components/rules/RuleSection'
import { PARADIGMS } from '../../../lib/xse-schema'

export const metadata = { title: 'Appendix D — Paradigms — XSE SRD' }

export default function Page() {
  return (
    <>
      <RuleHero
        eyebrow="Appendix D · Paradigms"
        title="Distemper Paradigms"
        intro={
          <>
            The 12 setting-specific Paradigms for Distemper. Each is a
            ready-built character template with predefined RAPID
            attributes, skills, and starter loadout. Pick one, add a
            name + Motivation + Complication + 3 words, and you're playing.
          </>
        }
      />

      <P>
        For the underlying mechanics, see{' '}
        <a href="/rules/character-creation/paradigms" style={{ color: '#7ab3d4' }}>
          §04 Character Creation → Paradigms & Pregens
        </a>
        .
      </P>

      <TryIt href="/characters/quick">
        Tapestry's Quick Character flow walks through any of these 12
        Paradigms in five minutes. Random Character picks one for you.
      </TryIt>

      {PARADIGMS.map(p => (
        <RuleSection
          key={p.name}
          id={p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
          title={`${p.name} (${p.profession})`}
        >
          <RuleTable>
            <thead>
              <tr>
                {(['RSN', 'ACU', 'PHY', 'INF', 'DEX'] as const).map(a => (
                  <th key={a} style={{ ...ruleTableThStyle, textAlign: 'center', width: 60 }}>{a}</th>
                ))}
                <th style={ruleTableThStyle}>Skills</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {(['RSN', 'ACU', 'PHY', 'INF', 'DEX'] as const).map(a => (
                  <td key={a} style={{ ...ruleTableTdStyle, textAlign: 'center', fontWeight: 700, color: p.rapid[a] >= 2 ? '#7ab3d4' : '#cce0f5' }}>
                    {p.rapid[a] >= 0 ? '+' : ''}{p.rapid[a]}
                  </td>
                ))}
                <td style={ruleTableTdStyle}>
                  {p.skills.map(s => (
                    <span key={s.skillName} style={{ display: 'inline-block', marginRight: 12, color: '#d4cfc9' }}>
                      <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{s.skillName}</span>{' '}
                      <span style={{ color: '#cce0f5', fontWeight: 700 }}>+{s.level}</span>
                    </span>
                  ))}
                </td>
              </tr>
            </tbody>
          </RuleTable>

          {(p.weaponPrimary || p.equipment) && (
            <P>
              <Term>Loadout:</Term>{' '}
              {p.weaponPrimary && <>Primary: {p.weaponPrimary}. </>}
              {p.weaponSecondary && <>Secondary: {p.weaponSecondary}. </>}
              {p.equipment && <>Equipment: {p.equipment.join(', ')}.</>}
            </P>
          )}
        </RuleSection>
      ))}
    </>
  )
}
