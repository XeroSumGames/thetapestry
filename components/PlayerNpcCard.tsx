'use client'
import { useEffect, useState } from 'react'
import { CampaignNpc, getNpcRingColor } from './NpcRoster'
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
//
// Recruit state badge: on mount we fetch the NPC's latest community
// membership + latest recruitment roll_log entry and render one of:
//   - active  → green chip "<ROLE> IN <COMMUNITY>" (Recruit button hidden)
//   - left    → amber chip "LEFT <COMMUNITY>" + Recruit button (re-try OK)
//   - failed  → red chip "RECRUIT FAILED" + Recruit button (re-try OK)
//   - none    → just the Recruit button (current behavior)
// This replaces the always-green Recruit button that persisted on
// already-recruited or recently-failed NPCs.

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

type RecruitState =
  | { kind: 'active'; role: string; communityName: string }
  | { kind: 'left'; leftReason: string | null; communityName: string }
  | { kind: 'failed'; outcome: string }
  | null

export default function PlayerNpcCard({ npc, onClose, viewingCharacterId, onRecruit }: Props) {
  const supabase = createClient()
  const [enlarged, setEnlarged] = useState(false)
  const [cmod, setCmod] = useState<number | null>(null)
  const [recruitState, setRecruitState] = useState<RecruitState>(null)
  // Bumped by the `tapestry:recruit-updated` window event so the
  // recruit-state effect below re-runs without a full page refresh.
  // The emit sites live in app/stories/[id]/table/page.tsx inside
  // executeRecruitRoll / rerollRecruitDie / the "Take as Apprentice"
  // button.
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.npcId === npc.id) setRefreshTick(t => t + 1)
    }
    if (typeof window === 'undefined') return
    window.addEventListener('tapestry:recruit-updated', handler)
    return () => window.removeEventListener('tapestry:recruit-updated', handler)
  }, [npc.id])

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

  // Recruit-state lookup. Runs on every card open. Cheap: two
  // small queries, neither returns more than 1 row.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // 1. Latest community_members row for this NPC (active takes
      //    precedence over left). Only an NPC-backed row counts —
      //    PC rows don't belong on a "recruit" surface.
      const { data: memRows } = await supabase
        .from('community_members')
        .select('recruitment_type, left_at, left_reason, communities!inner(id, name)')
        .eq('npc_id', npc.id)
        .order('joined_at', { ascending: false })
        .limit(1)
      if (cancelled) return
      const mem = (memRows ?? [])[0] as any
      if (mem) {
        const communityName = Array.isArray(mem.communities)
          ? (mem.communities[0]?.name ?? '')
          : (mem.communities?.name ?? '')
        if (!mem.left_at) {
          setRecruitState({ kind: 'active', role: String(mem.recruitment_type ?? 'member'), communityName })
          return
        }
        // They were a member but left. Fall through — we still want
        // to show the "left" chip alongside the Recruit button.
        setRecruitState({ kind: 'left', leftReason: mem.left_reason ?? null, communityName })
        return
      }

      // 2. No membership ever — check for the latest recruitment
      //    attempt (failures don't create community_members rows
      //    but do log a 🤝-label row with damage_json.npcId set).
      const { data: rollRows } = await supabase
        .from('roll_log')
        .select('damage_json, created_at')
        .contains('damage_json', { npcId: npc.id })
        .order('created_at', { ascending: false })
        .limit(1)
      if (cancelled) return
      const roll = (rollRows ?? [])[0] as any
      const outcome = roll?.damage_json?.rollOutcome
      const isRecruitAttempt = roll?.damage_json?.approach === 'cohort'
        || roll?.damage_json?.approach === 'conscript'
        || roll?.damage_json?.approach === 'convert'
      if (roll && outcome && isRecruitAttempt) {
        setRecruitState({ kind: 'failed', outcome: String(outcome) })
        return
      }
      setRecruitState(null)
    })()
    return () => { cancelled = true }
  }, [npc.id, refreshTick])

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
        {(() => {
          const ring = getNpcRingColor(npc.disposition)
          return (
            <div
              onClick={() => npc.portrait_url && setEnlarged(true)}
              style={{ width: '48px', height: '48px', borderRadius: '50%', background: ring.bg, border: `2px solid ${ring.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: npc.portrait_url ? 'zoom-in' : 'default' }}>
              {npc.portrait_url ? (
                <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '14px', fontWeight: 700, color: ring.color, fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {npc.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              )}
            </div>
          )
        })()}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
            {npc.npc_type && (
              <span style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px', background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{npc.npc_type}</span>
            )}
            <span style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{displayStatus}</span>
            {/* Recruit state — right of the status badge. Branches
                between chip (active member) / chip + button (left or
                failed) / button (no history). Dead/mortal NPCs get
                nothing since you can't recruit a corpse. */}
            {displayStatus !== 'dead' && displayStatus !== 'mortally wounded' && (
              <>
                {recruitState?.kind === 'active' && (
                  <span
                    title={`${npc.name} is a ${recruitState.role} in ${recruitState.communityName}.`}
                    style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>
                    💚 {recruitState.role}{recruitState.communityName ? ` · ${recruitState.communityName}` : ''}
                  </span>
                )}
                {recruitState?.kind === 'left' && onRecruit && (
                  <>
                    <span
                      title={`${npc.name} was in ${recruitState.communityName} but left${recruitState.leftReason ? ` (${recruitState.leftReason})` : ''}.`}
                      style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>
                      ↩ Left{recruitState.communityName ? ` · ${recruitState.communityName}` : ''}
                    </span>
                    <button onClick={onRecruit}
                      style={{ fontSize: '13px', padding: '1px 8px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}
                      title="Re-recruit — the NPC left their prior community and can be recruited again.">
                      🤝 Recruit
                    </button>
                  </>
                )}
                {recruitState?.kind === 'failed' && onRecruit && (
                  <>
                    <span
                      title={`Last recruitment attempt: ${recruitState.outcome}.`}
                      style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: '#2a1210', border: '1px solid #c0392b', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>
                      ✗ Failed · {recruitState.outcome}
                    </span>
                    <button onClick={onRecruit}
                      style={{ fontSize: '13px', padding: '1px 8px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}
                      title="Try again — a failed recruit doesn't lock the NPC out.">
                      🤝 Retry
                    </button>
                  </>
                )}
                {recruitState === null && onRecruit && (
                  <button onClick={onRecruit}
                    style={{ fontSize: '13px', padding: '1px 8px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}
                    title="Open the Recruit modal with this NPC as the target">
                    🤝 Recruit
                  </button>
                )}
              </>
            )}
            {/* First Impression CMod — shown when the viewing PC has
                a recorded relationship with this NPC. +N green,
                −N red, 0 = not yet met (suppressed). */}
            {cmod != null && cmod !== 0 && (
              <span
                title={`Your First Impression with ${npc.name}: ${cmod > 0 ? '+' : ''}${cmod} CMod on social rolls`}
                style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px',
                  background: cmod > 0 ? '#1a2e10' : '#2a1210',
                  border: `1px solid ${cmod > 0 ? '#2d5a1b' : '#c0392b'}`,
                  color: cmod > 0 ? '#7fc458' : '#f5a89a',
                  fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                1st {cmod > 0 ? `+${cmod}` : cmod}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ padding: '3px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', flexShrink: 0 }}>Close</button>
      </div>

      {enlarged && npc.portrait_url && (
        <div onClick={() => setEnlarged(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={npc.portrait_url} alt={npc.name} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '4px', border: '2px solid #c0392b' }} />
        </div>
      )}
    </div>
  )
}
