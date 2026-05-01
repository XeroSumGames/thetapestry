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

export const metadata = { title: 'Stress & Breaking Point — XSE SRD §06' }

const BREAKING: Array<[number, string, string]> = [
  [2, 'Catatonic', '−1 movement. Damaged'],
  [3, 'Cold Fury', '−2 RSN'],
  [4, 'Berserker Rage', '−1 DEX'],
  [5, 'Despair', '−1 morale, lost RP'],
  [6, 'Obsessed', '−1 morale. Wound Points reduced'],
  [7, 'Panic Spiral', '−1 INIT'],
  [8, 'Frozen', '−1 INF'],
  [9, 'Reckless Abandon', '−1 PHY'],
  [10, 'Self-Harm', '−1 ACU'],
  [11, 'Self-Destructive Urge', '−1 PHY and −1 ACU'],
  [12, 'Identity Off', '−2 DEX'],
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('combat')!} />
      <RuleHero
        eyebrow="§06 · Combat › Stress"
        title="Stress & Breaking Point"
        intro={
          <>
            Each character starts with a <Term>Stress Level</Term> of 0
            and a <Term>Breaking Point</Term> of 5. Brutal scenes push
            Stress up; reaching the Breaking Point triggers a Lasting
            Wound from Table 13.
          </>
        }
      />

      <RuleSection id="stress-check" title="Stress Check">
        <P>
          When faced with extreme stress or emotional trauma — at the
          GM's discretion or when the narrative calls for it — PCs make a{' '}
          <Term>Stress Check</Term>: roll <Term>2d6 + Stress Modifier</Term>{' '}
          (RSN + ACU AMod). A failure raises the character's Stress Level
          by 1.
        </P>
      </RuleSection>

      <RuleSection id="breaking-point" title="Breaking Point">
        <P>
          If a character's Stress Level reaches <Term>5</Term>, they hit
          their Breaking Point.
        </P>
        <P>
          Roll <Term>2d6</Term> on Table 13: Breaking Point. The reaction
          lasts <Term>1d6 rounds</Term>; once resolved, the character's
          Stress Level resets to 0.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>2d6</th>
              <th style={ruleTableThStyle}>Reaction</th>
              <th style={ruleTableThStyle}>Effect</th>
            </tr>
          </thead>
          <tbody>
            {BREAKING.map(([roll, name, effect]) => (
              <tr key={roll}>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', width: 50, fontWeight: 700, color: '#cce0f5' }}>{roll}</td>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{name}</td>
                <td style={ruleTableTdStyle}>{effect}</td>
              </tr>
            ))}
          </tbody>
        </RuleTable>
      </RuleSection>

      <RuleSection id="cooling-off" title="Cooling Off">
        <P>
          Characters can reduce their Stress Level by 1 by spending at
          least <Term>8 uninterrupted in-game hours</Term> free from
          combat, interpersonal conflict, or environmental threat — while
          doing something they enjoy (fishing, reading, drinking with
          friends).
        </P>
      </RuleSection>
    </>
  )
}
