'use client'
import { useEffect, useState } from 'react'
import { CampaignNpc } from './NpcRoster'
import { createClient } from '../lib/supabase-browser'

// Player-facing NPC card — strictly read-only. GM-only data (RAPID stats,
// skills, weapon breakdowns, equipment, HP pip dots, edit/publish/restore
// actions) stays hidden. Players see portrait, name, category badge, and a
// derived status (healthy / unconscious / mortally wounded / dead) so they
// can read the tactical situation without seeing the GM's bookkeeping.
//
// First Impression: when `viewingCharacterId` is provided, the card shows
// this PC's relationship_cmod with the NPC — the lingering effect of any
// prior First Impression roll. Positive = NPC likes them, negative =
// wary/hostile, 0 = never met or neutral.
//
// Recruit: when `onRecruit` is provided, a Recruit button appears next
// to the status badge. Clicking it opens the Recruit modal pre-populated
// with this NPC as the target. Hidden when the NPC is dead/mortally
// wounded — you can't recruit a corpse.

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
}

interface Props {
  npc: CampaignNpc
  onClose: () => void
  // PC currently viewing this card. Drives First Impression lookup.
  viewingCharacterId?: string
  // If provided, shows a "Recruit" button right of the status badge.
  onRecruit?: () => void
}

export default function PlayerNpcCard({ npc, onClose, viewingCharacterId, onRecruit }: Props) {
  const supabase = createClient()
  const [enlarged, setEnlarged] = useState(false)
  const [cmod, setCmod] = useState<number | null>(null)

  useEffect(() => {
    if (!viewingCharacterId) { setCmod(null); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('npc_relationships')
        .select('relationship_cmod')
        .eq('npc_id', npc.id)
        .eq('character_id', viewingCharacterId)
        .maybeSingle()
      if (cancelled) return
      setCmod((data as any)?.relationship_cmod ?? null)
    })()
    return () => { cancelled = true }
  }, [npc.id, viewingCharacterId])

  const wpMax = npc.wp_max ?? 10
  const rpMax = npc.rp_max ?? 6
  const wpCurrent = npc.wp_current ?? wpMax
  const rpCurrent = npc.rp_current ?? rpMax

  const isDead = wpCurrent === 0 && npc.death_countdown != null && npc.death_countdown <= 0
  const isMortal = wpCurrent === 0 && !isDead
  const isUnconscious = rpCurrent === 0 && wpCurrent > 0
  const displayStatus = npc.status === 'dead' || isDead ? 'dead'
    : isMortal ? 'mortally wounded'
    : isUnconscious ? 'unconscious'
    : 'active'

  const tc = TYPE_COLORS[npc.npc_type ?? ''] ?? TYPE_COLORS.goon
  const sc = STATUS_COLORS[displayStatus] ?? STATUS_COLORS.active

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          onClick={() => npc.portrait_url && setEnlarged(true)}
          style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: npc.portrait_url ? 'zoom-in' : 'default' }}>
          {npc.portrait_url ? (
            <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>
              {npc.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
            {npc.npc_type && (
              <span style={{ fontSize: '12px', padding: '1px 5px', borderRadius: '2px', background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{npc.npc_type}</span>
            )}
            <span style={{ fontSize: '12px', padding: '1px 5px', borderRadius: '2px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{displayStatus}</span>
            {/* Recruit button — right of the status badge per spec.
                Hidden for dead/mortal since you can't recruit a corpse. */}
            {onRecruit && displayStatus !== 'dead' && displayStatus !== 'mortally wounded' && (
              <button onClick={onRecruit}
                style={{ fontSize: '12px', padding: '1px 8px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}
                title="Open the Recruit modal with this NPC as the target">
                🤝 Recruit
              </button>
            )}
            {/* First Impression CMod — shown when the viewing PC has
                a recorded relationship with this NPC. +N green,
                −N red, 0 = not yet met (suppressed). */}
            {cmod != null && cmod !== 0 && (
              <span
                title={`Your First Impression with ${npc.name}: ${cmod > 0 ? '+' : ''}${cmod} CMod on social rolls`}
                style={{ fontSize: '12px', padding: '1px 5px', borderRadius: '2px',
                  background: cmod > 0 ? '#1a2e10' : '#2a1210',
                  border: `1px solid ${cmod > 0 ? '#2d5a1b' : '#c0392b'}`,
                  color: cmod > 0 ? '#7fc458' : '#f5a89a',
                  fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                1st {cmod > 0 ? `+${cmod}` : cmod}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ padding: '3px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', flexShrink: 0 }}>Close</button>
      </div>

      {enlarged && npc.portrait_url && (
        <div onClick={() => setEnlarged(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={npc.portrait_url} alt={npc.name} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '4px', border: '2px solid #c0392b' }} />
        </div>
      )}
    </div>
  )
}
