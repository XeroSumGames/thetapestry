'use client'
// Off-screen recruitment for a community.
//
// Lets a GM stand the community's Leader NPC in for a PC during
// recruitment so a community can grow itself between sessions.
// "I sent Marcus to recruit the doctor while the party was off in
// the woods" — instead of dragging that into the table page, the GM
// resolves it on the community admin surface.
//
// What this is NOT: it's not the table-page recruitment modal in a
// new wrapper. It deliberately drops PC-only mechanics:
//   - No Insight Dice (PC resource, not an NPC one).
//   - No Apprentice unlock (apprentices bond 1:1 to PCs).
//   - No Inspiration auto-stack (we'd need NPC skill levels first +
//     those are loose; SRD treats the +1/level as a PC habit anyway).
//   - First-impression CMod stays 0 — npc_relationships.relationship_cmod
//     tracks PC↔NPC, not NPC↔NPC. GM can dial CMod manually if they want
//     to model "they already trust each other."
//
// What it KEEPS:
//   - SRD outcome thresholds (Wild Success ≥14, Success ≥9, Failure ≥4,
//     Dire Failure <4).
//   - Approach → recruitment_type mapping.
//   - Conscript pressgang confirm guard.
//   - Poaching -3 when the target is already in another community.
//   - roll_log row tagged with metadata.proxy = true so the feed
//     renderer can mark it visually.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Community } from '../lib/types/community'
import type { CampaignNpc } from './NpcRoster'
import { ModalBackdrop, Z_INDEX, Button, LABEL_STYLE } from '../lib/style-helpers'
import { logEvent } from '../lib/events'

type Approach = 'cohort' | 'conscript' | 'convert'

const RECRUITMENT_ALL_SKILLS = ['Barter', 'Inspiration', 'Manipulation', 'Psychology', 'Streetwise', 'Tactics', 'Intimidation']

function suggestedSkillsForApproach(ap: Approach): string[] {
  if (ap === 'cohort') return ['Barter', 'Tactics', 'Inspiration']
  if (ap === 'conscript') return ['Intimidation', 'Tactics']
  return ['Inspiration', 'Psychology']
}

interface SkillEntry { name: string; level: number }
function getNpcSkillLevel(npc: CampaignNpc | null, skillName: string): number {
  if (!npc) return 0
  const entries = (npc.skills?.entries ?? []) as SkillEntry[]
  const hit = entries.find(s => s.name === skillName)
  return hit?.level ?? 0
}

interface Props {
  community: Community
  campaignId: string
  userId: string | null
  onClose: () => void
  // Fired with the freshly-inserted community_members row id when a
  // success outcome lands. Caller refreshes its members cache; we
  // don't try to mutate parent state directly.
  onRecruited?: (memberId: string) => void
}

interface RollResult {
  die1: number
  die2: number
  total: number
  outcome: 'Wild Success' | 'Success' | 'Failure' | 'Dire Failure'
  amod: number
  smod: number
  cmod: number
  inserted: boolean
  approachLabel: string
  targetName: string
  leaderName: string
}

