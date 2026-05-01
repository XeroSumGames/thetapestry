'use client'
import { useMemo, useState } from 'react'
import { WizardState } from '../../lib/xse-engine'
import { ALL_WEAPONS, type Weapon, type WeaponCategory } from '../../lib/weapons'
import { EQUIPMENT } from '../../lib/xse-schema'

// What They Have — character-creation step 8. Redesigned 2026-05-01:
//
//   - Weapon picker now covers ALL 4 categories (Melee / Ranged /
//     Heavy / Explosive) via lib/weapons.ts. Previously only Melee +
//     Ranged were reachable here, so Heavy Weapons + Demolitions +
//     Explosives PCs had to skip this step and add their loadout
//     post-creation.
//   - Tab strip: All / Melee / Ranged / Heavy / Explosive. Search
//     input narrows within the active tab (case-insensitive
//     substring match against name + traits).
//   - Compact single-row layout per weapon: name + category chip +
//     range + damage + RP + ENC + traits. Replaces the dense 2-column
//     card grid that buried the secondary stats.
//   - Equipment picker: rarity tabs + search. Previously a single
//     curated 2-column grid. Same data, easier to scan.
//   - Incidental + Rations sections preserved (curated lists; small
//     enough to keep their button-grid layout).

interface Props {
  state: WizardState
  onChange: (updated: Partial<WizardState>) => void
}

type WeaponTab = 'all' | WeaponCategory
type EquipTab = 'all' | 'Common' | 'Uncommon' | 'Rare'

const WEAPON_TABS: { value: WeaponTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'melee', label: 'Melee' },
  { value: 'ranged', label: 'Ranged' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'explosive', label: 'Explosive' },
]

const CATEGORY_ACCENT: Record<WeaponCategory, { bg: string; fg: string; border: string }> = {
  melee:     { bg: '#1a2e10', fg: '#7fc458', border: '#2d5a1b' },
  ranged:    { bg: '#0f2035', fg: '#7ab3d4', border: '#1a3a5c' },
  heavy:     { bg: '#2a2010', fg: '#EF9F27', border: '#5a4a1b' },
  explosive: { bg: '#2a1010', fg: '#f5a89a', border: '#7a1f16' },
}

const RARITY_ACCENT: Record<string, string> = {
  Common: '#cce0f5',
  Uncommon: '#7ab3d4',
  Rare: '#c4a7f0',
}

function roll1d3() { return Math.floor(Math.random() * 3) + 1 }

function needsAmmo(name: string): boolean {
  const w = ALL_WEAPONS.find(w => w.name === name)
  return !!w && w.clip != null
}

