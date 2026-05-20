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

export const metadata = { title: 'Stress & Breaking Point - XSE SRD §06' }

const BREAKING: Array<[number, string, string]> = [
  [2, 'Catatonia', '−1 on Dexterity checks'],
  [3, 'Compulsive Fixation', '−2 Reason'],
  [4, 'Blind Rage', '−1 Dexterity'],
  [5, 'Dissociation', '−1 Maximum RP'],
  [6, 'Overwhelm', '−1 Max. Wound Points'],
  [7, 'Panic Surge', '−1 Initiative Modifier'],
  [8, 'Fatalism', '−1 Influence'],
  [9, 'Reckless Abandon', '−1 Physicality'],
  [10, 'Self-Harm', '−1 Acumen'],
  [11, 'Self-Destructive Urges', '−1 Perception, −1 Acumen'],
  [12, 'Irrational Outburst', '−2 Dexterity'],
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
            Each character starts with a <Term>Stress Level</Term> of 0,
            tracked on a 5-pip bar. Brutal scenes push Stress up; reaching
            pip 5 triggers a last-chance <Term>Hold It Together</Term> save
            - and if that fails, a Breaking Point reaction from Table 13.
          </>
        }
      />

      <RuleSection id="stress-check" title="Stress Check">
        <P>
          When faced with extreme stress or emotional trauma - at the
          GM's discretion or when the narrative calls for it - PCs make a{' '}
          <Term>Stress Check</Term>: roll <Term>2d6 + Stress Modifier</Term>{' '}
          (RSN + ACU AMod) plus any CMods the GM applies. Standard outcome
          ladder: <Term>Success (9+)</Term> means the character holds it
          together, no Stress gained; <Term>Failure (≤8)</Term> raises
          their Stress Level by 1.
        </P>
        <P>
          On the platform the <Term>Check</Term> button next to the
          character's Stress bar fires this roll. The result broadcasts
          to the table via the dice feed, and the GM (or the player on a
          GM nod) applies the +1 manually using the ± buttons. The Stress
          increment is not auto-applied - keeps the GM in the loop on
          severity judgement.
        </P>
        <P>
          Stress Level also auto-increments by 1 (no check, no manual
          tick) when a character enters <Term>0 WP (Mortally Wounded)</Term>{' '}
          or <Term>0 RP (Incapacitated)</Term>. The platform handles
          these automatically and logs the cause to the roll feed.
        </P>
      </RuleSection>

      <RuleSection id="hold-it-together" title="Hold It Together (Pip 5 save)">
        <P>
          When Stress Level hits <Term>5</Term>, the character gets one
          last chance to keep their composure before Breaking Point fires.
          The platform pops a Stress Check modal automatically; the
          character makes a <Term>Hold It Together</Term> save:{' '}
          <Term>2d6 + RSN AMod + ACU AMod + CMod</Term>.
        </P>
        <P>
          Threshold is <Term>7 or above</Term> - lower than a standard
          Success, because this is the cliff edge. On a Success, Stress
          drops back to <Term>4</Term> (one pip cleared, the bar still
          full of warning). On a Failure, Stress stays at 5 and the
          character rolls on Table 13: Breaking Point (below).
        </P>
        <P>
          The Hold It Together save is the only Stress Check with a
          non-standard success threshold. CMods apply normally - Psychology*
          help from another PC, Luxury Rations consumed before the brink,
          or whatever the GM judges relevant.
        </P>
      </RuleSection>

      <RuleSection id="breaking-point" title="Breaking Point">
        <P>
          If the Hold It Together save fails (or the GM is running a
          variant that skips the save), the character hits their{' '}
          <Term>Breaking Point</Term>.
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
          combat, interpersonal conflict, or environmental threat - while
          doing something they enjoy (fishing, reading, drinking with
          friends).
        </P>
      </RuleSection>
    </>
  )
}