export default function CommunityProxyRecruitModal({ community, campaignId, userId, onClose, onRecruited }: Props) {
  const supabase = createClient() as SupabaseClient
  const [leader, setLeader] = useState<CampaignNpc | null>(null)
  const [candidates, setCandidates] = useState<CampaignNpc[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>('')

  const [targetId, setTargetId] = useState<string>('')
  const [approach, setApproach] = useState<Approach>('cohort')
  const [skill, setSkill] = useState<string>('')
  const [gmCmod, setGmCmod] = useState(0)
  const [poachingId, setPoachingId] = useState<string | null>(null)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<RollResult | null>(null)

  // Initial load — leader + candidate list. Candidates = revealed,
  // alive NPCs in this campaign who aren't already in any community.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!community.leader_npc_id) {
        setLoadError('This community has no Leader NPC. Set one first (the leader is who proxies the roll).')
        setLoading(false)
        return
      }
      const [leaderRes, npcsRes, memsRes] = await Promise.all([
        supabase.from('campaign_npcs').select('*').eq('id', community.leader_npc_id).maybeSingle(),
        // Revealed = hidden_from_players false (or null) AND status not 'dead'.
        supabase.from('campaign_npcs')
          .select('*')
          .eq('campaign_id', campaignId)
          .neq('status', 'dead')
          .order('name'),
        // Every active community_members.npc_id in this campaign — used
        // to (a) filter the candidate list, (b) compute the poaching
        // -3 CMod when the picked NPC is in another community.
        supabase.from('community_members')
          .select('npc_id, community_id, communities!inner(campaign_id)')
          .is('left_at', null)
          .not('npc_id', 'is', null)
          .eq('communities.campaign_id', campaignId),
      ])
      if (cancelled) return
      if (leaderRes.error || !leaderRes.data) { setLoadError('Could not load Leader NPC.'); setLoading(false); return }
      const ld = leaderRes.data as CampaignNpc
      // WP=0 → can't proxy (incapacitated). Surface as a load error so
      // the modal explains rather than silently disabling.
      if ((ld.wp_current ?? ld.wp_max ?? 10) <= 0) {
        setLoadError(`${ld.name} is incapacitated (WP 0) and can't proxy a recruitment roll.`)
        setLoading(false)
        return
      }
      setLeader(ld)
      const claimedNpcIds = new Set<string>()
      const claimedIdToCommunity: Record<string, string> = {}
      for (const m of (memsRes.data ?? []) as { npc_id: string; community_id: string }[]) {
        if (m.npc_id) {
          claimedNpcIds.add(m.npc_id)
          claimedIdToCommunity[m.npc_id] = m.community_id
        }
      }
      const list = ((npcsRes.data ?? []) as CampaignNpc[]).filter(n => n.id !== ld.id)
      setCandidates(list)
      // Pre-select first non-claimed candidate.
      const firstFree = list.find(n => !claimedNpcIds.has(n.id))
      if (firstFree) setTargetId(firstFree.id)
      // Stash so we can flag poaching when target picked.
      ;(window as any).__proxyClaimed = claimedIdToCommunity
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [community.leader_npc_id, campaignId, supabase])

  // Re-evaluate poaching whenever target picks change. Reads the
  // claim map we cached on window above (intentionally local — we
  // don't need this in React state, just at compute time).
  useEffect(() => {
    if (!targetId) { setPoachingId(null); return }
    const claimed = (window as any).__proxyClaimed as Record<string, string> | undefined
    if (claimed && claimed[targetId] && claimed[targetId] !== community.id) {
      setPoachingId(claimed[targetId])
    } else {
      setPoachingId(null)
    }
  }, [targetId, community.id])

  const target = useMemo(() => candidates.find(n => n.id === targetId) ?? null, [candidates, targetId])

  const amod = leader?.influence ?? 0
  const smod = skill ? getNpcSkillLevel(leader, skill) : 0
  const poachingCmod = poachingId ? -3 : 0
  const cmodTotal = poachingCmod + gmCmod

  function suggestedSkills(): string[] {
    return suggestedSkillsForApproach(approach)
  }

  async function executeRoll() {
    if (!leader || !target || !skill) return
    if (approach === 'conscript') {
      const ack = confirm(
        `Conscription — pressgang.\n\n` +
        `This is coercion, not persuasion. ${leader.name} must have established a credible threat (weapons drawn, leverage held, escape cut off, etc.) before this roll can proceed.\n\n` +
        `Confirm the threat is credible and roll?`
      )
      if (!ack) return
    }
    setRolling(true)
    const die1 = Math.floor(Math.random() * 6) + 1
    const die2 = Math.floor(Math.random() * 6) + 1
    const total = die1 + die2 + amod + smod + cmodTotal
    const outcome: RollResult['outcome'] =
      total >= 14 ? 'Wild Success'
      : total >= 9 ? 'Success'
      : total >= 4 ? 'Failure'
      : 'Dire Failure'
    const isSuccess = outcome === 'Wild Success' || outcome === 'Success'
    const recruitmentType: Approach = approach
    let inserted = false
    let memberId: string | null = null
    if (isSuccess) {
      const { data, error } = await supabase.from('community_members').insert({
        community_id: community.id,
        npc_id: target.id,
        role: 'unassigned',
        recruitment_type: recruitmentType,
        joined_at: new Date().toISOString(),
        invited_by_user_id: userId,
      }).select('id').single()
      if (error) {
        alert(`Recruit succeeded but member insert failed: ${error.message}`)
      } else {
        inserted = true
        memberId = data?.id ?? null
      }
    }
    // Roll log row — tag metadata.proxy = true so the feed knows it
    // was an NPC-on-NPC off-screen action, not a PC at the table.
    const logLabel = isSuccess
      ? `🤝 ${leader.name} recruited ${target.name} as a ${recruitmentType.charAt(0).toUpperCase() + recruitmentType.slice(1)} to ${community.name} (off-screen)`
      : `🤝 ${leader.name} tried to recruit ${target.name} (off-screen) — ${outcome}`
    await supabase.from('roll_log').insert({
      campaign_id: campaignId,
      user_id: userId,
      character_name: leader.name,
      label: logLabel,
      die1, die2,
      amod, smod, cmod: cmodTotal,
      total,
      outcome: 'recruit',
      damage_json: {
        rollOutcome: outcome,
        approach,
        recruitmentType,
        proxy: true,
        leaderNpcId: leader.id,
        leaderNpcName: leader.name,
        communityId: community.id,
        communityName: community.name,
        npcId: target.id,
        npcName: target.name,
        skill,
        poaching: poachingCmod,
        gmCmod,
      },
    })
    void logEvent('recruit_attempted', {
      campaign_id: campaignId,
      approach,
      outcome,
      npc_id: target.id,
      community_id: community.id,
      proxy: true,
    })
    setResult({
      die1, die2, total, outcome,
      amod, smod, cmod: cmodTotal,
      inserted,
      approachLabel: recruitmentType.charAt(0).toUpperCase() + recruitmentType.slice(1),
      targetName: target.name,
      leaderName: leader.name,
    })
    setRolling(false)
    if (inserted && memberId) onRecruited?.(memberId)
  }

  return (
    <ModalBackdrop onClose={onClose} zIndex={Z_INDEX.criticalModal} opacity={0.88} padding="1rem">
      <div style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '100%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>
          {community.name}
        </div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '4px' }}>
          🤝 Recruit (NPC Proxy)
        </div>
        <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1.25rem', fontFamily: 'Carlito, sans-serif', lineHeight: 1.4 }}>
          The community&apos;s Leader NPC handles the roll. Use this for off-screen growth between sessions, or when no PC is available to recruit at the table.
        </div>

        {loading && (
          <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Loading leader and candidates…
          </div>
        )}

        {loadError && (
          <div style={{ padding: '10px 14px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', marginBottom: '12px', fontFamily: 'Carlito, sans-serif' }}>
            {loadError}
          </div>
        )}

        {!loading && leader && !result && (
          <>
            {/* Leader stat block — read-only summary so the GM knows
                what's about to roll. Shows INF + the picked-skill
                level. */}
            <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#0f1a0f', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
              <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                Leader (Roller)
              </div>
              <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', fontWeight: 600 }}>
                {leader.name}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginTop: '2px' }}>
                INF {amod >= 0 ? '+' : ''}{amod}
                {skill && <> · {skill} {smod >= 0 ? '+' : ''}{smod}</>}
              </div>
            </div>

            {/* Target NPC */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ ...LABEL_STYLE, marginBottom: '3px' }}>Target NPC</div>
              <select value={targetId} onChange={e => setTargetId(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                <option value="">— pick an NPC —</option>
                {candidates.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.name}{(window as any).__proxyClaimed?.[n.id] ? ' (in another community)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Approach */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ ...LABEL_STYLE, marginBottom: '3px' }}>Approach</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['cohort', 'conscript', 'convert'] as Approach[]).map(ap => (
                  <button key={ap} type="button" onClick={() => { setApproach(ap); setSkill('') }}
                    style={{ flex: 1, padding: '8px 6px', background: approach === ap ? '#2d5a1b' : '#242424', border: `1px solid ${approach === ap ? '#7fc458' : '#3a3a3a'}`, borderRadius: '3px', color: approach === ap ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    {ap}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.4 }}>
                {approach === 'cohort' && 'Shared interest or goal — joins until the next Morale Check.'}
                {approach === 'conscript' && 'Pressgang — coercive recruitment under credible threat. Requires confirmation.'}
                {approach === 'convert' && 'Lasting buy-in — joins fully and stays through Morale checks.'}
              </div>
            </div>

            {/* Skill — suggested first, then full list */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ ...LABEL_STYLE, marginBottom: '3px' }}>Skill</div>
              <select value={skill} onChange={e => setSkill(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                <option value="">— pick a skill —</option>
                <optgroup label={`Suggested for ${approach}`}>
                  {suggestedSkills().map(s => (
                    <option key={`sug-${s}`} value={s}>{s} ({getNpcSkillLevel(leader, s) >= 0 ? '+' : ''}{getNpcSkillLevel(leader, s)})</option>
                  ))}
                </optgroup>
                <optgroup label="All social skills">
                  {RECRUITMENT_ALL_SKILLS.filter(s => !suggestedSkills().includes(s)).map(s => (
                    <option key={`all-${s}`} value={s}>{s} ({getNpcSkillLevel(leader, s) >= 0 ? '+' : ''}{getNpcSkillLevel(leader, s)})</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* CMod — poaching + GM dial. No first-impression line
                because relationship_cmod is PC↔NPC; no Inspiration
                stack (PC mechanic). */}
            <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#141414', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                CMod Breakdown
              </div>
              {poachingId && (
                <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>
                  Poaching <span style={{ marginLeft: '8px' }}>−3</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>GM CMod</span>
                <input type="number" value={gmCmod} onChange={e => setGmCmod(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '64px', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textAlign: 'center' }} />
                <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                  Total CMod: {cmodTotal >= 0 ? '+' : ''}{cmodTotal}
                </span>
              </div>
            </div>

            {/* Roll preview */}
            <div style={{ marginBottom: '14px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textAlign: 'center', letterSpacing: '.04em' }}>
              2d6 + AMod ({amod >= 0 ? '+' : ''}{amod}) + SMod ({smod >= 0 ? '+' : ''}{smod}) + CMod ({cmodTotal >= 0 ? '+' : ''}{cmodTotal}) = ? · target ≥9 to recruit
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button tone="secondary" size="md" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
              <button onClick={executeRoll} disabled={rolling || !targetId || !skill}
                style={{ flex: 2, padding: '10px', background: targetId && skill ? '#1a2e10' : '#111', border: `1px solid ${targetId && skill ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: targetId && skill ? '#7fc458' : '#5a5550', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: targetId && skill && !rolling ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                {rolling ? 'Rolling…' : '🎲 Roll Recruitment'}
              </button>
            </div>
          </>
        )}

        {result && (
          <div>
            <div style={{ marginBottom: '14px', padding: '12px 14px', background: result.inserted ? '#0f1a0f' : '#2a1210', border: `1px solid ${result.inserted ? '#2d5a1b' : '#7a1f16'}`, borderRadius: '3px' }}>
              <div style={{ fontSize: '13px', color: result.inserted ? '#7fc458' : '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
                {result.outcome}
              </div>
              <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', marginBottom: '6px' }}>
                {result.die1} + {result.die2} ({result.die1 + result.die2})
                {result.amod !== 0 && <> + {result.amod >= 0 ? '+' : ''}{result.amod} AMod</>}
                {result.smod !== 0 && <> + {result.smod >= 0 ? '+' : ''}{result.smod} SMod</>}
                {result.cmod !== 0 && <> + {result.cmod >= 0 ? '+' : ''}{result.cmod} CMod</>}
                {' '} = <strong>{result.total}</strong>
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
                {result.inserted
                  ? `${result.targetName} joins ${community.name} as a ${result.approachLabel}. Logged to the campaign feed.`
                  : `${result.leaderName} couldn't bring ${result.targetName} in. Logged to the campaign feed; try again next week.`}
              </div>
            </div>
            <Button tone="secondary" size="md" onClick={onClose} style={{ width: '100%' }}>Close</Button>
          </div>
        )}
      </div>
    </ModalBackdrop>
  )
}
