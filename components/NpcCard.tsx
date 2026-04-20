'use client'
// no React hooks needed — HP is derived from props
import { useState } from 'react'
import { CampaignNpc } from './NpcRoster'
import { getWeaponByName, conditionColor, CONDITION_CMOD, Condition, getTraitValue } from '../lib/weapons'
import { createClient } from '../lib/supabase-browser'

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  bystander: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  goon: { bg: '#2a2010', border: '#5a4a1b', color: '#EF9F27' },
  foe: { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  antagonist: { bg: '#2a102a', border: '#8b2e8b', color: '#d48bd4' },
}

const STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  active: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  dead: { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  'mortally wounded': { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  unconscious: { bg: '#1a1a2e', border: '#2e2e5a', color: '#7ab3d4' },
  unknown: { bg: '#1a1a2e', border: '#2e2e5a', color: '#7ab3d4' },
}

function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

interface Props {
  npc: CampaignNpc
  onClose: () => void
  onEdit?: () => void
  onRoll?: (label: string, amod: number, smod: number, weaponContext?: { weaponName: string; damage: string; rpPercent: number; conditionCmod: number; traitCmod?: number; traitLabel?: string; traits?: string[] }) => void
  onPublish?: () => void
  isPublished?: boolean
  onPlaceOnMap?: () => void
  // Set to enable a "Popout" button that opens this NPC in a standalone window.
  campaignId?: string
}

export default function NpcCard({ npc, onClose, onEdit, onRoll, onPublish, isPublished, onPlaceOnMap, campaignId }: Props) {
  const supabase = createClient()
  const [enlarged, setEnlarged] = useState(false)
  const rapid: Record<string, number> = { RSN: npc.reason, ACU: npc.acumen, PHY: npc.physicality, INF: npc.influence, DEX: npc.dexterity }
  const tc = TYPE_COLORS[npc.npc_type ?? ''] ?? TYPE_COLORS.goon

  const wpMax = npc.wp_max ?? (10 + npc.physicality + npc.dexterity)
  const rpMax = npc.rp_max ?? (6 + npc.physicality)
  // Read HP directly from prop — no local state, so optimistic patches from
  // the parent always reflect immediately without sync issues.
  const wpCurrent = npc.wp_current ?? wpMax
  const rpCurrent = npc.rp_current ?? rpMax

  // Derive display status from HP — don't rely on the DB status field which
  // only updates at round-end when death countdown expires.
  const isDead = wpCurrent === 0 && npc.death_countdown != null && npc.death_countdown <= 0
  const isMortal = wpCurrent === 0 && !isDead
  const isUnconscious = rpCurrent === 0 && wpCurrent > 0
  const displayStatus = npc.status === 'dead' || isDead ? 'dead'
    : isMortal ? 'mortally wounded'
    : isUnconscious ? 'unconscious'
    : npc.status
  const sc = STATUS_COLORS[displayStatus] ?? (isMortal || isUnconscious
    ? STATUS_COLORS.dead
    : STATUS_COLORS.active)

  async function updateHealth(field: 'wp_current' | 'rp_current', value: number) {
    // Write to DB; parent's realtime or optimistic patch will update the prop
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
    let traitCmod = 0
    let traitLabel = ''
    const cumbersome = getTraitValue(w.traits, 'Cumbersome')
    if (cumbersome !== null) { const deficit = cumbersome - (rapid.PHY ?? 0); if (deficit > 0) { traitCmod -= deficit; traitLabel = `Cumbersome -${deficit}` } }
    const unwieldy = getTraitValue(w.traits, 'Unwieldy')
    if (unwieldy !== null) { const deficit = unwieldy - (rapid.DEX ?? 0); if (deficit > 0) { traitCmod -= deficit; traitLabel = traitLabel ? `${traitLabel}, Unwieldy -${deficit}` : `Unwieldy -${deficit}` } }
    onRoll(`${npc.name} — Attack (${w.name})`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: (condCmod !== -99 ? condCmod : 0) + traitCmod, traitCmod, traitLabel, traits: w.traits })
  }

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '6px 8px', marginBottom: '6px' }}>

      {/* Header — name, badges, buttons all on one row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <div
          onClick={() => npc.portrait_url && setEnlarged(true)}
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: npc.portrait_url ? 'zoom-in' : 'default' }}>
          {npc.portrait_url ? (
            <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>
              {npc.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          )}
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>{npc.name}</div>
        {npc.npc_type && <span style={{ fontSize: '12px', padding: '0 4px', borderRadius: '2px', background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
        <span style={{ fontSize: '12px', padding: '0 4px', borderRadius: '2px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{displayStatus}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '3px', flexShrink: 0 }}>
          {onPublish && !isPublished && (
            <button onClick={onPublish} style={{ padding: '2px 6px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Publish</button>
          )}
          {isPublished && (
            <span style={{ padding: '2px 6px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>Published</span>
          )}
          {displayStatus === 'mortally wounded' && onRoll && (
            <button onClick={() => {
              const amod = npc.reason ?? 0
              const npcSkills: any[] = Array.isArray(npc.skills?.entries) ? npc.skills.entries : []
              const smod = npcSkills.find((s: any) => s.name === 'Medicine')?.level ?? 0
              onRoll(`${npc.name} — Stabilize ${npc.name}`, amod, smod)
            }} style={{ padding: '2px 6px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Stabilize</button>
          )}
          {(displayStatus === 'dead' || displayStatus === 'mortally wounded') && (
            <button onClick={async () => {
              await supabase.from('campaign_npcs').update({ wp_current: wpMax, rp_current: rpMax, status: 'active', death_countdown: null, incap_rounds: null }).eq('id', npc.id)
            }} style={{ padding: '2px 6px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Restore</button>
          )}
          {onPlaceOnMap && (
            <button onClick={onPlaceOnMap} style={{ padding: '2px 6px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Map</button>
          )}
          {campaignId && (
            <button onClick={() => window.open(`/npc-sheet?c=${campaignId}&npc=${npc.id}`, `npc-${npc.id}`, 'width=600,height=800,menubar=no,toolbar=no')}
              title="Pop out to its own window"
              style={{ padding: '2px 6px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px', color: '#d48bd4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Popout</button>
          )}
          {onEdit && (
            <button onClick={onEdit} style={{ padding: '2px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Edit</button>
          )}
          <button onClick={onClose} style={{ padding: '2px 6px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Close</button>
        </div>
      </div>

      {/* RAPID + WP/RP on same row */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'flex-start' }}>
        {/* RAPID — clickable */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {(['RSN', 'ACU', 'PHY', 'INF', 'DEX'] as const).map(k => {
            const v = rapid[k] ?? 0
            return (
              <div key={k} onClick={() => handleAttrRoll(k)}
                style={{ width: '36px', background: v > 0 ? '#1a2e10' : '#242424', border: `1px solid ${v > 0 ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '2px', padding: '1px 0', textAlign: 'center', cursor: onRoll ? 'pointer' : 'default' }}>
                <div style={{ fontSize: '12px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: v > 0 ? '#7fc458' : '#d4cfc9' }}>{sgn(v)}</div>
              </div>
            )
          })}
        </div>
        {/* WP / RP compact */}
        <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <span style={{ fontSize: '12px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>WP</span>
              <span style={{ fontSize: '12px', color: '#c0392b', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{wpCurrent}/{wpMax}</span>
            </div>
            <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap' }}>
              {Array.from({ length: wpMax }).map((_, i) => (
                <div key={i} onClick={() => updateHealth('wp_current', i < wpCurrent ? i : i + 1)}
                  style={{ width: '9px', height: '9px', borderRadius: '50%', border: `1.5px solid ${i < wpCurrent ? '#c0392b' : '#3a3a3a'}`, background: i < wpCurrent ? '#c0392b' : 'transparent', cursor: 'pointer' }} />
              ))}
            </div>
            {wpCurrent === 0 && <div style={{ fontSize: '12px', color: '#c0392b', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>MORTALLY WOUNDED</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <span style={{ fontSize: '12px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>RP</span>
              <span style={{ fontSize: '12px', color: '#7ab3d4', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{rpCurrent}/{rpMax}</span>
            </div>
            <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap' }}>
              {Array.from({ length: rpMax }).map((_, i) => (
                <div key={i} onClick={() => updateHealth('rp_current', i < rpCurrent ? i : i + 1)}
                  style={{ width: '9px', height: '9px', borderRadius: '50%', border: `1.5px solid ${i < rpCurrent ? '#7ab3d4' : '#3a3a3a'}`, background: i < rpCurrent ? '#7ab3d4' : 'transparent', cursor: 'pointer' }} />
              ))}
            </div>
            {rpCurrent === 0 && wpCurrent > 0 && <div style={{ fontSize: '12px', color: '#7ab3d4', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>UNCONSCIOUS</div>}
          </div>
        </div>
      </div>

      {/* Skills — clickable */}
      {(skillEntries.length > 0 || onRoll) && (
        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginBottom: '4px' }}>
          {skillEntries.filter(s => s.name).map((s, i) => (
            <span key={i} onClick={() => handleSkillRoll(s.name, s.level)}
              style={{ fontSize: '13px', padding: '0 4px', background: s.level > 0 ? '#1a2e10' : '#242424', border: `1px solid ${s.level > 0 ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '2px', color: s.level > 0 ? '#7fc458' : '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', cursor: onRoll ? 'pointer' : 'default' }}>
              {s.name} {sgn(s.level)}
            </span>
          ))}
          {onRoll && (() => {
            const existing = new Set(skillEntries.map(s => s.name))
            const combatSkills = [
              { name: 'Melee Combat', label: 'Melee' },
              { name: 'Ranged Combat', label: 'Ranged' },
              { name: 'Demolitions', label: 'Demolitions' },
            ].filter(s => !existing.has(s.name))
            return combatSkills.map(s => (
              <span key={s.name} onClick={() => handleSkillRoll(s.name, getSkillLevel(s.name))}
                style={{ fontSize: '13px', padding: '0 4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '2px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>
                {s.label} {sgn(getSkillLevel(s.name))}
              </span>
            ))
          })()}
        </div>
      )}

      {/* GM Notes — truncated */}
      {npc.notes && (
        <div style={{ fontSize: '12px', color: '#cce0f5', fontStyle: 'italic', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.notes}</div>
      )}

      {/* Combat: unarmed + all equipment weapons */}
      {onRoll && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          <button onClick={() => {
            const phyAmod = rapid.PHY ?? 0
            const smod = getSkillLevel('Unarmed Combat')
            onRoll(`${npc.name} — Unarmed`, phyAmod, smod, { weaponName: 'Unarmed', damage: '1d3', rpPercent: 100, conditionCmod: 0 })
          }}
            style={{ padding: '2px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
            👊 Unarmed
          </button>
          {w && (
            <button onClick={handleWeaponAttack}
              style={{ padding: '2px 6px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
              ⚔️ {w.name} ({w.damage})
            </button>
          )}
          {(npc.equipment ?? []).map((eq, i) => {
            const eqWeapon = getWeaponByName(eq.name)
            if (!eqWeapon) return null
            // Skip if this is the same weapon already shown from skills.weapon
            if (w && eqWeapon.name === w.name) return null
            const isMelee = eqWeapon.category === 'melee'
            const attrKey = isMelee ? 'PHY' : 'DEX'
            const amod = rapid[attrKey] ?? 0
            const smod = getSkillLevel(eqWeapon.skill)
            let traitCmod = 0
            let traitLabel = ''
            const cumbersome = getTraitValue(eqWeapon.traits, 'Cumbersome')
            if (cumbersome !== null) { const deficit = cumbersome - (rapid.PHY ?? 0); if (deficit > 0) { traitCmod -= deficit; traitLabel = `Cumbersome -${deficit}` } }
            const unwieldy = getTraitValue(eqWeapon.traits, 'Unwieldy')
            if (unwieldy !== null) { const deficit = unwieldy - (rapid.DEX ?? 0); if (deficit > 0) { traitCmod -= deficit; traitLabel = traitLabel ? `${traitLabel}, Unwieldy -${deficit}` : `Unwieldy -${deficit}` } }
            return (
              <button key={i} onClick={() => onRoll!(`${npc.name} — Attack (${eqWeapon.name})`, amod, smod, { weaponName: eqWeapon.name, damage: eqWeapon.damage, rpPercent: eqWeapon.rpPercent, conditionCmod: traitCmod, traitCmod, traitLabel, traits: eqWeapon.traits })}
                style={{ padding: '2px 6px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                ⚔️ {eqWeapon.name} ({eqWeapon.damage})
              </button>
            )
          })}
        </div>
      )}
      {enlarged && npc.portrait_url && (
        <div onClick={() => setEnlarged(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={npc.portrait_url} alt={npc.name} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '4px', border: '2px solid #c0392b' }} />
        </div>
      )}
    </div>
  )
}
