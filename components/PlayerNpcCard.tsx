'use client'
import { useEffect, useState } from 'react'
import { CampaignNpc, getNpcRingColor } from './NpcRoster'
import { createClient } from '../lib/supabase-browser'
import { ModalBackdrop, Z_INDEX } from '../lib/style-helpers'

interface LootItem {
  name: string
  qty: number
  custom?: boolean
  enc?: number
  rarity?: string
  notes?: string
}

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
  // When this NPC is the viewing PC's Apprentice and the wizard hasn't
  // run yet, the parent supplies this callback to mount a "Set Up
  // Apprentice" trigger. Player-side counterpart of the same prop on
  // NpcCard. Parent owns the wizard modal state.
  onSetupApprentice?: () => void
  // Phase: First Impression skip-the-picker (2026-05-01). When the
  // parent provides this callback, a "First Impression" button shows
  // on the card header — clicking it fires the roll directly via
  // triggerFirstImpression with the viewing PC + this NPC pre-set.
  // Hidden when there's already a recorded First Impression
  // (cmod != null && cmod !== 0) since a second roll on the same pair
  // overwrites the first; suppress to avoid accidental clobbering.
  onFirstImpression?: () => void
}

type RecruitState =
  | { kind: 'active'; role: string; communityName: string }
  | { kind: 'left'; leftReason: string | null; communityName: string }
  | { kind: 'failed'; outcome: string }
  | null