export default function StepEight({ state, onChange }: Props) {
  const [primaryTab, setPrimaryTab] = useState<WeaponTab>('all')
  const [primaryQuery, setPrimaryQuery] = useState<string>('')
  const [secondaryTab, setSecondaryTab] = useState<WeaponTab>('all')
  const [secondaryQuery, setSecondaryQuery] = useState<string>('')
  const [equipTab, setEquipTab] = useState<EquipTab>('all')
  const [equipQuery, setEquipQuery] = useState<string>('')

  function filteredWeapons(tab: WeaponTab, query: string): Weapon[] {
    let list: Weapon[] = tab === 'all' ? ALL_WEAPONS : ALL_WEAPONS.filter(w => w.category === tab)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(w =>
        w.name.toLowerCase().includes(q)
        || w.traits.some(t => t.toLowerCase().includes(q))
        || w.skill.toLowerCase().includes(q)
      )
    }
    return list
  }

  // Equipment picker — rarity tabs + search. The original curated list
  // dropped 10 "incidental"-flavored items so they're rendered in their
  // own section below; preserve that filter here.
  const INCIDENTAL_NAMES = new Set([
    'Bible', 'Deck of Cards', 'Disposable Lighters', 'Eye Glasses', 'Map of Area',
    'Musical Instrument', 'Personal Item (Photo)', 'Pocket Knife', 'Walkman', 'Zippo Lighter',
  ])
  const equipmentPool = useMemo(() => EQUIPMENT.filter(e => !INCIDENTAL_NAMES.has(e.name)), [])
  function filteredEquipment() {
    let list = equipmentPool
    if (equipTab !== 'all') list = list.filter(e => e.rarity === equipTab)
    const q = equipQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q)
      )
    }
    return list
  }

  function WeaponSection({ slot, tab, setTab, query, setQuery }: {
    slot: 'weaponPrimary' | 'weaponSecondary'
    tab: WeaponTab
    setTab: (t: WeaponTab) => void
    query: string
    setQuery: (q: string) => void
  }) {
    const current = slot === 'weaponPrimary' ? state.weaponPrimary : state.weaponSecondary
    const ammo = slot === 'weaponPrimary' ? state.primaryAmmo : state.secondaryAmmo
    const visible = filteredWeapons(tab, query)

    function selectWeapon(name: string) {
      // Toggle off if already selected (lets the player clear the slot).
      if (current === name) {
        if (slot === 'weaponPrimary') onChange({ weaponPrimary: '', primaryAmmo: 0 })
        else onChange({ weaponSecondary: '', secondaryAmmo: 0 })
        return
      }
      if (slot === 'weaponPrimary') onChange({ weaponPrimary: name, primaryAmmo: 0 })
      else onChange({ weaponSecondary: name, secondaryAmmo: 0 })
    }

    function rollAmmo() {
      if (slot === 'weaponPrimary') onChange({ primaryAmmo: roll1d3() })
      else onChange({ secondaryAmmo: roll1d3() })
    }

    return (
      <div>
        {/* Tab strip */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
          {WEAPON_TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)} style={{
              padding: '5px 12px', fontSize: '13px',
              border: `1px solid ${tab === t.value ? '#c0392b' : '#3a3a3a'}`,
              borderRadius: '3px', cursor: 'pointer',
              background: tab === t.value ? '#c0392b' : '#242424',
              color: tab === t.value ? '#fff' : '#f5f2ee',
              fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase',
            }}>{t.label}</button>
          ))}
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            style={{ flex: 1, minWidth: '140px', padding: '5px 10px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }} />
        </div>

        {/* Compact single-row weapon list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '0.5rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
          {visible.length === 0 ? (
            <div style={{ padding: '10px 12px', background: '#1a1a1a', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#9aa5b0', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
              No weapons match this filter.
            </div>
          ) : visible.map(w => {
            const sel = current === w.name
            const accent = CATEGORY_ACCENT[w.category]
            const rarityColor = RARITY_ACCENT[w.rarity] ?? '#cce0f5'
            return (
              <button key={w.name} onClick={() => selectWeapon(w.name)} type="button"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 10px',
                  background: sel ? '#2a1210' : '#1a1a1a',
                  border: `1px solid ${sel ? '#c0392b' : '#2e2e2e'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'Barlow, sans-serif',
                  color: '#f5f2ee',
                }}>
                <span style={{ fontSize: '13px', padding: '1px 7px', background: accent.bg, color: accent.fg, border: `1px solid ${accent.border}`, borderRadius: '2px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, minWidth: '64px', textAlign: 'center' }}>
                  {w.category}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.name}{' '}
                    <span style={{ fontSize: '13px', fontWeight: 500, color: rarityColor, marginLeft: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{w.rarity}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#cce0f5' }}>
                    {w.range} · {w.damage} · RP {w.rpPercent}% · ENC {w.enc}
                    {w.clip != null && ` · Clip ${w.clip}`}
                    {w.traits.length > 0 && (
                      <span style={{ color: '#7ab3d4', marginLeft: '4px' }}>· {w.traits.join(', ')}</span>
                    )}
                  </div>
                </div>
                {sel && (
                  <span style={{ fontSize: '13px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>✓ Picked</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Ammo roll for ranged weapons (clip-tracked) */}
        {current && needsAmmo(current) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', marginBottom: '1rem' }}>
            <span style={{ fontSize: '13px', color: '#f5f2ee', flex: 1 }}>Starting ammo for {current}:</span>
            <button type="button" onClick={rollAmmo}
              style={{ padding: '5px 12px', fontSize: '13px', border: '1px solid #1a3a5c', borderRadius: '3px', background: '#0f2035', color: '#7ab3d4', cursor: 'pointer', fontFamily: 'Carlito, sans-serif', letterSpacing: '.05em', textTransform: 'uppercase' }}>
              Roll 1d3
            </button>
            {ammo > 0
              ? <span style={{ fontSize: '13px', fontWeight: 600, color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>{ammo} reload{ammo > 1 ? 's' : ''}</span>
              : <span style={{ fontSize: '13px', color: '#cce0f5' }}>Not yet rolled</span>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>

      {/* Primary weapon */}
      <div style={sh}>Primary weapon</div>
      <WeaponSection slot="weaponPrimary" tab={primaryTab} setTab={setPrimaryTab} query={primaryQuery} setQuery={setPrimaryQuery} />

      {/* Secondary weapon */}
      <div style={sh}>Secondary weapon</div>
      <WeaponSection slot="weaponSecondary" tab={secondaryTab} setTab={setSecondaryTab} query={secondaryQuery} setQuery={setSecondaryQuery} />

      {/* Equipment — rarity tabs + search + compact rows */}
      <div style={sh}>Equipment — choose one</div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
        {(['all', 'Common', 'Uncommon', 'Rare'] as EquipTab[]).map(t => (
          <button key={t} type="button" onClick={() => setEquipTab(t)} style={{
            padding: '5px 12px', fontSize: '13px',
            border: `1px solid ${equipTab === t ? '#c0392b' : '#3a3a3a'}`,
            borderRadius: '3px', cursor: 'pointer',
            background: equipTab === t ? '#c0392b' : '#242424',
            color: equipTab === t ? '#fff' : '#f5f2ee',
            fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase',
          }}>{t === 'all' ? 'All' : t}</button>
        ))}
        <input value={equipQuery} onChange={e => setEquipQuery(e.target.value)}
          placeholder="Search…"
          style={{ flex: 1, minWidth: '140px', padding: '5px 10px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '1rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
        {filteredEquipment().length === 0 ? (
          <div style={{ padding: '10px 12px', background: '#1a1a1a', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#9aa5b0', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
            No equipment matches this filter.
          </div>
        ) : filteredEquipment().map(item => {
          const sel = state.equipment === item.name
          const rarityColor = RARITY_ACCENT[item.rarity] ?? '#cce0f5'
          return (
            <button key={item.name} type="button" onClick={() => onChange({ equipment: sel ? '' : item.name })}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 10px',
                background: sel ? '#2a1210' : '#1a1a1a',
                border: `1px solid ${sel ? '#c0392b' : '#2e2e2e'}`,
                borderRadius: '3px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'Barlow, sans-serif',
                color: '#f5f2ee',
              }}>
              <span style={{ fontSize: '13px', color: rarityColor, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, minWidth: '64px', textAlign: 'center' }}>
                {item.rarity}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '13px', color: '#cce0f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ENC {item.enc}{item.notes ? ` · ${item.notes}` : ''}
                </div>
              </div>
              {sel && (
                <span style={{ fontSize: '13px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>✓ Picked</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Incidental item — preserved curated list (small enough that
          tab + search isn't a win here). */}
      <div style={sh}>Incidental item — choose one</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '8px' }}>
        {[...INCIDENTAL_NAMES].map(name => {
          const sel = state.incidentalItem === name
          return (
            <div key={name} onClick={() => onChange({ incidentalItem: sel ? '' : name })} style={{
              background: sel ? '#2a1210' : '#242424',
              border: `1px solid ${sel ? '#c0392b' : '#2e2e2e'}`,
              borderRadius: '3px', padding: '6px 7px', fontSize: '13px', cursor: 'pointer',
              textAlign: 'center', color: sel ? '#f5a89a' : '#f5f2ee',
              fontWeight: sel ? 600 : 400,
            }}>
              {name}
            </div>
          )
        })}
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '13px', color: '#f5f2ee', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
          Enter your own incidental item
        </label>
        <input
          style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }}
          value={INCIDENTAL_NAMES.has(state.incidentalItem) ? '' : state.incidentalItem}
          onChange={e => onChange({ incidentalItem: e.target.value })}
          placeholder="e.g. a worn photograph, a lucky coin..." />
      </div>

      {/* Rations */}
      <div style={sh}>Rations — choose one (optional)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '1rem' }}>
        {[
          { name: 'Standard Rations',      rarity: 'Common',   enc: 0.5,  notes: '1 day food supply' },
          { name: 'Luxury Rations',         rarity: 'Uncommon', enc: 0.5,  notes: '1 day; morale bonus' },
          { name: 'Military Grade Rations', rarity: 'Uncommon', enc: 0.25, notes: 'Compact; 1 day supply' },
        ].map(item => {
          const sel = state.rations === item.name
          const rarityColor = RARITY_ACCENT[item.rarity] ?? '#cce0f5'
          return (
            <div key={item.name} onClick={() => onChange({ rations: sel ? '' : item.name })} style={{
              background: sel ? '#2a1210' : '#242424',
              border: `1px solid ${sel ? '#c0392b' : '#2e2e2e'}`,
              borderRadius: '3px', padding: '8px 10px', cursor: 'pointer',
            }}>
              <div style={{ fontSize: '13px', color: rarityColor, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '3px' }}>
                {item.rarity}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee' }}>{item.name}</div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '2px' }}>ENC {item.enc} — {item.notes}</div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

const sh: React.CSSProperties = {
  fontFamily: 'Carlito, sans-serif',
  fontSize: '13px', fontWeight: 600, color: '#f5f2ee',
  textTransform: 'uppercase', letterSpacing: '.1em',
  margin: '1.25rem 0 8px', borderBottom: '1px solid #2e2e2e',
  paddingBottom: '4px',
}
