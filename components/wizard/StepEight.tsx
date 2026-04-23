'use client'
import { useState } from 'react'
import { WizardState } from '../../lib/xse-engine'
import { MELEE_WEAPONS, RANGED_WEAPONS, EQUIPMENT } from '../../lib/xse-schema'

interface Props {
  state: WizardState
  onChange: (updated: Partial<WizardState>) => void
}

type WeaponTab = 'all' | 'melee' | 'ranged'

export default function StepEight({ state, onChange }: Props) {
  const [primaryTab, setPrimaryTab] = useState<WeaponTab>('all')
  const [secondaryTab, setSecondaryTab] = useState<WeaponTab>('all')

  const allWeapons = [
    ...MELEE_WEAPONS.map(w => ({ ...w, cat: 'melee' as const })),
    ...RANGED_WEAPONS.map(w => ({ ...w, cat: 'ranged' as const })),
  ]

  function filteredWeapons(tab: WeaponTab) {
    if (tab === 'all') return allWeapons
    return allWeapons.filter(w => w.cat === tab)
  }

  function needsAmmo(name: string) {
    return RANGED_WEAPONS.some(w => w.name === name)
  }

  function roll1d3() { return Math.floor(Math.random() * 3) + 1 }

  function WeaponSection({ slot, tab, setTab }: { slot: 'weaponPrimary' | 'weaponSecondary', tab: WeaponTab, setTab: (t: WeaponTab) => void }) {
    const current = slot === 'weaponPrimary' ? state.weaponPrimary : state.weaponSecondary
    const ammo = slot === 'weaponPrimary' ? state.primaryAmmo : state.secondaryAmmo

    function selectWeapon(name: string) {
      if (slot === 'weaponPrimary') onChange({ weaponPrimary: name, primaryAmmo: 0 })
      else onChange({ weaponSecondary: name, secondaryAmmo: 0 })
    }

    function rollAmmo() {
      if (slot === 'weaponPrimary') onChange({ primaryAmmo: roll1d3() })
      else onChange({ secondaryAmmo: roll1d3() })
    }

    return (
      <div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {(['all', 'melee', 'ranged'] as WeaponTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '5px 12px', fontSize: '13px',
              border: `1px solid ${tab === t ? '#c0392b' : '#3a3a3a'}`,
              borderRadius: '3px', cursor: 'pointer',
              background: tab === t ? '#c0392b' : '#242424',
              color: tab === t ? '#fff' : '#f5f2ee',
              fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase',
              transition: 'all .1s',
            }}>
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Weapon cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '.5rem' }}>
          {filteredWeapons(tab).map(w => {
            const sel = current === w.name
            const dmg = 'damageDice' in w && w.damageDice ? `${w.damageBase}+${w.damageDice}` : `${w.damageBase}`
            return (
              <div key={w.name} onClick={() => selectWeapon(w.name)} style={{
                background: sel ? '#2a1210' : '#242424',
                border: `1px solid ${sel ? '#c0392b' : '#2e2e2e'}`,
                borderRadius: '3px', padding: '8px 10px', cursor: 'pointer', transition: 'all .1s',
              }}>
                <div style={{
                  fontSize: '8.5px', padding: '1px 5px', borderRadius: '2px',
                  display: 'inline-block', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.06em',
                  background: w.cat === 'melee' ? '#1a2e10' : '#0f2035',
                  color: w.cat === 'melee' ? '#7fc458' : '#7ab3d4',
                  border: `1px solid ${w.cat === 'melee' ? '#2d5a1b' : '#1a3a5c'}`,
                }}>
                  {w.cat}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee' }}>{w.name}</div>
                <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '2px' }}>
                  {w.range} — {dmg} — RP {'rpPercent' in w ? w.rpPercent : ''}% — ENC {w.enc}
                </div>
                {'traits' in w && w.traits.length > 0 && (
                  <div style={{ fontSize: '13px', color: '#7ab3d4', marginTop: '1px' }}>
                    {w.traits.map(t => t.name).join(', ')}
                  </div>
                )}
                {'clipSize' in w && w.clipSize > 0 && (
                  <div style={{ fontSize: '13px', color: '#7ab3d4', marginTop: '1px' }}>
                    Clip: {w.clipSize}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Ammo roll */}
        {current && needsAmmo(current) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', marginBottom: '1rem' }}>
            <span style={{ fontSize: '13px', color: '#f5f2ee', flex: 1 }}>Starting ammo for {current}:</span>
            <button onClick={rollAmmo} style={{
              padding: '5px 12px', fontSize: '13px',
              border: '1px solid #1a3a5c', borderRadius: '3px',
              background: '#0f2035', color: '#7ab3d4', cursor: 'pointer',
              fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.05em', textTransform: 'uppercase',
            }}>
              Roll 1d3
            </button>
            {ammo > 0
              ? <span style={{ fontSize: '13px', fontWeight: 600, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {ammo} reload{ammo > 1 ? 's' : ''}
                </span>
              : <span style={{ fontSize: '13px', color: '#cce0f5' }}>Not yet rolled</span>
            }
          </div>
        )}
      </div>
    )
  }

  const equipItems = EQUIPMENT.filter(e => !['Bible', 'Deck of Cards', 'Disposable Lighters', 'Eye Glasses', 'Map of Area', 'Musical Instrument', 'Personal Item (Photo)', 'Pocket Knife', 'Walkman', 'Zippo Lighter'].includes(e.name))

  return (
    <div>

      {/* Primary weapon */}
      <div style={sh}>Primary weapon</div>
      <WeaponSection slot="weaponPrimary" tab={primaryTab} setTab={setPrimaryTab} />

      {/* Secondary weapon */}
      <div style={sh}>Secondary weapon</div>
      <WeaponSection slot="weaponSecondary" tab={secondaryTab} setTab={setSecondaryTab} />

      {/* Equipment */}
      <div style={sh}>Equipment — choose one</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '1rem' }}>
        {equipItems.map(item => {
          const sel = state.equipment === item.name
          return (
            <div key={item.name} onClick={() => onChange({ equipment: sel ? '' : item.name })} style={{
              background: sel ? '#2a1210' : '#242424',
              border: `1px solid ${sel ? '#c0392b' : '#2e2e2e'}`,
              borderRadius: '3px', padding: '8px 10px', cursor: 'pointer', transition: 'all .1s',
            }}>
              <div style={{
                fontSize: '8.5px', padding: '1px 5px', borderRadius: '2px',
                display: 'inline-block', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.06em',
                background: '#1a2e10', color: '#7fc458', border: '1px solid #2d5a1b',
              }}>
                {item.rarity}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee' }}>{item.name}</div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '2px' }}>
                ENC {item.enc}{item.notes ? ` — ${item.notes}` : ''}
              </div>
            </div>
          )
        })}
      </div>

      {/* Incidental item */}
      <div style={sh}>Incidental item — choose one</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '8px' }}>
        {['Bible', 'Deck of Cards', 'Disposable Lighters', 'Eye Glasses', 'Map of Area', 'Musical Instrument', 'Personal Item (Photo)', 'Pocket Knife', 'Walkman', 'Zippo Lighter'].map(name => {
          const sel = state.incidentalItem === name
          return (
            <div key={name} onClick={() => onChange({ incidentalItem: sel ? '' : name })} style={{
              background: sel ? '#2a1210' : '#242424',
              border: `1px solid ${sel ? '#c0392b' : '#2e2e2e'}`,
              borderRadius: '3px', padding: '6px 7px', fontSize: '13px', cursor: 'pointer',
              textAlign: 'center', color: sel ? '#f5a89a' : '#f5f2ee',
              fontWeight: sel ? 600 : 400, transition: 'all .1s',
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
          value={['Bible','Deck of Cards','Disposable Lighters','Eye Glasses','Map of Area','Musical Instrument','Personal Item (Photo)','Pocket Knife','Walkman','Zippo Lighter'].includes(state.incidentalItem) ? '' : state.incidentalItem}
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
          return (
            <div key={item.name} onClick={() => onChange({ rations: sel ? '' : item.name })} style={{
              background: sel ? '#2a1210' : '#242424',
              border: `1px solid ${sel ? '#c0392b' : '#2e2e2e'}`,
              borderRadius: '3px', padding: '8px 10px', cursor: 'pointer', transition: 'all .1s',
            }}>
              <div style={{
                fontSize: '8.5px', padding: '1px 5px', borderRadius: '2px',
                display: 'inline-block', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.06em',
                background: '#1a2e10', color: '#7fc458', border: '1px solid #2d5a1b',
              }}>
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
  fontFamily: 'Barlow Condensed, sans-serif',
  fontSize: '13px', fontWeight: 600, color: '#f5f2ee',
  textTransform: 'uppercase', letterSpacing: '.1em',
  margin: '1.25rem 0 8px', borderBottom: '1px solid #2e2e2e',
  paddingBottom: '4px',
}