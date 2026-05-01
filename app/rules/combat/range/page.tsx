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

export const metadata = { title: 'Range — XSE SRD §06' }

const BANDS: Array<[number, string, string, string]> = [
  [1, 'Engaged', '≤ 5 ft', "Close enough to wrestle. +1 CMod on Melee, −1 CMod on Ranged. All Unarmed combat happens at Engaged range."],
  [2, 'Close', '≤ 30 ft', "If you can still see the whites of your opponent's eyes. Melee at Close gets −1 CMod. Pistols and grenades are at their best."],
  [3, 'Medium', '≤ 100 ft', 'No modifiers to any attack. Carbines and bows are perfect. A pistol shot would be wasted without taking aim, but you can still throw a grenade.'],
  [4, 'Long', '≤ 300 ft', '−5 CMod to a pistol shot, +1 CMod to a rifle shot. The territory of hunting rifles and sniper rifles.'],
  [5, 'Distant', '≤ 1000 ft', "So far that radio equipment is needed for communication. Hitting requires a hunting rifle with scope, or a sniper's rifle. Heavy weapons, mortars, RPGs."],
]

export default function Page() {
  return (
    <>
      <SectionSubNav section={findSection('combat')!} />
      <RuleHero
        eyebrow="§06 · Combat › Range"
        title="Range"
        intro={
          <>
            XSE uses five abstract <Term>Range Bands</Term> rather than
            measured distance. Each character's position is relative —
            "you're at Close range to the bandit, Medium range to the
            sniper."
          </>
        }
      />

      <RuleTable>
        <thead>
          <tr>
            <th style={{ ...ruleTableThStyle, textAlign: 'center', width: 60 }}>#</th>
            <th style={ruleTableThStyle}>Band</th>
            <th style={{ ...ruleTableThStyle, width: 110 }}>Tactical</th>
            <th style={ruleTableThStyle}>Modifiers / notes</th>
          </tr>
        </thead>
        <tbody>
          {BANDS.map(([num, band, ft, notes]) => (
            <tr key={band}>
              <td style={{ ...ruleTableTdStyle, textAlign: 'center', fontWeight: 700, color: '#cce0f5' }}>{num}</td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}><Term>{band}</Term></td>
              <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', color: '#cce0f5' }}>{ft}</td>
              <td style={ruleTableTdStyle}>{notes}</td>
            </tr>
          ))}
        </tbody>
      </RuleTable>

      <P>
        Moving between bands takes the same number of combat rounds as
        the sum of bands being crossed:
      </P>
      <ul style={{ fontSize: 17, lineHeight: 1.8, color: '#f5f2ee', paddingLeft: '1.5rem', margin: '0 0 1rem' }}>
        <li>Engaged → Close: <Term>3 rounds</Term></li>
        <li>Engaged → Medium: <Term>6 rounds</Term></li>
        <li>Engaged → Long: <Term>10 rounds</Term></li>
        <li>Engaged → Distant: <Term>15 rounds</Term></li>
      </ul>

      <P>
        On a tactical grid (10 ft per cell), the band thresholds locked
        on Tapestry are: Engaged ≤ 5 ft, Close ≤ 30 ft, Medium ≤ 100 ft,
        Long ≤ 300 ft, Distant ≤ 1000 ft. These power the move-highlight
        rings, throw-mode preview, and blast-radius scaling on the
        tactical map.
      </P>
    </>
  )
}
