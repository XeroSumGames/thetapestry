'use client'
import { useState } from 'react'
import { CampaignNpc } from './NpcRoster'
import { getWeaponByName, conditionColor, CONDITION_CMOD, Condition } from '../lib/weapons'
import { createClient } from '../lib/supabase-browser'

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  friendly: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  goon: { bg: '#2a2010', border: '#5a4a1b', color: '#EF9F27' },
  foe: { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  antagonist: { bg: '#2a102a', border: '#8b2e8b', color: '#d48bd4' },
}

const STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  active: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  dead: { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  unknown: { bg: '#1a1a2e', border: '#2e2e5a', color: '#7ab3d4' },
}

function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

interface Props {
  npc: CampaignNpc
  onClose: () => void
  onEdit: () => void
  onRoll?: (label: string, amod: number, smod: number, weaponContext?: { weaponName: string; damage: string; rpPercent: number; conditionCmod: number }) => void
}

export default function NpcCard({ npc, onClose, onEdit, onRoll }: Props) {
  const supabase = createClient()
  const rapid: Record<string, number> = { RSN: npc.reason, ACU: npc.acumen, PHY: npc.physicality, INF: npc.influence, DEX: npc.dexterity }
  const tc = TYPE_COLORS[npc.npc_type ?? ''] ?? TYPE_COLORS.goon
  const sc = STATUS_COLORS[npc.status] ?? STATUS_COLORS.active

  const wpMax = npc.wp_max ?? (10 + npc.physicality + npc.dexterity)
  const rpMax = npc.rp_max ?? (6 + npc.physicality)
  const [wpCurrent, setWpCurrent] = useState(npc.wp_current ?? wpMax)
  const [rpCurrent, setRpCurrent] = useState(npc.rp_current ?? rpMax)

  async function updateHealth(field: 'wp_current' | 'rp_current', value: number) {
    if (field === 'wp_current') setWpCurrent(value)
    else setRpCurrent(value)
    await supabase.from('campaign_npcs').update({ [field]: value }).eq('id', npc.id)
  }

  const skillEntries: { name: string; level: number }[] = Array.isArray(npc.skills?.entries) ? npc.skills.entries : []
  const weapon = npc.skills?.weapon ?? null
  const w = weapon ? getWeaponByName(weapon.weaponName) : null

  function getSkillLevel(skillName: string): number {
    return skillEntries.find(s => s.name === skillName)?.level ?? 0
  }

  // Skill-to-attribute mapping
  const SKILL_ATTR: Record<string, string> = {
    'Animal Handling': 'INF', 'Athletics': 'PHY', 'Barter': 'INF', 'Demolitions': 'PHY',
    'Driving': 'DEX', 'Entertainment': 'INF', 'Farming': 'ACU', 'Gambling': 'ACU',
    'Heavy Weapons': 'PHY', 'Inspiration': 'INF', 'Lock-Picking': 'ACU', 'Manipulation': 'INF',
    'Mechanic': 'RSN', 'Medicine': 'RSN', 'Melee Combat': 'PHY', 'Navigation': 'RSN',
    'Psychology': 'RSN', 'Ranged Combat': 'DEX', 'Research': 'RSN', 'Scavenging': 'ACU',
    'Sleight of Hand': 'DEX', 'Specific Knowledge': 'RSN', 'Stealth': 'PHY', 'Streetwise': 'ACU',
    'Survival': 'ACU', 'Tactics': 'RSN', 'Tinkerer': 'DEX', 'Unarmed Combat': 'PHY', 'Weaponsmith': 'DEX',
  }

  function handleSkillRoll(skillName: string, level: number) {
    if (!onRoll) return
    const attrKey = SKILL_ATTR[skillName] ?? 'RSN'
    const amod = rapid[attrKey] ?? 0
    onRoll(`${npc.name} — ${skillName} (${attrKey})`, amod, level)
  }

  function handleAttrRoll(attrKey: string) {
    if (!onRoll) return
    const amod = rapid[attrKey] ?? 0
    onRoll(`${npc.name} — ${attrKey} Check`, amod, 0)
  }

  function handleWeaponAttack() {
    if (!onRoll || !w || !weapon) return
    const isMelee = w.category === 'melee'
    const attrKey = isMelee ? 'PHY' : 'DEX'
    const skillName = w.skill
    const amod = rapid[attrKey] ?? 0
    const smod = getSkillLevel(skillName)
    const cond = (weapon.condition as Condition) ?? 'Used'
    const condCmod = CONDITION_CMOD[cond]
    onRoll(`${npc.name} — Attack (${w.name})`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: condCmod !== -99 ? condCmod : 0 })
  }

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '10px 12px', marginBottom: '8px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {npc.portrait_url ? (
            <img src={npc.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>
              {npc.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>{npc.name}</div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
            {npc.npc_type && <span style={{ fontSize: '13px', padding: '0 5px', borderRadius: '2px', background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
            <span style={{ fontSize: '13px', padding: '0 5px', borderRadius: '2px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button onClick={onEdit} style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Edit</button>
          <button onClick={onClose} style={{ padding: '4px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Close</button>
        </div>
      </div>

      {/* RAPID — clickable */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
        {(['RSN', 'ACU', 'PHY', 'INF', 'DEX'] as const).map(k => {
          const v = rapid[k] ?? 0
          return (
            <div key={k} onClick={() => handleAttrRoll(k)}
              style={{ flex: 1, background: v > 0 ? '#1a2e10' : '#242424', border: `1px solid ${v > 0 ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', padding: '3px 2px', textAlign: 'center', cursor: onRoll ? 'pointer' : 'default' }}>
              <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: v > 0 ? '#7fc458' : '#d4cfc9' }}>{sgn(v)}</div>
            </div>
          )
        })}
      </div>

        {/* WP / RP trackers */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '6px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>WP</span>
              <span style={{ fontSize: '13px', color: '#c0392b', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{wpCurrent}/{wpMax}</span>
            </div>
            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
              {Array.from({ length: wpMax }).map((_, i) => (
                <div key={i} onClick={() => updateHealth('wp_current', i < wpCurrent ? i : i + 1)}
                  style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${i < wpCurrent ? '#c0392b' : '#3a3a3a'}`, background: i < wpCurrent ? '#c0392b' : 'transparent', cursor: 'pointer', transition: 'all .1s' }} />
              ))}
            </div>
            {wpCurrent === 0 && <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', marginTop: '2px' }}>MORTALLY WOUNDED</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>RP</span>
              <span style={{ fontSize: '13px', color: '#7ab3d4', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{rpCurrent}/{rpMax}</span>
            </div>
            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
              {Array.from({ length: rpMax }).map((_, i) => (
                <div key={i} onClick={() => updateHealth('rp_current', i < rpCurrent ? i : i + 1)}
                  style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${i < rpCurrent ? '#7ab3d4' : '#3a3a3a'}`, background: i < rpCurrent ? '#7ab3d4' : 'transparent', cursor: 'pointer', transition: 'all .1s' }} />
              ))}
            </div>
            {rpCurrent === 0 && wpCurrent > 0 && <div style={{ fontSize: '13px', color: '#7ab3d4', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', marginTop: '2px' }}>UNCONSCIOUS</div>}
          </div>
        </div>

      {/* Skills — clickable */}
      {skillEntries.length > 0 && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {skillEntries.filter(s => s.name).map((s, i) => (
            <span key={i} onClick={() => handleSkillRoll(s.name, s.level)}
              style={{ fontSize: '13px', padding: '1px 5px', background: s.level > 0 ? '#1a2e10' : '#242424', border: `1px solid ${s.level > 0 ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: s.level > 0 ? '#7fc458' : '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', cursor: onRoll ? 'pointer' : 'default' }}>
              {s.name} {sgn(s.level)}
            </span>
          ))}
        </div>
      )}

      {/* GM Notes */}
      {npc.notes && (
        <div style={{ fontSize: '13px', color: '#cce0f5', fontStyle: 'italic', marginBottom: '6px' }}>{npc.notes}</div>
      )}

      {/* Combat: weapon + unarmed */}
      {onRoll && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button onClick={() => {
            const phyAmod = rapid.PHY ?? 0
            const smod = getSkillLevel('Unarmed Combat')
            onRoll(`${npc.name} — Unarmed`, phyAmod, smod, { weaponName: 'Unarmed', damage: '1d3', rpPercent: 100, conditionCmod: 0 })
          }}
            style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
            👊 Unarmed
          </button>
          {w && (
            <button onClick={handleWeaponAttack}
              style={{ padding: '4px 8px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', flex: 1 }}>
              ⚔️ {w.name} ({w.damage})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