export default function PlayerNpcCard({ npc, onClose, viewingCharacterId, onRecruit, onSetupApprentice, onFirstImpression }: Props) {
  const supabase = createClient()
  const [enlarged, setEnlarged] = useState(false)
  const [cmod, setCmod] = useState<number | null>(null)
  const [recruitState, setRecruitState] = useState<RecruitState>(null)
  // Player-private NPC notes. Scoped to (character_id, npc_id) so a
  // user with multiple PCs in one campaign keeps separate threads
  // per PC. The GM doesn't see these — they have campaign_npcs.notes
  // for their own bookkeeping.
  const [notes, setNotes] = useState<string>('')
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [notesDirty, setNotesDirty] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)

  // ── Search Remains (player-side loot) ──
  // Lazily-loaded NPC inventory — only fetched when the looter opens the
  // panel. Modifies via the loot_npc_item SECURITY DEFINER RPC so the
  // player doesn't need write access to campaign_npcs / other PCs'
  // characters rows. Each Take click fires one RPC; loot is logged
  // server-side to roll_log so the GM sees what was pulled off the body.
  const [showLoot, setShowLoot] = useState(false)
  const [lootItems, setLootItems] = useState<LootItem[] | null>(null)
  const [lootError, setLootError] = useState<string | null>(null)
  const [takingItem, setTakingItem] = useState<string | null>(null)
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

  // Load the viewing PC's existing note (if any) for this NPC. Reset
  // dirty state on each (character, npc) switch so the textarea starts
  // clean. We use maybeSingle since most (character, npc) pairs won't
  // have a row yet — the unique constraint guarantees at most one.
  useEffect(() => {
    if (!viewingCharacterId) { setNotes(''); setNotesLoaded(false); return }
    let cancelled = false
    setNotesLoaded(false)
    ;(async () => {
      const { data } = await supabase
        .from('player_npc_notes')
        .select('note')
        .eq('npc_id', npc.id)
        .eq('character_id', viewingCharacterId)
        .maybeSingle()
      if (cancelled) return
      setNotes((data as any)?.note ?? '')
      setNotesDirty(false)
      setNotesLoaded(true)
    })()
    return () => { cancelled = true }
  }, [npc.id, viewingCharacterId])

  async function saveNotes() {
    if (!viewingCharacterId || !notesDirty) return
    setNotesSaving(true)
    // Upsert keyed on the unique (character_id, npc_id) pair; the
    // trigger updates updated_at on every UPDATE so we don't have to
    // pass it explicitly.
    const { error } = await supabase
      .from('player_npc_notes')
      .upsert(
        { character_id: viewingCharacterId, npc_id: npc.id, note: notes },
        { onConflict: 'character_id,npc_id' },
      )
    if (error) {
      console.error('[PlayerNpcCard] notes save failed:', error.message)
    } else {
      setNotesDirty(false)
    }
    setNotesSaving(false)
  }

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

  // Loot is allowed when the NPC is dead / mortally wounded /
  // unconscious. Active NPCs keep their stuff. (RPC enforces this
  // server-side too — the UI gate is just to hide the button when
  // it'd error.)
  const canLoot = displayStatus !== 'active' && !!viewingCharacterId

  async function openLoot() {
    setLootError(null)
    setShowLoot(true)
    setLootItems(null)
    // Re-fetch the NPC's inventory fresh on each open so a player
    // who took an item earlier in the session sees the latest list.
    const { data, error } = await supabase
      .from('campaign_npcs')
      .select('inventory')
      .eq('id', npc.id)
      .maybeSingle()
    if (error) {
      setLootError(error.message)
      setLootItems([])
      return
    }
    const inv = (data as any)?.inventory
    setLootItems(Array.isArray(inv) ? (inv as LootItem[]) : [])
  }

  async function takeItem(item: LootItem) {
    if (!viewingCharacterId) {
      setLootError('No character selected as the looter.')
      return
    }
    const tag = `${item.name}:${item.custom ? 'c' : 'std'}`
    setTakingItem(tag)
    setLootError(null)
    const { data, error } = await supabase.rpc('loot_npc_item', {
      p_npc_id: npc.id,
      p_character_id: viewingCharacterId,
      p_item_name: item.name,
      p_item_custom: !!item.custom,
      p_qty: 1,
    })
    setTakingItem(null)
    if (error) {
      setLootError(error.message)
      return
    }
    const result = data as { ok: boolean; error?: string; taken?: number } | null
    if (!result?.ok) {
      setLootError(result?.error ?? 'Loot failed (no result).')
      return
    }
    // Optimistic local decrement so the panel reflects the take
    // immediately. Re-opening will fetch fresh anyway.
    setLootItems(prev => {
      if (!prev) return prev
      return prev
        .map(i => i.name === item.name && !!i.custom === !!item.custom
          ? { ...i, qty: i.qty - (result.taken ?? 1) }
          : i)
        .filter(i => i.qty > 0)
    })
  }

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {(() => {
          const ring = getNpcRingColor(npc)
          return (
            <div
              onClick={() => npc.portrait_url && setEnlarged(true)}
              style={{ width: '48px', height: '48px', borderRadius: '50%', background: ring.bg, border: `2px solid ${ring.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: npc.portrait_url ? 'zoom-in' : 'default' }}>
              {npc.portrait_url ? (
                <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '14px', fontWeight: 700, color: ring.color, fontFamily: 'Carlito, sans-serif' }}>
                  {npc.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              )}
            </div>
          )
        })()}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '17px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
            {npc.npc_type && (
              <span style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px', background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{npc.npc_type}</span>
            )}
            <span style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{displayStatus}</span>
            {/* Recruit state — right of the status badge. Branches
                between chip (active member) / chip + button (left or
                failed) / button (no history). Dead/mortal NPCs get
                nothing since you can't recruit a corpse. */}
            {displayStatus !== 'dead' && displayStatus !== 'mortally wounded' && (
              <>
                {recruitState?.kind === 'active' && (
                  <span
                    title={`${npc.name} is a ${recruitState.role} in ${recruitState.communityName}.`}
                    style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>
                    💚 {recruitState.role}{recruitState.communityName ? ` · ${recruitState.communityName}` : ''}
                  </span>
                )}
                {recruitState?.kind === 'left' && onRecruit && (
                  <>
                    <span
                      title={`${npc.name} was in ${recruitState.communityName} but left${recruitState.leftReason ? ` (${recruitState.leftReason})` : ''}.`}
                      style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>
                      ↩ Left{recruitState.communityName ? ` · ${recruitState.communityName}` : ''}
                    </span>
                    <button onClick={onRecruit}
                      style={{ fontSize: '13px', padding: '1px 8px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}
                      title="Re-recruit — the NPC left their prior community and can be recruited again.">
                      🤝 Recruit
                    </button>
                  </>
                )}
                {recruitState?.kind === 'failed' && onRecruit && (
                  <>
                    <span
                      title={`Last recruitment attempt: ${recruitState.outcome}.`}
                      style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: '#2a1210', border: '1px solid #c0392b', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>
                      ✗ Failed · {recruitState.outcome}
                    </span>
                    <button onClick={onRecruit}
                      style={{ fontSize: '13px', padding: '1px 8px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}
                      title="Try again — a failed recruit doesn't lock the NPC out.">
                      🤝 Retry
                    </button>
                  </>
                )}
                {recruitState === null && onRecruit && (
                  <button onClick={onRecruit}
                    style={{ fontSize: '13px', padding: '1px 8px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}
                    title="Open the Recruit modal with this NPC as the target">
                    🤝 Recruit
                  </button>
                )}
              </>
            )}
            {/* Apprentice creation wizard trigger — only rendered when
                this NPC is the viewing PC's Apprentice and the wizard
                hasn't run yet. Lavender styling matches the Apprentice
                cues elsewhere. Parent decides visibility. */}
            {onSetupApprentice && (
              <button onClick={onSetupApprentice}
                title="This Apprentice is ready to be set up — pick a Paradigm and spend the 3 CDP RAPID + 5 CDP skill budget."
                style={{ fontSize: '13px', padding: '1px 8px', borderRadius: '2px', background: '#2a102a', border: '1px solid #8b2e8b', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}>
                ⭐ Set Up Apprentice
              </button>
            )}
            {/* Search Remains — lootable only when the NPC is
                dead / mortally wounded / unconscious. Hidden when
                the looter doesn't have a character ID set (e.g.
                ghost / out-of-campaign viewer). */}
            {canLoot && (
              <button onClick={openLoot}
                title={`Search ${npc.name} for items you can take.`}
                style={{ fontSize: '13px', padding: '1px 8px', borderRadius: '2px', background: '#2a1210', border: '1px solid #c0392b', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}>
                🎒 Search Remains
              </button>
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
                  fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                1st {cmod > 0 ? `+${cmod}` : cmod}
              </span>
            )}
            {/* First Impression — quick-fire button that skips the
                special-check picker. Hidden when the viewing PC has
                already rolled (cmod != null && cmod !== 0) so a
                misclick doesn't overwrite the existing relationship.
                Active state: button visible when onFirstImpression is
                wired AND no recorded relationship exists yet. */}
            {onFirstImpression && viewingCharacterId && (cmod == null || cmod === 0) && (
              <button onClick={onFirstImpression}
                title={`Roll a First Impression on ${npc.name} — INF + best of Manipulation / Streetwise / Psychology.`}
                style={{ fontSize: '13px', padding: '1px 8px', borderRadius: '2px', background: '#0f2035', border: '1px solid #1a3a5c', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', fontWeight: 600 }}>
                🤝 First Impression
              </button>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ padding: '3px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', flexShrink: 0 }}>Close</button>
      </div>

      {/* Public description — GM-authored player-visible blurb on
          campaign_npcs.public_description. Renders when the GM has
          written one; absent until then so unset NPCs stay clean. */}
      {(npc as any).public_description && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #2e2e2e', fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {(npc as any).public_description}
        </div>
      )}

      {/* Player NPC notes — private to the viewing PC. Saves on blur
          via upsert keyed on (character_id, npc_id). The GM doesn't
          see these; they have campaign_npcs.notes for their own
          bookkeeping. Hidden until the load completes so the textarea
          doesn't flash empty before the existing note appears. */}
      {viewingCharacterId && notesLoaded && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #2e2e2e' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              My Notes
            </span>
            <span style={{ fontSize: '13px', color: notesSaving ? '#7ab3d4' : notesDirty ? '#EF9F27' : '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {notesSaving ? 'Saving…' : notesDirty ? 'Unsaved' : 'Saved'}
            </span>
          </div>
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setNotesDirty(true) }}
            onBlur={() => { void saveNotes() }}
            placeholder="What does your character think of this NPC? Lies they told. Debts owed. Suspicions."
            rows={3}
            style={{
              width: '100%', resize: 'vertical', boxSizing: 'border-box',
              padding: '6px 8px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px',
              color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5,
            }}
          />
        </div>
      )}

      {enlarged && npc.portrait_url && (
        <div onClick={() => setEnlarged(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={npc.portrait_url} alt={npc.name} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '4px', border: '2px solid #c0392b' }} />
        </div>
      )}

      {/* Loot panel overlay — opens on Search Remains click. Calls
          the loot_npc_item SECURITY DEFINER RPC for each Take, which
          atomically decrements the NPC's inventory + appends to the
          looter's PC inventory + writes a roll_log audit row. */}
      {showLoot && (
        <ModalBackdrop onClose={() => { setShowLoot(false); setLootError(null) }} zIndex={Z_INDEX.criticalModal} opacity={0.85} padding="1rem">
          <div
            style={{ background: '#1a1a1a', border: '1px solid #c0392b', borderRadius: '4px', padding: '1.25rem', width: '380px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Search Remains</div>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '17px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px' }}>{npc.name}</div>
            {lootError && (
              <div style={{ marginBottom: '10px', padding: '8px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
                {lootError}
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
              {lootItems == null ? (
                <div style={{ color: '#cce0f5', fontSize: '13px', textAlign: 'center', padding: '1rem', fontFamily: 'Carlito, sans-serif' }}>Searching…</div>
              ) : lootItems.length === 0 ? (
                <div style={{ color: '#cce0f5', fontSize: '13px', textAlign: 'center', padding: '1rem', fontFamily: 'Carlito, sans-serif' }}>Nothing left to take.</div>
              ) : (
                lootItems.map((item, idx) => {
                  const tag = `${item.name}:${item.custom ? 'c' : 'std'}`
                  const taking = takingItem === tag
                  return (
                    <div key={`${tag}_${idx}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '6px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                          {item.name}{item.qty > 1 && <span style={{ color: '#7ab3d4', marginLeft: '4px' }}>×{item.qty}</span>}
                        </div>
                        {(item.rarity || item.notes) && (
                          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginTop: '2px' }}>
                            {item.rarity && <span style={{ marginRight: '6px' }}>{item.rarity}</span>}
                            {item.notes}
                          </div>
                        )}
                      </div>
                      <button onClick={() => takeItem(item)} disabled={taking}
                        style={{ padding: '4px 12px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: taking ? 'wait' : 'pointer', opacity: taking ? 0.5 : 1, fontWeight: 600 }}>
                        {taking ? 'Taking…' : 'Take'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            <button onClick={() => { setShowLoot(false); setLootError(null) }}
              style={{ padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}
