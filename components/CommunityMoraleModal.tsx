'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import {
  classifyRoll,
  outcomeToMoraleCmod,
  outcomeToDeparturePct,
  isMoraleFailure,
  computeEnoughHandsCmod,
  computeClearVoiceCmod,
  computeSafetyCmod,
  pickDeparturesWeighted,
  formatCmod,
  type CommunityMemberLite,
} from '../lib/community-logic'

// Phase C — Weekly Morale Check modal. Single-button flow: GM fills in
// ad-hoc CMods / adjusts A/S mods if needed, clicks "Run Weekly Check",
// modal rolls Fed → Clothed → Morale sequentially and shows the result.
// Persistence is all-at-once on the Result stage's "Finalize" button so
// a cancelled/closed modal leaves nothing partial in the DB.

interface Community {
  id: string
  campaign_id: string
  name: string
  status: 'forming' | 'active' | 'dissolved'
  leader_npc_id: string | null
  leader_user_id: string | null
  consecutive_failures: number
  week_number: number
}

interface Member {
  id: string
  community_id: string
  npc_id: string | null
  character_id: string | null
  role: 'gatherer' | 'maintainer' | 'safety' | 'unassigned' | 'assigned'
  recruitment_type: 'cohort' | 'conscript' | 'convert' | 'apprentice' | 'founder' | 'member'
  apprentice_of_character_id: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  community: Community
  members: Member[]
  memberNameById: Map<string, string>  // for pretty departure list — member.id → display name
  campaignId: string
  userId: string | null
  onComplete: () => void
}

type Stage = 'form' | 'result'

interface RollResult {
  die1: number
  die2: number
  amod: number
  smod: number
  cmod: number
  total: number
  outcome: string
}

interface FinalResult {
  fed: RollResult
  clothed: RollResult
  morale: RollResult
  moraleSlots: {
    mood: number
    fed: number
    clothed: number
    enoughHands: number
    clearVoice: number
    safety: number
    additional: number
  }
  newWeek: number
  nextMoraleCmod: number
  consecutiveFailuresAfter: number
  willDissolve: boolean
  departureIds: string[]
  membersBefore: number
  membersAfter: number
}

function roll2d6(): { die1: number; die2: number } {
  return {
    die1: Math.floor(Math.random() * 6) + 1,
    die2: Math.floor(Math.random() * 6) + 1,
  }
}

