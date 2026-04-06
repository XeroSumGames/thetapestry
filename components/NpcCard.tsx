'use client'
import { CampaignNpc } from './NpcRoster'

const RAPID_LABELS: Record<number, string> = {
  [-2]: 'Diminished', [-1]: 'Weak', 0: 'Average', 1: 'Good',
  2: 'Strong', 3: 'Exceptional', 4: 'Human Peak',
}

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
  const rapid = { RSN: npc.reason, ACU: npc.acumen, PHY: npc.physicality, INF: npc.influence, DEX: npc.dexterity }
  const tc = TYPE_COLORS[npc.npc_type ?? ''] ?? TYPE_COLORS.goon
  const sc = STATUS_COLORS[npc.status] ?? STATUS_COLORS.active

  // Parse skills from stored data
  const skillEntries: { name: string; level: number }[] = Array.isArray(npc.skills?.entries) ? npc.skills.entries : []
  const skillText: string = npc.skills?.text ?? ''

  // Check if NPC has combat skills
  const hasRanged = skillEntries.some(s => s.name === 'Ranged Combat' && s.level > 0)
  const hasMelee = skillEntries.some(s => s.name === 'Melee Combat' && s.level > 0)
  const hasUnarmed = skillEntries.some(s => s.name === 'Unarmed Combat' && s.level > 0)

  function getSkillLevel(skillName: string): number {
    return skillEntries.find(s => s.name === skillName)?.level ?? 0
  }

  function handleCombatRoll(skillName: string, attrKey: 'PHY' | 'DEX' | 'ACU', weaponContext?: { weaponName: string; damage: string; rpPercent: number; conditionCmod: number }) {
    if (!onRoll) return
    const amod = rapid[attrKey] ?? 0
    const smod = getSkillLevel(skillName)
    onRoll(`${npc.name} — ${skillName}`, amod, smod, weaponContext)
  }

  const btnStyle = (bg: string, border: string, color: string) => ({
    padding: '6px 10px', background: bg, border: `1px solid ${border}`,
    borderRadius: '3px', color, fontSize: '14px', cursor: 'pointer' as const,
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase' as const, flex: 1, textAlign: 'center' as const,
  })

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '1rem 1.25rem' }}>

        {/* Header: portrait + name + type + status + buttons */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {npc.portrait_url ? (
              <img src={npc.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>
                {npc.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>{npc.name}</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              {npc.npc_type && <span style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
              <span style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.status}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button onClick={onEdit} style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Edit</button>
            <button onClick={onClose} style={{ padding: '5px 12px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Close</button>
          </div>
        </div>

        {/* Motivation / Complication / Words */}
        <div style={{ display: 'flex', fontSize: '13px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            {(npc as any).motivation && <span><span style={{ color: '#7fc458' }}>Motivation:</span> {(npc as any).motivation} &nbsp;</span>}
            {(npc as any).complication && <span><span style={{ color: '#c0392b' }}>Complication:</span> {(npc as any).complication}</span>}
          </div>
          {(npc as any).three_words?.length > 0 && (
            <div style={{ color: '#EF9F27', flexShrink: 0 }}>{(npc as any).three_words.filter(Boolean).join(' · ')}</div>
          )}
        </div>

        {/* RAPID */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {(['RSN', 'ACU', 'PHY', 'INF', 'DEX'] as const).map(k => {
            const v = rapid[k] ?? 0
            return (
              <div key={k} style={{ flex: 1, background: v > 0 ? '#1a2e10' : '#242424', border: `1px solid ${v > 0 ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', padding: '4px 2px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: v > 0 ? '#7fc458' : '#d4cfc9' }}>{sgn(v)}</div>
              </div>
            )
          })}
        </div>

        {/* Skills */}
        {(skillEntries.length > 0 || skillText) && (
          <div style={{ marginBottom: '8px' }}>
            {skillEntries.length > 0 ? (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {skillEntries.filter(s => s.level > 0 || s.name).map((s, i) => (
                  <span key={i} style={{ fontSize: '13px', padding: '2px 6px', background: s.level > 0 ? '#1a2e10' : '#242424', border: `1px solid ${s.level > 0 ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: s.level > 0 ? '#7fc458' : '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {s.name} {sgn(s.level)}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#d4cfc9' }}>{skillText}</div>
            )}
          </div>
        )}

        {/* GM Notes */}
        {npc.notes && (
          <div style={{ fontSize: '13px', color: '#cce0f5', fontStyle: 'italic', marginBottom: '8px', padding: '6px 8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
            {npc.notes}
          </div>
        )}

        {/* Combat buttons */}
        {onRoll && (
          <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {/* Unarmed — always available */}
              <button onClick={() => handleCombatRoll('Unarmed Combat', 'PHY', { weaponName: 'Unarmed', damage: '1d3', rpPercent: 100, conditionCmod: 0 })}
                style={btnStyle('#242424', '#3a3a3a', '#d4cfc9')}>
                👊 Unarmed
              </button>
              {/* Melee — if they have it */}
              {hasMelee && (
                <button onClick={() => handleCombatRoll('Melee Combat', 'PHY')}
                  style={btnStyle('#2a1210', '#c0392b', '#f5a89a')}>
                  ⚔️ Melee ({sgn(getSkillLevel('Melee Combat'))})
                </button>
              )}
              {/* Ranged — if they have it */}
              {hasRanged && (
                <button onClick={() => handleCombatRoll('Ranged Combat', 'DEX')}
                  style={btnStyle('#7a1f16', '#c0392b', '#f5a89a')}>
                  🎯 Ranged ({sgn(getSkillLevel('Ranged Combat'))})
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
