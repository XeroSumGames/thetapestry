import {
  RuleHero,
  RuleSection,
  RuleTable,
  P,
  ruleTableThStyle,
  ruleTableTdStyle,
} from '../../../components/rules/RuleSection'
import { MELEE_WEAPONS, RANGED_WEAPONS, EXPLOSIVE_WEAPONS, HEAVY_WEAPONS } from '../../../lib/weapons'
import { EQUIPMENT } from '../../../lib/xse-schema'

export const metadata = { title: 'Appendix C — Weapons & Equipment — XSE SRD' }

interface WeaponLike {
  name: string
  skill: string
  range: string
  rarity: string
  damage: string
  rpPercent: number
  enc: number
  clip?: number
  ammo?: string
  traits: string[]
}

function WeaponTable({ weapons }: { weapons: WeaponLike[] }) {
  return (
    <RuleTable>
      <thead>
        <tr>
          <th style={ruleTableThStyle}>Name</th>
          <th style={{ ...ruleTableThStyle, width: 100 }}>Skill</th>
          <th style={{ ...ruleTableThStyle, width: 80 }}>Range</th>
          <th style={{ ...ruleTableThStyle, width: 80, textAlign: 'center' }}>Rarity</th>
          <th style={{ ...ruleTableThStyle, width: 110 }}>Damage</th>
          <th style={{ ...ruleTableThStyle, width: 60, textAlign: 'center' }}>RP%</th>
          <th style={{ ...ruleTableThStyle, width: 50, textAlign: 'center' }}>ENC</th>
          <th style={{ ...ruleTableThStyle, width: 60, textAlign: 'center' }}>Clip</th>
          <th style={ruleTableThStyle}>Traits</th>
        </tr>
      </thead>
      <tbody>
        {weapons.map(w => (
          <tr key={w.name}>
            <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{w.name}</td>
            <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>{w.skill}</td>
            <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap' }}>{w.range}</td>
            <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', color: w.rarity === 'Rare' ? '#EF9F27' : w.rarity === 'Uncommon' ? '#7ab3d4' : '#7fc458' }}>{w.rarity}</td>
            <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', color: '#cce0f5' }}>{w.damage || '—'}</td>
            <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{w.rpPercent}%</td>
            <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{w.enc}</td>
            <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{w.clip ?? '—'}</td>
            <td style={ruleTableTdStyle}>{w.traits.length ? w.traits.join(', ') : '—'}</td>
          </tr>
        ))}
      </tbody>
    </RuleTable>
  )
}

export default function Page() {
  return (
    <>
      <RuleHero
        eyebrow="Appendix C · Weapons & Equipment"
        title="Weapons & Equipment Catalog"
        intro={
          <>
            Every weapon and gear item in the SRD with full stats. Trait
            effects live in{' '}
            <a href="/rules/equipment/item-traits" style={{ color: '#7ab3d4' }}>§07 Item Traits</a>
            ; condition CMods in{' '}
            <a href="/rules/equipment/item-condition" style={{ color: '#7ab3d4' }}>§07 Item Condition</a>.
          </>
        }
      />

      <RuleSection id="melee" title="Table 16 — Melee Weapons">
        <WeaponTable weapons={MELEE_WEAPONS as unknown as WeaponLike[]} />
      </RuleSection>

      <RuleSection id="ranged" title="Table 17 — Ranged Weapons">
        <WeaponTable weapons={RANGED_WEAPONS as unknown as WeaponLike[]} />
      </RuleSection>

      <RuleSection id="explosive" title="Table 18 — Explosive Weapons">
        <WeaponTable weapons={EXPLOSIVE_WEAPONS as unknown as WeaponLike[]} />
      </RuleSection>

      <RuleSection id="specialist" title="Table 19 — Heavy / Specialist Weapons">
        <WeaponTable weapons={HEAVY_WEAPONS as unknown as WeaponLike[]} />
      </RuleSection>

      <RuleSection id="equipment" title="Table 20 — Equipment">
        <P>
          Each character begins with one piece of equipment from this
          table, plus an Incidental item that has no combat value but
          provides some flavour or utility.
        </P>
        <RuleTable>
          <thead>
            <tr>
              <th style={ruleTableThStyle}>Name</th>
              <th style={{ ...ruleTableThStyle, width: 100, textAlign: 'center' }}>Rarity</th>
              <th style={{ ...ruleTableThStyle, width: 60, textAlign: 'center' }}>ENC</th>
              <th style={ruleTableThStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {EQUIPMENT.map(item => (
              <tr key={item.name}>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', fontWeight: 700, color: '#f5f2ee' }}>{item.name}</td>
                <td style={{ ...ruleTableTdStyle, whiteSpace: 'nowrap', textAlign: 'center', color: item.rarity === 'Rare' ? '#EF9F27' : item.rarity === 'Uncommon' ? '#7ab3d4' : '#7fc458' }}>{item.rarity}</td>
                <td style={{ ...ruleTableTdStyle, textAlign: 'center' }}>{item.enc}</td>
                <td style={ruleTableTdStyle}>{item.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </RuleTable>
      </RuleSection>
    </>
  )
}
