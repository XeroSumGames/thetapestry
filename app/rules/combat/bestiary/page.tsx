import {
  RuleHero,
  RuleSection,
  RuleTable,
  P,
  Term,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../../components/rules/RuleSection'
import SectionSubNav from '../../../../components/rules/SectionSubNav'
import { findSection } from '../../../../lib/rules/sections'
import { ANIMALS } from '../../../../lib/animals'

export const metadata = { title: 'Bestiary — XSE §06' }

export default function Page() {
  const baseAnimals = ANIMALS.filter(a => !a.distemperInfected)
  const distemperAnimals = ANIMALS.filter(a => a.distemperInfected)

  return (
    <>
      <SectionSubNav section={findSection('combat')!} />
      <RuleHero
        eyebrow="§06 · Combat › Bestiary"
        title="Animals & Distemper-Infected Canines"
        intro={
          <>
            Wildlife players are likely to encounter — six base
            species plus two H724-infected canine variants. Stats
            from CRB v0.9.2 p.194-195. Use these as drop-in
            templates when the GM needs a feral threat.
          </>
        }
      />

      <RuleSection id="base" title="Base animals">
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Animal</th>
              <th style={{ ...ruleTableThStyle, width: 80, textAlign: 'center' }}>RAPID</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>WP</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>RP</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>MDM</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>RDM</th>
              <th style={{ ...ruleTableThStyle, width: 60, textAlign: 'center' }}>Init</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>Enc</th>
              <th style={ruleTableThStyle}>Skills</th>
            </tr>
          </thead>
          <tbody>
            {baseAnimals.map(a => (
              <tr key={a.name}>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{a.name}</td>
                <td style={{ ...ruleTableTdStyle, textAlign: 'center', fontFamily: 'monospace', color: '#cce0f5' }}>{a.rapidCode}</td>
                <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.wp_max}</td>
                <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.rp_max}</td>
                <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.mdm}</td>
                <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.rdm}</td>
                <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>+{a.init}</td>
                <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.enc}</td>
                <td style={ruleTableTdStyle}>
                  {a.skills.map((s, i) => (
                    <span key={s.name}>
                      {i > 0 && ', '}
                      {s.name} {s.level}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </RuleTable>
        <P>
          RAPID is encoded as a five-digit string for the five
          attributes in order: <Term>RSN ACU PHY INF DEX</Term>. So
          a Bear at <Term>01711</Term> has RSN 0, ACU 1, PHY 7, INF
          1, DEX 1.
        </P>
      </RuleSection>

      <RuleSection id="distemper" title="Animals with the Distemper virus">
        <P>
          All species of canines can still be infected with and
          carry <Term>H724</Term>, even if they appear asymptomatic.
          The virus has mutated again — it invariably erodes their
          brains and creates heightened aggression, but it's no
          longer terminal in all infected animals.
        </P>
        <P>
          Smaller, weaker, domesticated dogs rarely survived their
          infection, leaving only the larger, stronger breeds —
          found in hostile, dangerous, roving packs that are
          largely nocturnal. Wolves, coyotes, jackals, and even
          some foxes may present one of the biggest threats players
          will face out in the open. A pack of <Term>1d6 canines</Term>{' '}
          can appear with little warning, swarming and harrying
          their victims.
        </P>
        <P>
          Infected dogs and wolves keep their RAPID + secondary
          stats. They pick up extra skill levels in{' '}
          <Term>Athletics</Term>, <Term>Survival</Term>, and{' '}
          <Term>Unarmed Combat</Term> reflecting their heightened
          aggression.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Animal</th>
              <th style={{ ...ruleTableThStyle, width: 80, textAlign: 'center' }}>RAPID</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>WP</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>RP</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>MDM</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>RDM</th>
              <th style={{ ...ruleTableThStyle, width: 60, textAlign: 'center' }}>Init</th>
              <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>Enc</th>
              <th style={ruleTableThStyle}>Skills</th>
            </tr>
          </thead>
          <tbody>
            {distemperAnimals.map(a => {
              // Surface the +N delta from each infected canine to its base
              // species - makes the infection's mechanical bump visible at
              // a glance instead of forcing the reader to cross-reference
              // the two tables. baseAnimal links the variant to its source.
              const base = a.baseAnimal ? baseAnimals.find(b => b.name === a.baseAnimal) : undefined
              const skillDelta = (skillName: string, infectedLevel: number) => {
                if (!base) return null
                const baseSkill = base.skills.find(s => s.name === skillName)
                const baseLevel = baseSkill?.level ?? 0
                const delta = infectedLevel - baseLevel
                if (delta <= 0) return null
                return <span style={{ color: '#7fc458', fontSize: '13px' }}> (+{delta})</span>
              }
              return (
                <tr key={a.name}>
                  <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5a89a' }}>
                    {a.name}
                    {base && <div style={{ fontSize: '13px', color: '#888', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>vs base {base.name}</div>}
                  </td>
                  <td style={{ ...ruleTableTdStyle, textAlign: 'center', fontFamily: 'monospace', color: '#cce0f5' }}>{a.rapidCode}</td>
                  <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.wp_max}</td>
                  <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.rp_max}</td>
                  <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.mdm}</td>
                  <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.rdm}</td>
                  <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>+{a.init}</td>
                  <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{a.enc}</td>
                  <td style={ruleTableTdStyle}>
                    {a.skills.map((s, i) => (
                      <span key={s.name}>
                        {i > 0 && ', '}
                        {s.name} {s.level}{skillDelta(s.name, s.level)}
                      </span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </RuleTable>
        <P>
          If characters get bitten by a Distemper-infected canine,
          the standard <a href="/rules/combat/infection" style={{ color: '#7ab3d4' }}>Infection</a> flow applies —
          Wound Infection check after combat, sick days, possible
          Lasting Damage. The H724 strain is no longer guaranteed
          terminal but the bite still carries it.
        </P>
      </RuleSection>
    </>
  )
}