export default function CommunityMoraleModal({
  open, onClose, community, members, memberNameById,
  campaignId, userId, onComplete,
}: Props) {
  const supabase = createClient()

  // Auto-suggest CMod slots for Morale. Recomputed when members/community
  // change (open → compute once, then frozen until modal closes unless
  // roster changes from a parent re-render).
  const memberLite = useMemo<CommunityMemberLite[]>(() => members.map(m => ({
    id: m.id, npc_id: m.npc_id, character_id: m.character_id,
    role: m.role, recruitment_type: m.recruitment_type,
    apprentice_of_character_id: m.apprentice_of_character_id,
  })), [members])

  const autoEnoughHands = useMemo(() => computeEnoughHandsCmod(memberLite), [memberLite])
  const autoClearVoice = useMemo(() => computeClearVoiceCmod(community), [community])
  const autoSafety = useMemo(() => computeSafetyCmod(memberLite), [memberLite])

  // State
  const [stage, setStage] = useState<Stage>('form')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  // Prior check's cmod_for_next → "Mood Around The Campfire"
  const [moodFromPrior, setMoodFromPrior] = useState(0)

  // Per-roll inputs. NPCs are assumed "reasonable proficiency" per SRD §08
  // Fed/Clothed text — default A=0, S=1. Leader A/S defaults to 0/0 with
  // the GM overriding if they know the leader's stats.
  const [fedAmod, setFedAmod] = useState(0)
  const [fedSmod, setFedSmod] = useState(1)
  const [fedCmod, setFedCmod] = useState(0)
  const [clothedAmod, setClothedAmod] = useState(0)
  const [clothedSmod, setClothedSmod] = useState(1)
  const [clothedCmod, setClothedCmod] = useState(0)
  const [moraleAmod, setMoraleAmod] = useState(0)
  const [moraleSmod, setMoraleSmod] = useState(0)
  const [additionalMoraleCmod, setAdditionalMoraleCmod] = useState(0)

  // Overrides for the 6 Morale slots. null = use auto. Numeric = override.
  // GM rarely needs to override Enough Hands / Clear Voice / Safety (they're
  // mechanical), but Mood and the Additional slot are the common Fill-In-
  // The-Gaps levers.
  const [slotMoodOverride, setSlotMoodOverride] = useState<number | null>(null)
  const [slotEnoughHandsOverride, setSlotEnoughHandsOverride] = useState<number | null>(null)
  const [slotClearVoiceOverride, setSlotClearVoiceOverride] = useState<number | null>(null)
  const [slotSafetyOverride, setSlotSafetyOverride] = useState<number | null>(null)

  // Final result payload once rolls fire
  const [result, setResult] = useState<FinalResult | null>(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setStage('form')
    setResult(null)
    setFedAmod(0); setFedSmod(1); setFedCmod(0)
    setClothedAmod(0); setClothedSmod(1); setClothedCmod(0)
    setMoraleAmod(0); setMoraleSmod(0); setAdditionalMoraleCmod(0)
    setSlotMoodOverride(null)
    setSlotEnoughHandsOverride(null)
    setSlotClearVoiceOverride(null)
    setSlotSafetyOverride(null)
    setLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from('community_morale_checks')
        .select('cmod_for_next')
        .eq('community_id', community.id)
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      setMoodFromPrior((data as any)?.cmod_for_next ?? 0)
      setLoading(false)
    })()
  }, [open, community.id, supabase])

  if (!open) return null

  const memberCount = members.length
  const dissolved = community.status === 'dissolved'
  // Status is 'forming' for new communities and nothing auto-promotes it
  // to 'active' — the "Community" chip is driven by the 13+ count, not
  // status. Eligibility gate mirrors that: any non-dissolved community
  // at 13+ can run a weekly check. The first successful finalize flips
  // status → 'active' to mark the community as having completed a cycle.
  const eligible = memberCount >= 13 && !dissolved

  // Effective CMods (override or auto)
  const slotMood = slotMoodOverride ?? moodFromPrior
  const slotEnoughHands = slotEnoughHandsOverride ?? autoEnoughHands
  const slotClearVoice = slotClearVoiceOverride ?? autoClearVoice
  const slotSafety = slotSafetyOverride ?? autoSafety

  async function runWeeklyCheck() {
    if (!eligible || running) return
    setRunning(true)

    // Roll 1 — Fed
    const fedDice = roll2d6()
    const fedTotal = fedDice.die1 + fedDice.die2 + fedAmod + fedSmod + fedCmod
    const fedOutcome = classifyRoll(fedTotal, fedDice.die1, fedDice.die2)
    const fedCmodForMorale = outcomeToMoraleCmod(fedOutcome)
    const fed: RollResult = {
      ...fedDice, amod: fedAmod, smod: fedSmod, cmod: fedCmod,
      total: fedTotal, outcome: fedOutcome,
    }

    // Roll 2 — Clothed
    const clothedDice = roll2d6()
    const clothedTotal = clothedDice.die1 + clothedDice.die2 + clothedAmod + clothedSmod + clothedCmod
    const clothedOutcome = classifyRoll(clothedTotal, clothedDice.die1, clothedDice.die2)
    const clothedCmodForMorale = outcomeToMoraleCmod(clothedOutcome)
    const clothed: RollResult = {
      ...clothedDice, amod: clothedAmod, smod: clothedSmod, cmod: clothedCmod,
      total: clothedTotal, outcome: clothedOutcome,
    }

    // Roll 3 — Morale. Uses Fed+Clothed outcomes just rolled (not the
    // pre-form estimates, which are 0 before any roll fires).
    const moraleSlotsTotal =
      slotMood + fedCmodForMorale + clothedCmodForMorale +
      slotEnoughHands + slotClearVoice + slotSafety + additionalMoraleCmod
    const moraleDice = roll2d6()
    const moraleTotal = moraleDice.die1 + moraleDice.die2 + moraleAmod + moraleSmod + moraleSlotsTotal
    const moraleOutcome = classifyRoll(moraleTotal, moraleDice.die1, moraleDice.die2)
    const nextMoraleCmod = outcomeToMoraleCmod(moraleOutcome)
    const morale: RollResult = {
      ...moraleDice, amod: moraleAmod, smod: moraleSmod, cmod: moraleSlotsTotal,
      total: moraleTotal, outcome: moraleOutcome,
    }

    // Consequence
    const failed = isMoraleFailure(moraleOutcome)
    const consecutiveFailuresAfter = failed ? community.consecutive_failures + 1 : 0
    const willDissolve = consecutiveFailuresAfter >= 3
    const pct = outcomeToDeparturePct(moraleOutcome)
    const departCount = Math.floor(memberCount * pct)
    // Departures: weighted NPC-only pool. If the community will dissolve,
    // mark everyone as departing (dissolved_reason='dissolved') — handled
    // in persistence, not here.
    const departureIds = willDissolve
      ? [] // dissolution path handles all members at persist-time
      : pickDeparturesWeighted(memberLite, departCount)

    setResult({
      fed, clothed, morale,
      moraleSlots: {
        mood: slotMood,
        fed: fedCmodForMorale,
        clothed: clothedCmodForMorale,
        enoughHands: slotEnoughHands,
        clearVoice: slotClearVoice,
        safety: slotSafety,
        additional: additionalMoraleCmod,
      },
      newWeek: community.week_number + 1,
      nextMoraleCmod,
      consecutiveFailuresAfter,
      willDissolve,
      departureIds,
      membersBefore: memberCount,
      membersAfter: willDissolve ? 0 : memberCount - departureIds.length,
    })
    setStage('result')
    setRunning(false)
  }

  async function finalizeAndSave() {
    if (!result || running) return
    setRunning(true)
    const { fed, clothed, morale, moraleSlots, newWeek, nextMoraleCmod,
            consecutiveFailuresAfter, willDissolve, departureIds,
            membersBefore, membersAfter } = result
    const now = new Date().toISOString()

    // 1) Insert Fed + Clothed resource checks
    await supabase.from('community_resource_checks').insert([
      {
        community_id: community.id, kind: 'fed', week_number: newWeek,
        rolled_by_user_id: userId,
        die1: fed.die1, die2: fed.die2,
        amod: fed.amod, smod: fed.smod, cmod_total: fed.cmod,
        total: fed.total, outcome: fed.outcome.toLowerCase().replace(/ /g, '_'),
        cmod_for_next_morale: outcomeToMoraleCmod(fed.outcome),
      },
      {
        community_id: community.id, kind: 'clothed', week_number: newWeek,
        rolled_by_user_id: userId,
        die1: clothed.die1, die2: clothed.die2,
        amod: clothed.amod, smod: clothed.smod, cmod_total: clothed.cmod,
        total: clothed.total, outcome: clothed.outcome.toLowerCase().replace(/ /g, '_'),
        cmod_for_next_morale: outcomeToMoraleCmod(clothed.outcome),
      },
    ])

    // 2) Insert Morale check with full slot snapshot
    await supabase.from('community_morale_checks').insert({
      community_id: community.id,
      week_number: newWeek,
      rolled_by_user_id: userId,
      die1: morale.die1, die2: morale.die2,
      amod: morale.amod, smod: morale.smod, cmod_total: morale.cmod,
      total: morale.total, outcome: morale.outcome.toLowerCase().replace(/ /g, '_'),
      cmod_for_next: nextMoraleCmod,
      modifiers_json: moraleSlots,
      members_before: membersBefore, members_after: membersAfter,
    })

    // 3) Apply member consequence
    if (willDissolve) {
      // All members marked left with reason=dissolved; community status flips.
      await supabase.from('community_members')
        .update({ left_at: now, left_reason: 'dissolved' })
        .eq('community_id', community.id)
        .is('left_at', null)
    } else if (departureIds.length > 0) {
      const reasonByPct: Record<number, string> = { 0.25: 'morale_25', 0.50: 'morale_50', 0.75: 'morale_75' }
      const pct = outcomeToDeparturePct(morale.outcome)
      const reason = reasonByPct[pct] ?? 'manual'
      // left_reason check constraint: ('morale_25','morale_50','dissolved',
      // 'manual','killed'). 75% loss maps to NEW reason 'morale_75' —
      // falls back to 'manual' if DB schema hasn't been widened yet.
      // Attempt the precise reason first; on FK/check violation retry with
      // 'manual' so the departures still persist.
      const { error } = await supabase.from('community_members')
        .update({ left_at: now, left_reason: reason })
        .in('id', departureIds)
      if (error) {
        // Retry with a reason the current schema definitely allows.
        await supabase.from('community_members')
          .update({ left_at: now, left_reason: 'manual' })
          .in('id', departureIds)
      }
    }

    // 4) Update community counters (+ status transition).
    //    'forming' → 'active' on first completed weekly cycle; 'active' →
    //    'dissolved' on 3rd consecutive failure; otherwise keep.
    const nextStatus: 'forming' | 'active' | 'dissolved' = willDissolve
      ? 'dissolved'
      : (community.status === 'forming' ? 'active' : community.status)
    await supabase.from('communities').update({
      week_number: newWeek,
      consecutive_failures: consecutiveFailuresAfter,
      status: nextStatus,
      ...(willDissolve ? { dissolved_at: now } : {}),
    }).eq('id', community.id)

    // 5) Log rows for the session feed
    const fedLabel = `🌾 Week ${newWeek} · ${community.name} — Fed Check: ${fed.outcome}`
    const clothedLabel = `🔧 Week ${newWeek} · ${community.name} — Clothed Check: ${clothed.outcome}`
    const moraleSuffix = willDissolve
      ? ` — Community dissolved`
      : departureIds.length > 0
        ? ` — ${departureIds.length} member${departureIds.length === 1 ? '' : 's'} left`
        : ''
    const moraleLabel = `📊 Week ${newWeek} · ${community.name} — Morale: ${morale.outcome}${moraleSuffix}`

    await supabase.from('roll_log').insert([
      {
        campaign_id: campaignId, user_id: userId,
        character_name: community.name, label: fedLabel,
        die1: fed.die1, die2: fed.die2, amod: fed.amod, smod: fed.smod, cmod: fed.cmod,
        total: fed.total, outcome: 'fed_check',
        damage_json: {
          communityId: community.id,
          communityName: community.name,
          weekNumber: newWeek,
          rollOutcome: fed.outcome,
          cmodForNextMorale: outcomeToMoraleCmod(fed.outcome),
        } as any,
        created_at: now,
      },
      {
        campaign_id: campaignId, user_id: userId,
        character_name: community.name, label: clothedLabel,
        die1: clothed.die1, die2: clothed.die2, amod: clothed.amod, smod: clothed.smod, cmod: clothed.cmod,
        total: clothed.total, outcome: 'clothed_check',
        damage_json: {
          communityId: community.id,
          communityName: community.name,
          weekNumber: newWeek,
          rollOutcome: clothed.outcome,
          cmodForNextMorale: outcomeToMoraleCmod(clothed.outcome),
        } as any,
        created_at: now,
      },
      {
        campaign_id: campaignId, user_id: userId,
        character_name: community.name, label: moraleLabel,
        die1: morale.die1, die2: morale.die2, amod: morale.amod, smod: morale.smod, cmod: morale.cmod,
        total: morale.total, outcome: 'morale_check',
        damage_json: {
          communityId: community.id,
          communityName: community.name,
          weekNumber: newWeek,
          rollOutcome: morale.outcome,
          slots: moraleSlots,
          cmodForNext: nextMoraleCmod,
          membersBefore, membersAfter,
          departureCount: willDissolve ? membersBefore : departureIds.length,
          departureNames: willDissolve
            ? ['— all members —']
            : departureIds.map(id => memberNameById.get(id) ?? '(unknown)'),
          consecutiveFailuresAfter,
          willDissolve,
        } as any,
        created_at: now,
      },
    ])

    setRunning(false)
    onComplete()
    onClose()
  }

  // ── Styles shared with the existing app conventions ─────────────
  const backdrop: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, padding: '20px',
  }
  const panel: React.CSSProperties = {
    background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px',
    width: '640px', maxWidth: '100%', maxHeight: 'calc(100vh - 40px)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }
  const header: React.CSSProperties = {
    padding: '14px 18px', borderBottom: '1px solid #2e2e2e',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }
  const body: React.CSSProperties = {
    padding: '18px', flex: 1, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: '14px',
  }
  const sectionHeading: React.CSSProperties = {
    fontSize: '14px', fontWeight: 700, color: '#EF9F27',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase',
  }
  const label: React.CSSProperties = {
    fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase',
  }
  const numInput: React.CSSProperties = {
    width: '64px', padding: '5px 8px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee',
    fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center',
  }
  const rowFlex: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px',
  }
  const slotRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '4px 8px', background: '#111',
    border: '1px solid #2e2e2e', borderRadius: '3px',
  }
  const primaryBtn: React.CSSProperties = {
    padding: '10px 18px', background: '#1a2e10',
    border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458',
    fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
    fontWeight: 600,
  }
  const dangerBtn: React.CSSProperties = {
    padding: '10px 18px', background: '#2a1010',
    border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a',
    fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
    fontWeight: 600,
  }
  const chipBtn: React.CSSProperties = {
    padding: '6px 12px', background: 'transparent', border: '1px solid #7ab3d4',
    borderRadius: '3px', color: '#7ab3d4', fontSize: '13px',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', cursor: 'pointer',
  }

  const cmodColor = (n: number) => n > 0 ? '#7fc458' : n < 0 ? '#f5a89a' : '#cce0f5'
  const outcomeColor = (o: string) => {
    switch (o) {
      case 'Wild Success':
      case 'High Insight': return '#7fc458'
      case 'Success': return '#7ab3d4'
      case 'Failure': return '#EF9F27'
      case 'Dire Failure':
      case 'Low Insight': return '#c0392b'
      default: return '#d4cfc9'
    }
  }

  // ── FORM stage ─────────────────────────────────────────
  if (stage === 'form') {
    const moraleCmodPreview =
      slotMood + slotEnoughHands + slotClearVoice + slotSafety + additionalMoraleCmod
    return (
      <div style={backdrop} onClick={onClose}>
        <div style={panel} onClick={e => e.stopPropagation()}>
          <div style={header}>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                Weekly Check — {community.name}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                Week {community.week_number + 1} · {memberCount} members · {community.consecutive_failures}/3 consecutive failures
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>

          <div style={body}>
            {loading && (
              <div style={{ color: '#cce0f5', fontSize: '13px' }}>Loading prior week…</div>
            )}
            {dissolved && (
              <div style={{ padding: '10px', background: '#2a1010', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px' }}>
                This community has already dissolved. No further checks possible.
              </div>
            )}
            {!dissolved && memberCount < 13 && (
              <div style={{ padding: '10px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '3px', color: '#EF9F27', fontSize: '13px' }}>
                Only {memberCount} member{memberCount === 1 ? '' : 's'}. Morale Checks require 13+ (this is a Group, not a Community).
              </div>
            )}
            {community.consecutive_failures === 2 && !dissolved && (
              <div style={{ padding: '10px', background: '#2a1010', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px' }}>
                ⚠ {community.name} is one failed check away from dissolution.
              </div>
            )}

            {/* Per-roll mod input tooltips (SRD §08). Native `title` so it
                works with zero extra layout plumbing; if a richer tooltip
                component lands later we can port to that wholesale. */}
            {/* Fed */}
            <div>
              <div style={sectionHeading} title="Fed Check — Gatherers roll weekly for Rations (hunting / foraging / farming / fishing / scavenging). Outcome becomes the Fed CMod on this week's Morale roll.">🌾 Fed Check · Gatherers</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                Community efforts to hunt, forage, farm, and fish. It is assumed this effort is led by an NPC; if it is led by a player, substitute their AMod and SMods.
              </div>
              <div style={rowFlex}>
                <span style={label} title="Attribute Modifier — the roller's relevant Rapid Range Attribute. NPCs default to 0.">AMod</span>
                <input type="number" value={fedAmod} onChange={e => setFedAmod(parseInt(e.target.value) || 0)} style={numInput} />
                <span style={label} title="Skill Modifier — the roller's level in the skill used (Farming / Scavenging / Survival). NPC default 1 ('reasonable proficiency' per SRD §08).">SMod</span>
                <input type="number" value={fedSmod} onChange={e => setFedSmod(parseInt(e.target.value) || 0)} style={numInput} />
                <span style={label} title="Circumstance Modifier — any one-off GM adjustments to this specific roll (tool quality, weather, luck, etc.).">+ CMod</span>
                <input type="number" value={fedCmod} onChange={e => setFedCmod(parseInt(e.target.value) || 0)} style={numInput} />
              </div>
            </div>

            {/* Clothed */}
            <div>
              <div style={sectionHeading} title="Clothed Check — Maintainers roll weekly for Supplies (repairs, clothing, tools, batteries, vehicle upkeep). Outcome becomes the Clothed CMod on this week's Morale roll.">🔧 Clothed Check · Maintainers</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                Community efforts to scavenge for supplies to ensure housing and equipment are maintained and repaired. It is assumed this effort is led by an NPC; if it is led by a player, substitute their AMod and SMods.
              </div>
              <div style={rowFlex}>
                <span style={label} title="Attribute Modifier — the roller's relevant Rapid Range Attribute. NPCs default to 0.">AMod</span>
                <input type="number" value={clothedAmod} onChange={e => setClothedAmod(parseInt(e.target.value) || 0)} style={numInput} />
                <span style={label} title="Skill Modifier — the roller's level in the skill used (Mechanic / Tinkerer). NPC default 1 ('reasonable proficiency' per SRD §08).">SMod</span>
                <input type="number" value={clothedSmod} onChange={e => setClothedSmod(parseInt(e.target.value) || 0)} style={numInput} />
                <span style={label} title="Circumstance Modifier — any one-off GM adjustments to this specific roll.">+ CMod</span>
                <input type="number" value={clothedCmod} onChange={e => setClothedCmod(parseInt(e.target.value) || 0)} style={numInput} />
              </div>
            </div>

            {/* Morale */}
            <div>
              <div style={sectionHeading} title="Morale Check — the acknowledged leader rolls at the start of each week. 2d6 + leader AMod + leader SMod + all 6 slot CMods below + Additional. Outcome drives member departures (Failure 25% / Dire 50% / Low Insight 75%) and sets next week's Mood.">📊 Morale Check · Leader</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                The modifiers below are tied to weekly events within the community, and GMs can provide CMods where relevant. The Fed + Clothed CMods will use the rolled outcome when "Run Weekly Check" is run.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Fed slot — live 0 until roll fires */}
                <div style={slotRow} title="Set by this week's Fed Check (Gatherers). Outcome ladder: High Insight +2, Wild Success +1, Success 0, Failure −1, Dire Failure −2, Low Insight −3. Currently shows — because the Fed roll hasn't fired yet; it snaps to the actual rolled CMod when you click Run Weekly Check.">
                  <span style={{ ...label, flex: 1 }}>Fed (post-roll)</span>
                  <span style={{ ...label, color: '#5a5550', fontSize: '13px' }}>snaps to Fed outcome</span>
                  <span style={{ color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>—</span>
                  <div style={{ width: '64px' }} />
                </div>
                {/* Clothed slot — live 0 until roll fires */}
                <div style={slotRow} title="Set by this week's Clothed Check (Maintainers). Same outcome ladder as Fed: High Insight +2, Wild Success +1, Success 0, Failure −1, Dire Failure −2, Low Insight −3. Snaps to the rolled CMod when you click Run Weekly Check.">
                  <span style={{ ...label, flex: 1 }}>Clothed (post-roll)</span>
                  <span style={{ ...label, color: '#5a5550', fontSize: '13px' }}>snaps to Clothed outcome</span>
                  <span style={{ color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>—</span>
                  <div style={{ width: '64px' }} />
                </div>
                {/* Mood — carries over from prior week's cmod_for_next.
                    Positioned between the resource rolls and the mechanical
                    slots so the form visually reads: "this week's resources
                    first, then lingering mood, then structural/mechanical
                    modifiers." User-requested order 2026-04-23. */}
                <div style={slotRow} title="Carried over from last week's Morale outcome (SRD §08). High Insight +2, Wild Success +1, Success 0, Failure −1, Dire Failure −2, Low Insight −3. Starts at 0 if this is the first check. Override if last week's events don't match the stored value.">
                  <span style={{ ...label, flex: 1 }}>Mood Around The Campfire</span>
                  <span style={{ ...label, color: '#5a5550', fontSize: '13px' }}>auto</span>
                  <span style={{ color: cmodColor(moodFromPrior), fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>{formatCmod(moodFromPrior)}</span>
                  <input type="number" value={slotMoodOverride ?? ''} placeholder="—"
                    onChange={e => setSlotMoodOverride(e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                    style={numInput} />
                </div>
                {/* Enough Hands */}
                <div style={slotRow} title="Mechanical (SRD §08). −1 per role group below its SRD minimum: Gatherers 33% of the NPC labor pool, Maintainers 20%, Safety 5%. Capped at −3. Labor pool excludes PCs and 'Assigned' NPCs.">
                  <span style={{ ...label, flex: 1 }}>Enough Hands</span>
                  <span style={{ ...label, color: '#5a5550', fontSize: '13px' }}>auto</span>
                  <span style={{ color: cmodColor(autoEnoughHands), fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>{formatCmod(autoEnoughHands)}</span>
                  <input type="number" value={slotEnoughHandsOverride ?? ''} placeholder="—"
                    onChange={e => setSlotEnoughHandsOverride(e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                    style={numInput} />
                </div>
                {/* A Clear Voice */}
                <div style={slotRow} title="0 if the community has an acknowledged leader (PC or NPC); −1 if leaderless. Set or change the leader via the Leader dropdown on the community panel.">
                  <span style={{ ...label, flex: 1 }}>A Clear Voice</span>
                  <span style={{ ...label, color: '#5a5550', fontSize: '13px' }}>auto</span>
                  <span style={{ color: cmodColor(autoClearVoice), fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>{formatCmod(autoClearVoice)}</span>
                  <input type="number" value={slotClearVoiceOverride ?? ''} placeholder="—"
                    onChange={e => setSlotClearVoiceOverride(e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                    style={numInput} />
                </div>
                {/* Safety */}
                <div style={slotRow} title="+1 if Safety makes up ≥ 10% of the NPC labor pool, −1 if < 5%, otherwise 0. Safety covers policing / patrol / fire / emergency and is where community leadership is drawn from.">
                  <span style={{ ...label, flex: 1 }}>Someone To Watch Over Me</span>
                  <span style={{ ...label, color: '#5a5550', fontSize: '13px' }}>auto</span>
                  <span style={{ color: cmodColor(autoSafety), fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>{formatCmod(autoSafety)}</span>
                  <input type="number" value={slotSafetyOverride ?? ''} placeholder="—"
                    onChange={e => setSlotSafetyOverride(e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                    style={numInput} />
                </div>
                {/* Additional — freeform */}
                <div style={slotRow} title="GM freeform Fill-In-The-Gaps — event-specific modifiers this week (raids, crises, miracles, weather, a surprise resupply, a Distemper surge, etc.). Resets to 0 each time the modal opens so one-off events don't bleed into future weeks.">
                  <span style={{ ...label, flex: 1 }}>Additional (Fill-In-The-Gaps)</span>
                  <span style={{ ...label, color: '#5a5550', fontSize: '13px' }}>GM freeform</span>
                  <span style={{ color: cmodColor(additionalMoraleCmod), fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>{formatCmod(additionalMoraleCmod)}</span>
                  <input type="number" value={additionalMoraleCmod}
                    onChange={e => setAdditionalMoraleCmod(parseInt(e.target.value) || 0)}
                    style={numInput} />
                </div>
              </div>

              <div style={{ marginTop: '10px', ...rowFlex }}>
                <span style={label} title="The Morale roll uses the leader's Influence AMod (INF attribute value). Leave 0 for NPC leaders whose INF isn't tracked.">Leader Influence AMod</span>
                <input type="number" value={moraleAmod} onChange={e => setMoraleAmod(parseInt(e.target.value) || 0)} style={numInput} />
                <span style={label} title="Leader's SMod in whichever social skill they're using to rally the community. Typical picks: Barter, Inspiration, Manipulation, Psychology*, Tactics*.">Leader SMod (Barter, Inspiration, Manipulation, Psychology*, Tactics*)</span>
                <input type="number" value={moraleSmod} onChange={e => setMoraleSmod(parseInt(e.target.value) || 0)} style={numInput} />
                <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  Pre-roll CMod (no Fed/Clothed yet): <span style={{ color: cmodColor(moraleCmodPreview), fontWeight: 700 }}>{formatCmod(moraleCmodPreview)}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 18px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={onClose} style={chipBtn}>Cancel</button>
            <button onClick={runWeeklyCheck}
              disabled={!eligible || running || loading}
              style={{ ...primaryBtn, opacity: (!eligible || running || loading) ? 0.4 : 1, cursor: (!eligible || running || loading) ? 'not-allowed' : 'pointer' }}>
              {running ? 'Rolling…' : '🎲 Run Weekly Check'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── RESULT stage ──────────────────────────────────────
  const r = result!
  const resourceCard = (title: string, emoji: string, rr: RollResult) => (
    <div style={{ padding: '8px 10px', background: '#111', border: `1px solid ${outcomeColor(rr.outcome)}33`, borderLeft: `3px solid ${outcomeColor(rr.outcome)}`, borderRadius: '3px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{emoji} {title}</span>
        <span style={{ fontSize: '14px', color: outcomeColor(rr.outcome), fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{rr.outcome}</span>
      </div>
      <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
        [{rr.die1}+{rr.die2}]
        {rr.amod !== 0 && <span style={{ color: rr.amod > 0 ? '#7fc458' : '#c0392b' }}> {rr.amod > 0 ? '+' : ''}{rr.amod} AMod</span>}
        {rr.smod !== 0 && <span style={{ color: rr.smod > 0 ? '#7fc458' : '#c0392b' }}> {rr.smod > 0 ? '+' : ''}{rr.smod} SMod</span>}
        {rr.cmod !== 0 && <span style={{ color: rr.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {rr.cmod > 0 ? '+' : ''}{rr.cmod} CMod</span>}
        <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {rr.total}</span>
        <span style={{ color: '#cce0f5', marginLeft: '10px' }}>→ next-Morale CMod: <span style={{ color: cmodColor(outcomeToMoraleCmod(rr.outcome)), fontWeight: 700 }}>{formatCmod(outcomeToMoraleCmod(rr.outcome))}</span></span>
      </div>
    </div>
  )

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={header}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              Week {r.newWeek} Results — {community.name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        <div style={body}>
          {resourceCard('Fed Check', '🌾', r.fed)}
          {resourceCard('Clothed Check', '🔧', r.clothed)}

          {/* Morale detailed card */}
          <div style={{ padding: '10px', background: '#111', border: `1px solid ${outcomeColor(r.morale.outcome)}`, borderLeft: `3px solid ${outcomeColor(r.morale.outcome)}`, borderRadius: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>📊 Morale</span>
              <span style={{ fontSize: '15px', color: outcomeColor(r.morale.outcome), fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.morale.outcome}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>
              [{r.morale.die1}+{r.morale.die2}]
              {r.morale.amod !== 0 && <span style={{ color: r.morale.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.morale.amod > 0 ? '+' : ''}{r.morale.amod} AMod</span>}
              {r.morale.smod !== 0 && <span style={{ color: r.morale.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.morale.smod > 0 ? '+' : ''}{r.morale.smod} SMod</span>}
              <span style={{ color: r.morale.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.morale.cmod >= 0 ? '+' : ''}{r.morale.cmod} CMod</span>
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.morale.total}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.6 }}>
              <span style={{ color: '#5a5550' }}>Slots:</span>
              <span> Mood <span style={{ color: cmodColor(r.moraleSlots.mood), fontWeight: 700 }}>{formatCmod(r.moraleSlots.mood)}</span></span>
              <span> · Fed <span style={{ color: cmodColor(r.moraleSlots.fed), fontWeight: 700 }}>{formatCmod(r.moraleSlots.fed)}</span></span>
              <span> · Clothed <span style={{ color: cmodColor(r.moraleSlots.clothed), fontWeight: 700 }}>{formatCmod(r.moraleSlots.clothed)}</span></span>
              <span> · Hands <span style={{ color: cmodColor(r.moraleSlots.enoughHands), fontWeight: 700 }}>{formatCmod(r.moraleSlots.enoughHands)}</span></span>
              <span> · Voice <span style={{ color: cmodColor(r.moraleSlots.clearVoice), fontWeight: 700 }}>{formatCmod(r.moraleSlots.clearVoice)}</span></span>
              <span> · Watch <span style={{ color: cmodColor(r.moraleSlots.safety), fontWeight: 700 }}>{formatCmod(r.moraleSlots.safety)}</span></span>
              {r.moraleSlots.additional !== 0 && <span> · Additional <span style={{ color: cmodColor(r.moraleSlots.additional), fontWeight: 700 }}>{formatCmod(r.moraleSlots.additional)}</span></span>}
            </div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Next week's Mood CMod: <span style={{ color: cmodColor(r.nextMoraleCmod), fontWeight: 700 }}>{formatCmod(r.nextMoraleCmod)}</span>
            </div>
          </div>

          {/* Consequence */}
          {r.willDissolve ? (
            <div style={{ padding: '12px', background: '#2a1010', border: '1px solid #c0392b', borderRadius: '3px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                ⚠ Community Dissolves
              </div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
                3 consecutive Morale failures. All {r.membersBefore} members scatter. The community is gone. (Retention check not yet implemented — deferred.)
              </div>
            </div>
          ) : r.departureIds.length > 0 ? (
            <div style={{ padding: '10px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '3px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                {r.departureIds.length} Member{r.departureIds.length === 1 ? '' : 's'} Leave
              </div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.5 }}>
                {r.departureIds.map(id => memberNameById.get(id) ?? '(unknown)').join(', ')}
              </div>
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>
                Roster after: {r.membersAfter} · Consecutive failures: {r.consecutiveFailuresAfter}/3
              </div>
            </div>
          ) : (
            <div style={{ padding: '10px', background: '#1a2010', border: '1px solid #7fc458', borderRadius: '3px' }}>
              <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                Morale holds. No departures. Consecutive failures reset to 0.
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 18px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onClose} style={chipBtn} disabled={running}>Cancel (discard)</button>
          <button onClick={finalizeAndSave}
            disabled={running}
            style={{ ...(r.willDissolve ? dangerBtn : primaryBtn), opacity: running ? 0.4 : 1, cursor: running ? 'not-allowed' : 'pointer' }}>
            {running ? 'Saving…' : r.willDissolve ? 'Finalize — Dissolve Community' : 'Finalize & Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
