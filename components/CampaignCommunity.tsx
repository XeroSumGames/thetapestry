'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import CommunityMoraleModal from './CommunityMoraleModal'

// Phase A — Communities foundation. Lists communities for a campaign, lets
// the GM create one, drill into the member roster, add/remove members from
// the campaign's NPC pool or PC entries, and assign roles.
// Recruitment Checks (Phase B) + Morale (Phase C) come later; this is
// manual management only.

type Role = 'gatherer' | 'maintainer' | 'safety' | 'unassigned' | 'assigned'
type RecruitmentType = 'cohort' | 'conscript' | 'convert' | 'apprentice' | 'founder' | 'member'

interface Community {
  id: string
  campaign_id: string
  name: string
  description: string | null
  homestead_pin_id: string | null
  status: 'forming' | 'active' | 'dissolved'
  leader_npc_id: string | null
  leader_user_id: string | null
  consecutive_failures: number
  week_number: number
  world_visibility: 'private' | 'published'
}

interface Member {
  id: string
  community_id: string
  npc_id: string | null
  character_id: string | null
  role: Role
  recruitment_type: RecruitmentType
  apprentice_of_character_id: string | null
  joined_at: string | null
  left_at: string | null
  status: 'pending' | 'active' | 'removed'
  invited_by_user_id: string | null
}

interface NpcOption {
  id: string
  name: string
  // skills.entries drives auto-assign. Shape: { entries: [{ name, level }] }
  skills?: { entries?: { name: string; level: number }[] } | null
}
interface CharOption { id: string; name: string }
interface PinOption { id: string; name: string }

// Skill-based role auto-assign. Per user spec:
//   Farming / Scavenging / Survival  → Gatherers
//   Mechanic / Tinkerer              → Maintainers
//   Tactics / Ranged Combat /
//   Melee Combat / Heavy Weapons /
//   Demolitions                      → Safety
// WorkRole = the three SRD labor roles only. Explicitly excludes
// both 'unassigned' (the idle-labor pool) and 'assigned' (PC-
// directed, not part of the labor pool) — those aren't part of
// ROLE_SKILLS / quota math.
type WorkRole = Exclude<Role, 'unassigned' | 'assigned'>
const ROLE_SKILLS: Record<WorkRole, string[]> = {
  gatherer: ['Farming', 'Scavenging', 'Survival'],
  maintainer: ['Mechanic', 'Tinkerer'],
  safety: ['Tactics', 'Ranged Combat', 'Melee Combat', 'Heavy Weapons', 'Demolitions'],
}

// `scoreNpcForRole` returns the NPC's highest-level skill that's in
// the role's bucket. 0 = no qualification. Ties handled by caller.
function scoreNpcForRole(skills: NpcOption['skills'], role: WorkRole): number {
  const entries = Array.isArray(skills?.entries) ? skills!.entries! : []
  return entries.filter(e => ROLE_SKILLS[role].includes(e.name))
    .reduce((m, e) => Math.max(m, e.level), 0)
}

// Quota-aware NPC → role rebalance. Returns a map of member.id →
// chosen role (or null to leave current). Respects SRD minimums:
//   Gatherers ≥ 33%, Maintainers ≥ 20%, Safety ≥ 5% (1 minimum).
// If an NPC is qualified for multiple buckets, we prefer the one
// with the biggest deficit. Extras (roles over-target) can still
// fill understaffed buckets to guarantee the minimums.
//
// Inputs: the NPC members to consider + npc lookup for skills.
// Output: Map<memberId, WorkRole>. Unassigned members keep 'unassigned'
// only if no understaffed bucket can use them.
function rebalanceNpcRoles(
  npcMembers: Member[],
  npcById: Map<string, NpcOption>,
): Map<string, WorkRole> {
  const n = npcMembers.length
  if (n === 0) return new Map()
  const targets: Record<WorkRole, number> = {
    gatherer: Math.ceil(n * 0.33),
    maintainer: Math.ceil(n * 0.20),
    safety: Math.max(1, Math.ceil(n * 0.05)),
  }
  const counts: Record<WorkRole, number> = { gatherer: 0, maintainer: 0, safety: 0 }
  const assignment = new Map<string, WorkRole>()
  // Pre-compute each NPC's score per role so we can sort/pick fast.
  const scores = npcMembers.map(m => {
    const npc = m.npc_id ? npcById.get(m.npc_id) : undefined
    return {
      member: m,
      gatherer: scoreNpcForRole(npc?.skills, 'gatherer'),
      maintainer: scoreNpcForRole(npc?.skills, 'maintainer'),
      safety: scoreNpcForRole(npc?.skills, 'safety'),
    }
  })
  const remaining = new Set(scores.map(s => s.member.id))

  // Pass 1: give each role its minimum from QUALIFIED candidates.
  // Safety first (smallest quota, pickiest skills), then Maintainers,
  // then Gatherers. Within each role, best-match first. This keeps
  // specialists in their lane before the general Gatherer pool eats
  // them up.
  for (const role of ['safety', 'maintainer', 'gatherer'] as WorkRole[]) {
    const candidates = scores
      .filter(s => remaining.has(s.member.id) && s[role] > 0)
      .sort((a, b) => b[role] - a[role])
    for (const cand of candidates) {
      if (counts[role] >= targets[role]) break
      assignment.set(cand.member.id, role)
      counts[role]++
      remaining.delete(cand.member.id)
    }
  }

  // Pass 2: gaps still exist (not enough qualified candidates). Fill
  // from anyone remaining, regardless of skill — community still needs
  // warm bodies. Same priority order: safety → maintainer → gatherer.
  for (const role of ['safety', 'maintainer', 'gatherer'] as WorkRole[]) {
    while (counts[role] < targets[role] && remaining.size > 0) {
      const firstId = remaining.values().next().value as string
      assignment.set(firstId, role)
      counts[role]++
      remaining.delete(firstId)
    }
  }

  // Pass 3: extras. Assign any still-remaining NPCs to the role
  // they score highest in (if any skill matches). Pushes counts over
  // targets — that's fine per SRD; minimums are floors, not caps.
  // NPCs with no matching skill at all stay unassigned (0-score rows).
  for (const s of scores) {
    if (!remaining.has(s.member.id)) continue
    const best: WorkRole | null = (() => {
      const options = (['safety', 'maintainer', 'gatherer'] as WorkRole[])
        .filter(r => s[r] > 0)
        .sort((a, b) => s[b] - s[a])
      return options[0] ?? null
    })()
    if (best) {
      assignment.set(s.member.id, best)
      counts[best]++
      remaining.delete(s.member.id)
    }
  }

  return assignment
}

const ROLE_LABEL: Record<Role, string> = {
  gatherer: 'Gatherers',
  maintainer: 'Maintainers',
  safety: 'Safety',
  unassigned: 'Unassigned',
  assigned: 'Assigned',
}
// SRD §08 minimums
const ROLE_MIN_PCT: Record<Role, number> = {
  gatherer: 33,
  maintainer: 20,
  safety: 5,
  unassigned: 0,
  assigned: 0,
}
const ROLE_MAX_PCT: Record<Role, number> = {
  gatherer: 100,
  maintainer: 100,
  safety: 10,
  unassigned: 100,
  assigned: 100,
}
const RECRUITMENT_LABEL: Record<RecruitmentType, string> = {
  member: 'Member',
  founder: 'Founder',
  cohort: 'Cohort',
  conscript: 'Conscript',
  convert: 'Convert',
  apprentice: 'Apprentice',
}

const CommunityTAB_LABEL = 'Community'

interface Props {
  campaignId: string
  isGM: boolean
  // When launched from the Community ▾ dropdown, the caller can
  // tell us which panel to open by default:
  //   'status' → auto-expand the first community so the user sees
  //              roster/roles immediately (no extra click).
  //   'create' → auto-show the "+ New Community" create form.
  // If omitted, the panel opens collapsed with nothing selected.
  initialMode?: 'status' | 'create'
  // Monotonically-changing token the caller bumps each time it
  // wants CampaignCommunity to honor `initialMode` again (React
  // only re-runs the effect when deps change; without a token,
  // closing and reopening the modal wouldn't re-trigger the
  // auto-expand). Any value works — we just watch for a change.
  initialModeToken?: number
}

export default function CampaignCommunity({ campaignId, isGM, initialMode, initialModeToken }: Props) {
  const supabase = createClient()

  const [communities, setCommunities] = useState<Community[]>([])
  const [members, setMembers] = useState<Record<string, Member[]>>({})   // key = community_id, status='active'
  const [pendingByCommunity, setPendingByCommunity] = useState<Record<string, Member[]>>({})
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Source pools for adding members
  const [npcs, setNpcs] = useState<NpcOption[]>([])
  const [chars, setChars] = useState<CharOption[]>([])
  const [pins, setPins] = useState<PinOption[]>([])

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newHomestead, setNewHomestead] = useState<string>('')
  const [creating, setCreating] = useState(false)

  // Add-member form state (per community)
  const [addKind, setAddKind] = useState<'npc' | 'pc'>('npc')
  const [addSubjectId, setAddSubjectId] = useState('')
  const [addRole, setAddRole] = useState<Role>('unassigned')
  const [addType, setAddType] = useState<RecruitmentType>('member')

  // Phase C — Weekly Morale / Fed / Clothed check modal target.
  // Null = closed; uuid = run the modal for that community.
  const [moraleCommunityId, setMoraleCommunityId] = useState<string | null>(null)

  // Step-down UI. Null = hidden; uuid = showing the successor-picker
  // panel for that community. Successor defaults to 'auto' (next
  // founder → longest-tenured member); GM or the leader themselves
  // can override to a specific member id, or '' to leave leaderless.
  const [stepDownCommunityId, setStepDownCommunityId] = useState<string | null>(null)
  const [successorChoice, setSuccessorChoice] = useState<string>('auto')

  useEffect(() => { load() }, [campaignId])

  // Honor initialMode once communities are loaded. For 'status' we
  // auto-expand the first community so the Status view drops the
  // user directly into the unfolded roster/roles. For 'create' we
  // flip open the "+ New Community" create form.
  useEffect(() => {
    if (loading || !initialMode) return
    if (initialMode === 'status' && communities.length > 0 && !openId) {
      setOpenId(communities[0].id)
    }
    if (initialMode === 'create') {
      setShowCreate(true)
    }
  // Re-runs when the caller bumps initialModeToken or when the
  // loading→loaded transition happens. openId inclusion prevents
  // us from re-expanding something the user manually collapsed.
  }, [loading, initialMode, initialModeToken, communities])

  async function load() {
    setLoading(true)
    const [comsRes, npcsRes, charsRes, pinsRes] = await Promise.all([
      supabase.from('communities').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true }),
      supabase.from('campaign_npcs').select('id, name, skills').eq('campaign_id', campaignId).order('name'),
      supabase.from('campaign_members')
        .select('character_id, characters:character_id(id, name)')
        .eq('campaign_id', campaignId)
        .not('character_id', 'is', null),
      supabase.from('campaign_pins').select('id, name').eq('campaign_id', campaignId).order('name'),
    ])
    const coms = (comsRes.data ?? []) as Community[]
    setCommunities(coms)
    setNpcs((npcsRes.data ?? []) as NpcOption[])
    setChars(((charsRes.data ?? []) as any[])
      .map(r => r.characters as CharOption | null)
      .filter((c): c is CharOption => !!c && !!c.id && !!c.name))
    setPins((pinsRes.data ?? []) as PinOption[])
    // Load members for every community. Split into active vs pending
    // so the roster shows confirmed members while the leader sees a
    // separate "Pending Requests" block to approve/reject.
    if (coms.length > 0) {
      const res = await supabase
        .from('community_members')
        .select('*')
        .in('community_id', coms.map(c => c.id))
        .is('left_at', null)
      const byCom: Record<string, Member[]> = {}
      const pendingByCom: Record<string, Member[]> = {}
      for (const m of (res.data ?? []) as Member[]) {
        if (m.status === 'pending') {
          (pendingByCom[m.community_id] ||= []).push(m)
        } else if (m.status !== 'removed') {
          (byCom[m.community_id] ||= []).push(m)
        }
      }
      setMembers(byCom)
      setPendingByCommunity(pendingByCom)

      // Quota-aware auto-balance. For each community, check if the
      // NPC role distribution violates SRD minimums; if so, rebalance
      // ALL NPC members (not just unassigned) so min quotas are hit.
      // A community where 10/12 NPCs are all in Gatherers + 0 in the
      // other buckets needs re-sorting, not just new-member top-up.
      // Manual GM/Thriver overrides get stomped here by design — the
      // explicit "Re-balance Roles" button always re-runs this logic,
      // and load-time runs it when the current state obviously fails.
      const npcById = new Map<string, NpcOption>()
      for (const n of (npcsRes.data ?? []) as NpcOption[]) npcById.set(n.id, n)
      const autoUpdates: Array<{ id: string; role: Role }> = []
      for (const memberList of Object.values(byCom)) {
        // Only the labor pool (not 'assigned') participates in
        // rebalancing. Assigned NPCs are off on PC-directed tasks;
        // leave them alone.
        const laborMembers = memberList.filter(m => !!m.npc_id && m.role !== 'assigned')
        if (laborMembers.length === 0) continue
        // Current distribution over the LABOR pool
        const n = laborMembers.length
        const currentCounts = { gatherer: 0, maintainer: 0, safety: 0 } as Record<WorkRole, number>
        let currentUnassigned = 0
        for (const m of laborMembers) {
          if (m.role === 'unassigned') currentUnassigned++
          else if (m.role in currentCounts) currentCounts[m.role as WorkRole]++
        }
        // Does current state already meet minimums? If so, skip.
        const minOk = currentCounts.gatherer >= Math.ceil(n * 0.33)
          && currentCounts.maintainer >= Math.ceil(n * 0.20)
          && currentCounts.safety >= Math.max(1, Math.ceil(n * 0.05))
        // Don't rebalance if mins are met AND nothing is unassigned —
        // the current assignment is the GM's deliberate choice.
        if (minOk && currentUnassigned === 0) continue
        const newAssignment = rebalanceNpcRoles(laborMembers, npcById)
        for (const m of laborMembers) {
          const next = newAssignment.get(m.id) ?? 'unassigned'
          if (next !== m.role) autoUpdates.push({ id: m.id, role: next })
        }
      }
      if (autoUpdates.length > 0) {
        await Promise.all(autoUpdates.map(u =>
          supabase.from('community_members').update({ role: u.role }).eq('id', u.id)
        ))
        setMembers(prev => {
          const updated = { ...prev }
          const byMemberId = new Map(autoUpdates.map(u => [u.id, u.role]))
          for (const [cid, list] of Object.entries(updated)) {
            updated[cid] = list.map(m => byMemberId.has(m.id) ? { ...m, role: byMemberId.get(m.id)! } : m)
          }
          return updated
        })
      }
    } else {
      setMembers({})
      setPendingByCommunity({})
    }
    // Cache current auth user id so the UI can check leader_user_id.
    const { data: { user } } = await supabase.auth.getUser()
    setMyUserId(user?.id ?? null)
    setLoading(false)
  }

  // Manual rebalance trigger — wipes existing NPC roles and re-runs
  // the quota-aware allocator. Useful when the GM has made enough
  // changes that the auto-load version stops firing but the
  // distribution is still off.
  async function handleRebalance(communityId: string) {
    const mems = members[communityId] ?? []
    // Rebalance only the labor pool — assigned NPCs stay put.
    const laborMembers = mems.filter(m => !!m.npc_id && m.role !== 'assigned')
    if (laborMembers.length === 0) return
    const npcById = new Map<string, NpcOption>()
    for (const n of npcs) npcById.set(n.id, n)
    const assignment = rebalanceNpcRoles(laborMembers, npcById)
    const updates: Array<{ id: string; role: Role }> = []
    for (const m of laborMembers) {
      const next = assignment.get(m.id) ?? 'unassigned'
      if (next !== m.role) updates.push({ id: m.id, role: next })
    }
    if (updates.length === 0) { return }
    await Promise.all(updates.map(u =>
      supabase.from('community_members').update({ role: u.role }).eq('id', u.id)
    ))
    setMembers(prev => ({
      ...prev,
      [communityId]: (prev[communityId] ?? []).map(m => {
        const next = assignment.get(m.id)
        return next ? { ...m, role: next } : m
      }),
    }))
  }

  // Phase D — "Skip Week" pure clock bump. Advances week_number
  // without running a Weekly Check. Leaves consecutive_failures and
  // members untouched — nothing rolled, nothing consequenced. When
  // the GM runs the Weekly Check next, Mood carries from the prior
  // check's cmod_for_next (not the skipped weeks). Use for off-screen
  // time where the fiction doesn't demand mechanical resolution.
  async function handleSkipWeek(c: Community) {
    if (c.status === 'dissolved') return
    const nextWeek = c.week_number + 1
    if (!confirm(`Skip week ${nextWeek} for ${c.name}? Week counter advances; no rolls, no departures, no Mood change.`)) return
    const { error } = await supabase.from('communities')
      .update({ week_number: nextWeek })
      .eq('id', c.id)
    if (error) { alert(`Skip week failed: ${error.message}`); return }
    setCommunities(prev => prev.map(x => x.id === c.id ? { ...x, week_number: nextWeek } : x))
  }

  // Auto-successor picker per spec: next founder → longest-tenured
  // active member. Excludes a member id the caller wants to skip
  // (typically the outgoing leader). Returns null if no viable
  // successor exists (empty community).
  function pickAutoSuccessor(communityId: string, excludeMemberId?: string): Member | null {
    const mems = (members[communityId] ?? []).filter(m => m.id !== excludeMemberId && m.status !== 'pending')
    if (mems.length === 0) return null
    // 1) Other founders first.
    const founders = mems.filter(m => m.recruitment_type === 'founder')
    if (founders.length > 0) {
      // Founders ordered by joined_at ASC — earliest founder wins.
      return [...founders].sort((a, b) => (a.joined_at ?? '').localeCompare(b.joined_at ?? ''))[0]
    }
    // 2) Longest-tenured remaining member (smallest joined_at).
    return [...mems].sort((a, b) => (a.joined_at ?? '').localeCompare(b.joined_at ?? ''))[0]
  }

  // Step-down — current leader (or GM) abdicates. Successor can be
  // 'auto' (pickAutoSuccessor), '' (leave leaderless), or a member id.
  // Writes a null + optional re-set on communities.leader_* and
  // refreshes local state. Reuses handleSetLeader for the new-leader
  // path so the PC-vs-NPC user_id/npc_id branch stays in one place.
  async function handleStepDown(communityId: string, successor: string) {
    const c = communities.find(x => x.id === communityId)
    if (!c) return
    // Resolve successor member id.
    let targetMember: Member | null = null
    if (successor === 'auto') {
      // Exclude the current PC leader's member row if there is one
      // (founder match) — we don't want auto-pick to re-nominate them.
      const currentLeaderMember = (members[communityId] ?? []).find(m =>
        (c.leader_npc_id && m.npc_id === c.leader_npc_id)
        || (c.leader_user_id && m.invited_by_user_id === c.leader_user_id)
        || (c.leader_user_id && m.recruitment_type === 'founder' && m.character_id)
      ) ?? null
      targetMember = pickAutoSuccessor(communityId, currentLeaderMember?.id)
    } else if (successor !== '') {
      targetMember = (members[communityId] ?? []).find(m => m.id === successor) ?? null
    }
    // Null both leader fields first so an immediately-following
    // handleSetLeader writes a clean single-target update.
    const { error } = await supabase.from('communities')
      .update({ leader_user_id: null, leader_npc_id: null })
      .eq('id', communityId)
    if (error) { alert(`Step down failed: ${error.message}`); return }
    setCommunities(prev => prev.map(x => x.id === communityId
      ? { ...x, leader_user_id: null, leader_npc_id: null }
      : x))
    if (targetMember) {
      await handleSetLeader(communityId, {
        kind: targetMember.npc_id ? 'npc' : 'pc',
        memberId: targetMember.id,
      })
    }
    // Close the step-down panel.
    setStepDownCommunityId(null)
    setSuccessorChoice('auto')
  }

  // Change the community leader. Leader is either a PC (character_id
  // → leader_user_id lookup) or an NPC (leader_npc_id). Exactly one
  // is set at a time; the other is nulled.
  async function handleSetLeader(communityId: string, choice: { kind: 'pc' | 'npc'; memberId: string }) {
    const member = (members[communityId] ?? []).find(m => m.id === choice.memberId)
    if (!member) return
    let update: { leader_user_id: string | null; leader_npc_id: string | null } = {
      leader_user_id: null, leader_npc_id: null,
    }
    if (choice.kind === 'pc' && member.character_id) {
      // Need the user_id for the PC; look it up from campaign_members.
      const { data: cm } = await supabase.from('campaign_members')
        .select('user_id')
        .eq('campaign_id', campaignId)
        .eq('character_id', member.character_id)
        .maybeSingle()
      update.leader_user_id = (cm as any)?.user_id ?? null
    } else if (choice.kind === 'npc' && member.npc_id) {
      update.leader_npc_id = member.npc_id
    }
    const { error } = await supabase.from('communities').update(update).eq('id', communityId)
    if (error) { alert(`Leader change failed: ${error.message}`); return }
    setCommunities(prev => prev.map(c => c.id === communityId ? { ...c, ...update } : c))
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('communities').insert({
      campaign_id: campaignId,
      name: newName.trim(),
      description: newDesc.trim() || null,
      homestead_pin_id: newHomestead || null,
      leader_user_id: user?.id ?? null,
    }).select().single()
    if (error) { setCreating(false); alert(`Create failed: ${error.message}`); return }
    const newComm = data as Community
    // Auto-enroll the creator's PC as founding active member, so the
    // leader shows up in the roster and starts the member-count at 1.
    // Quietly skips if the creator doesn't have a PC in this campaign
    // (GM-only accounts, etc.).
    if (user?.id) {
      const { data: myCm } = await supabase
        .from('campaign_members')
        .select('character_id')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .not('character_id', 'is', null)
        .maybeSingle()
      const myCharacterId = (myCm as any)?.character_id as string | undefined
      if (myCharacterId) {
        // status omitted — DB default 'active' covers new schema,
        // missing-column old schema ignores the unsent field.
        const { data: founderRow, error: enrollErr } = await supabase.from('community_members').insert({
          community_id: newComm.id,
          character_id: myCharacterId,
          role: 'unassigned',
          recruitment_type: 'founder',
          joined_at: new Date().toISOString(),
        }).select().single()
        if (enrollErr) console.warn('[campaign-community] founder auto-enroll failed:', enrollErr.message)
        if (founderRow) {
          setMembers(prev => ({ ...prev, [newComm.id]: [founderRow as Member] }))
        }
      }
    }
    setCreating(false)
    setCommunities(prev => [...prev, newComm])
    setOpenId(newComm.id)
    setNewName(''); setNewDesc(''); setNewHomestead('')
    setShowCreate(false)
  }

  // ── Pending-request approve/reject (leader-only) ────────────────────
  async function handleApproveRequest(req: Member) {
    const { error } = await supabase
      .from('community_members')
      .update({ status: 'active', joined_at: new Date().toISOString() })
      .eq('id', req.id)
    if (error) { alert(`Approve failed: ${error.message}`); return }
    // Move from pending → active in local state.
    setPendingByCommunity(prev => {
      const n = { ...prev }
      n[req.community_id] = (n[req.community_id] ?? []).filter(m => m.id !== req.id)
      if (n[req.community_id].length === 0) delete n[req.community_id]
      return n
    })
    setMembers(prev => ({
      ...prev,
      [req.community_id]: [...(prev[req.community_id] ?? []), { ...req, status: 'active', joined_at: new Date().toISOString() }],
    }))
  }
  async function handleRejectRequest(req: Member) {
    if (!confirm('Reject this join request? The PC can try again later.')) return
    const { error } = await supabase.from('community_members').delete().eq('id', req.id)
    if (error) { alert(`Reject failed: ${error.message}`); return }
    setPendingByCommunity(prev => {
      const n = { ...prev }
      n[req.community_id] = (n[req.community_id] ?? []).filter(m => m.id !== req.id)
      if (n[req.community_id].length === 0) delete n[req.community_id]
      return n
    })
  }

  async function handleDeleteCommunity(c: Community) {
    if (!confirm(`Delete "${c.name}"? Removes all members and history.`)) return
    const { error } = await supabase.from('communities').delete().eq('id', c.id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setCommunities(prev => prev.filter(x => x.id !== c.id))
    setMembers(prev => { const n = { ...prev }; delete n[c.id]; return n })
    if (openId === c.id) setOpenId(null)
  }

  async function handleAddMember(communityId: string) {
    if (!addSubjectId) return
    const row: Partial<Member> = {
      community_id: communityId,
      role: addRole,
      recruitment_type: addType,
      npc_id: addKind === 'npc' ? addSubjectId : null,
      character_id: addKind === 'pc' ? addSubjectId : null,
    }
    const { data, error } = await supabase.from('community_members').insert(row).select().single()
    if (error) { alert(`Add failed: ${error.message}`); return }
    if (data) {
      setMembers(prev => ({ ...prev, [communityId]: [...(prev[communityId] ?? []), data as Member] }))
      setAddSubjectId('')
      setAddRole('unassigned')
      setAddType('member')
    }
  }

  async function handleRemoveMember(m: Member) {
    if (!confirm('Remove this member from the community?')) return
    // Soft-remove via left_at so history stays (Phase C morale consequences
    // want a record). For Phase A manual removal we'll still keep the row.
    const { error } = await supabase.from('community_members')
      .update({ left_at: new Date().toISOString(), left_reason: 'manual' })
      .eq('id', m.id)
    if (error) { alert(`Remove failed: ${error.message}`); return }
    // If the departing member was the acknowledged leader, auto-promote
    // per the step-down spec (next founder → longest-tenured remaining).
    // Optimistically update local members FIRST so pickAutoSuccessor
    // sees the post-removal roster; otherwise it could pick the
    // just-removed member as their own successor.
    setMembers(prev => ({
      ...prev,
      [m.community_id]: (prev[m.community_id] ?? []).filter(x => x.id !== m.id),
    }))
    const c = communities.find(x => x.id === m.community_id)
    const wasLeader = !!c && (
      (c.leader_npc_id && m.npc_id === c.leader_npc_id)
      || (c.leader_user_id && m.invited_by_user_id === c.leader_user_id)
    )
    if (wasLeader) {
      // Null both fields; pickAutoSuccessor now runs against the
      // reduced roster and hands over to handleSetLeader if possible.
      await supabase.from('communities')
        .update({ leader_user_id: null, leader_npc_id: null })
        .eq('id', m.community_id)
      setCommunities(prev => prev.map(x => x.id === m.community_id
        ? { ...x, leader_user_id: null, leader_npc_id: null }
        : x))
      const successor = pickAutoSuccessor(m.community_id, m.id)
      if (successor) {
        await handleSetLeader(m.community_id, {
          kind: successor.npc_id ? 'npc' : 'pc',
          memberId: successor.id,
        })
      }
    }
  }

  async function handleChangeRole(m: Member, role: Role) {
    const { error } = await supabase.from('community_members').update({ role }).eq('id', m.id)
    if (error) { alert(`Role change failed: ${error.message}`); return }
    setMembers(prev => ({
      ...prev,
      [m.community_id]: (prev[m.community_id] ?? []).map(x => x.id === m.id ? { ...x, role } : x),
    }))
  }

  // Helpers to resolve a member's display name
  function memberLabel(m: Member): string {
    if (m.npc_id) return npcs.find(n => n.id === m.npc_id)?.name ?? '(NPC)'
    if (m.character_id) return chars.find(c => c.id === m.character_id)?.name ?? '(PC)'
    return '(unknown)'
  }

  const openCommunity = communities.find(c => c.id === openId) ?? null
  const openMembers = openCommunity ? (members[openCommunity.id] ?? []) : []
  const openMembersByRole = useMemo(() => {
    const g: Record<Role, Member[]> = { gatherer: [], maintainer: [], safety: [], unassigned: [], assigned: [] }
    for (const m of openMembers) {
      // Defensive: if the DB returns an unexpected role (e.g. a
      // value from a future migration this frontend hasn't seen),
      // bucket it under 'unassigned' instead of crashing on a
      // missing key.
      const bucket = g[m.role] ?? g.unassigned
      bucket.push(m)
    }
    return g
  }, [openMembers])

  // Subjects eligible to be added — exclude anyone already in this community
  const availableNpcs = useMemo(() => {
    if (!openCommunity) return []
    const taken = new Set((members[openCommunity.id] ?? []).map(m => m.npc_id).filter(Boolean))
    return npcs.filter(n => !taken.has(n.id))
  }, [npcs, members, openCommunity])
  const availableChars = useMemo(() => {
    if (!openCommunity) return []
    const taken = new Set((members[openCommunity.id] ?? []).map(m => m.character_id).filter(Boolean))
    return chars.filter(c => !taken.has(c.id))
  }, [chars, members, openCommunity])

  if (loading) return <div style={{ padding: '1rem', color: '#cce0f5', fontSize: '13px' }}>Loading…</div>

  // ── Render ───────────────────────────────────────────────
  const chipBtn: React.CSSProperties = {
    padding: '4px 10px', background: 'transparent', border: '1px solid #7ab3d4',
    borderRadius: '3px', color: '#7ab3d4', fontSize: '14px',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', cursor: 'pointer',
  }
  const inp: React.CSSProperties = {
    width: '100%', padding: '5px 8px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee',
    fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'auto', flex: 1 }}>
      {/* Top controls */}
      <div>
        <button onClick={() => setShowCreate(v => !v)} style={chipBtn}>
          {showCreate ? 'Cancel' : '+ New Community'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '2px' }}>Name</div>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. The Mongrels" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '2px' }}>Description</div>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
          <div>
            <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '2px' }}>Homestead pin (optional)</div>
            <select value={newHomestead} onChange={e => setNewHomestead(e.target.value)} style={{ ...inp, appearance: 'none' }}>
              <option value="">— None —</option>
              {pins.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={handleCreate} disabled={creating || !newName.trim()}
            style={{ padding: '6px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', opacity: creating || !newName.trim() ? 0.5 : 1 }}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      )}

      {/* Community list */}
      {communities.length === 0 && !showCreate && (
        <div style={{ textAlign: 'center', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', padding: '2rem 1rem' }}>
          No communities yet
        </div>
      )}

      {communities.map(c => {
        const mems = members[c.id] ?? []
        const total = mems.length
        // Role minimums (Gatherers 33% / Maintainers 20% / Safety 5-10%)
        // apply to the NPC LABOR pool only. Exclusions:
        //   - PCs: they're players, not assigned labor.
        //   - `assigned` NPCs: off doing a PC-directed task, not
        //     pulling general role duty. They're still members
        //     (count toward total) but the denominator for role
        //     percentages excludes them.
        const npcMems = mems.filter(m => !!m.npc_id)
        const pcMems = mems.filter(m => !!m.character_id)
        const laborPool = npcMems.filter(m => m.role !== 'assigned')
        const laborTotal = laborPool.length
        const npcTotal = npcMems.length
        const isCommunity = total >= 13
        const isOpen = openId === c.id
        const gatherPct = laborTotal > 0 ? Math.round(100 * laborPool.filter(m => m.role === 'gatherer').length / laborTotal) : 0
        const maintainPct = laborTotal > 0 ? Math.round(100 * laborPool.filter(m => m.role === 'maintainer').length / laborTotal) : 0
        const safetyPct = laborTotal > 0 ? Math.round(100 * laborPool.filter(m => m.role === 'safety').length / laborTotal) : 0
        // Founder = the recruitment_type='founder' row (first PC who
        // created the community). There can be multiple founders if
        // several PCs are marked founder; we display the first.
        const founderMember = mems.find(m => m.recruitment_type === 'founder')
        const founderName = founderMember ? memberLabel(founderMember) : null
        // Leader resolution. Precedence:
        //   1. Explicit NPC leader (leader_npc_id on the community)
        //   2. Explicit PC leader (leader_user_id) — matched back to
        //      a member via invited_by_user_id (best-effort; may miss
        //      for pre-migration founders)
        //   3. Fallback: the founder (first recruitment_type='founder')
        //      unless they've explicitly stepped down. "Stepped down"
        //      mechanism is queued in tasks/todo.md — for now, any
        //      non-null leader_* column counts as "set".
        const leaderMember = (() => {
          if (c.leader_npc_id) return mems.find(m => m.npc_id === c.leader_npc_id) ?? null
          if (c.leader_user_id) {
            const match = mems.find(m => m.invited_by_user_id === c.leader_user_id)
            if (match) return match
          }
          // Default to founder
          return mems.find(m => m.recruitment_type === 'founder') ?? null
        })()
        return (
          <div key={c.id} style={{ background: '#1a1a1a', border: `1px solid ${isOpen ? '#7ab3d4' : '#2e2e2e'}`, borderRadius: '4px' }}>
            {/* Header */}
            <div onClick={() => setOpenId(isOpen ? null : c.id)}
              style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '17px', fontWeight: 700, color: '#f5f2ee', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ fontSize: '14px', padding: '1px 6px', borderRadius: '2px', background: c.status === 'dissolved' ? '#2a1210' : isCommunity ? '#1a2e10' : '#2a2010', color: c.status === 'dissolved' ? '#f5a89a' : isCommunity ? '#7fc458' : '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {c.status === 'dissolved' ? 'Dissolved' : isCommunity ? 'Community' : 'Group'}
                  </span>
                </div>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {total} member{total === 1 ? '' : 's'}
                  {founderName && <> · <span style={{ color: '#EF9F27' }}>Founder:</span> <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{founderName}</span></>}
                  {!isCommunity && total > 0 && ` · ${13 - total} more for Community`}
                </div>
              </div>
              <span style={{ fontSize: '14px', color: '#5a5550' }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Body */}
            {isOpen && (
              <div style={{ padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {c.description && (
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>{c.description}</div>
                )}

                {/* Leader — call-out + dropdown. The current leader
                    is shown bold; selecting a new member from the
                    dropdown calls handleSetLeader which writes the
                    correct leader_user_id / leader_npc_id on the
                    community row.
                    Step Down button is visible when (a) the viewer
                    is a GM, or (b) the viewer is the PC leader
                    (leader_user_id matches their auth uid). NPCs
                    obviously can't click buttons, so NPC-leader
                    step-downs are always GM-driven. */}
                {(() => {
                  const iAmLeader = !!myUserId && c.leader_user_id === myUserId
                  const canStepDown = (isGM || iAmLeader) && !!leaderMember
                  const autoSuccessorMember = pickAutoSuccessor(c.id, leaderMember?.id)
                  const stepDownOpen = stepDownCommunityId === c.id
                  return (
                    <div style={{ padding: '10px 12px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>Leader</span>
                        <select
                          value={leaderMember?.id ?? ''}
                          onChange={e => {
                            if (!e.target.value) return
                            const mem = mems.find(m => m.id === e.target.value)
                            if (!mem) return
                            handleSetLeader(c.id, { kind: mem.npc_id ? 'npc' : 'pc', memberId: mem.id })
                          }}
                          style={{ flex: 1, padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', appearance: 'none' }}>
                          <option value="">— pick a leader —</option>
                          {mems.map(m => (
                            <option key={m.id} value={m.id}>{memberLabel(m)}{m.npc_id ? ' (NPC)' : ' (PC)'}</option>
                          ))}
                        </select>
                        {canStepDown && (
                          <button onClick={() => { setStepDownCommunityId(stepDownOpen ? null : c.id); setSuccessorChoice('auto') }}
                            title={iAmLeader && !isGM ? 'Step down as leader of this community' : 'Force the current leader to step down'}
                            style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                            {stepDownOpen ? 'Cancel' : 'Step Down'}
                          </button>
                        )}
                      </div>
                      {stepDownOpen && (
                        <div style={{ padding: '10px', background: '#0f1a2e', border: '1px solid #1a3a5c', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
                            <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{leaderMember ? memberLabel(leaderMember) : 'The leader'}</span> is stepping down. Pick a successor:
                          </div>
                          <select value={successorChoice} onChange={e => setSuccessorChoice(e.target.value)}
                            style={{ padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', appearance: 'none' }}>
                            <option value="auto">Auto-pick{autoSuccessorMember ? ` — ${memberLabel(autoSuccessorMember)}${autoSuccessorMember.npc_id ? ' (NPC)' : ' (PC)'}` : ' — none available'}</option>
                            <option value="">— Leave leaderless (−1 Clear Voice on next Morale) —</option>
                            {mems.filter(m => m.id !== leaderMember?.id).map(m => (
                              <option key={m.id} value={m.id}>{memberLabel(m)}{m.npc_id ? ' (NPC)' : ' (PC)'}</option>
                            ))}
                          </select>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => { setStepDownCommunityId(null); setSuccessorChoice('auto') }}
                              style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                              Cancel
                            </button>
                            <button onClick={() => handleStepDown(c.id, successorChoice)}
                              style={{ padding: '6px 14px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                              Confirm Step Down
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Phase C — Weekly Check button. Shows only when the
                    Group has crossed the 13-member threshold AND isn't
                    already dissolved AND the viewer is a GM. Opens the
                    Morale modal which handles Fed → Clothed → Morale
                    in one button-press with per-roll CMod inputs and
                    auto-filled slot suggestions. */}
                {isGM && isCommunity && c.status !== 'dissolved' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#0f1a2e', border: '1px solid #1a3a5c', borderRadius: '3px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                        📊 Weekly Check
                      </div>
                      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        Week {c.week_number + 1} · {c.consecutive_failures}/3 consecutive failures
                        {c.consecutive_failures === 2 && <span style={{ color: '#f5a89a', fontWeight: 600 }}> · one more failure dissolves the community</span>}
                      </div>
                    </div>
                    <button onClick={() => handleSkipWeek(c)}
                      title="Advance the community's week counter without rolling. Use for off-screen time — Morale / resource consequences only apply on an actual Weekly Check."
                      style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Skip Week
                    </button>
                    <button onClick={() => setMoraleCommunityId(c.id)}
                      style={{ padding: '8px 14px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                      Run Weekly Check
                    </button>
                  </div>
                )}

                {/* Pending-requests — only visible to the leader (or
                    GMs, which the wider RLS already permits). Approve
                    flips status to 'active' + sets joined_at; Reject
                    deletes the row. */}
                {(() => {
                  const pending = pendingByCommunity[c.id] ?? []
                  const iLead = !!myUserId && myUserId === (c as any).leader_user_id
                  if (pending.length === 0 || (!iLead && !isGM)) return null
                  return (
                    <div style={{ padding: '12px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '4px' }}>
                      <div style={{ fontSize: '14px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
                        ⏳ Pending Requests ({pending.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pending.map(req => (
                          <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                            <span style={{ flex: 1, fontSize: '14px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                              {memberLabel(req)}
                            </span>
                            <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                              {RECRUITMENT_LABEL[req.recruitment_type]}
                            </span>
                            <button onClick={() => handleApproveRequest(req)}
                              style={{ padding: '4px 12px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                              Approve
                            </button>
                            <button onClick={() => handleRejectRequest(req)}
                              style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#c0392b', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                              Reject
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Role bars — percentages are over NPC workforce only.
                    PCs don't pull down role coverage since they aren't
                    assigned labor. The "Re-balance" button triggers
                    the quota-aware allocator manually. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Role Coverage</div>
                  <button onClick={() => handleRebalance(c.id)}
                    style={{ padding: '4px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                    title="Auto-sort NPCs by skill to hit SRD minimums">
                    ⚖ Re-balance Roles
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(['gatherer', 'maintainer', 'safety'] as Role[]).map(r => {
                    const pct = r === 'gatherer' ? gatherPct : r === 'maintainer' ? maintainPct : safetyPct
                    const min = ROLE_MIN_PCT[r]
                    const max = ROLE_MAX_PCT[r]
                    const count = laborPool.filter(m => m.role === r).length
                    const ok = pct >= min && pct <= max
                    return (
                      <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        <span style={{ width: '110px', color: '#cce0f5', letterSpacing: '.04em', textTransform: 'uppercase' }}>{ROLE_LABEL[r]}</span>
                        <div style={{ flex: 1, height: '12px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: ok ? '#7fc458' : '#c0392b', transition: 'width 0.2s' }} />
                        </div>
                        <span style={{ width: '70px', textAlign: 'right', color: ok ? '#7fc458' : '#c0392b' }}>
                          {count} ({pct}%)
                        </span>
                        <span title={`Target: ${min}${max < 100 ? `-${max}` : '+'}%`} style={{ fontSize: '14px', color: '#5a5550', width: '70px', textAlign: 'right' }}>
                          {min}{max < 100 ? `-${max}` : '+'}%
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Row renderer shared between PCs and NPCs. The primary
                    label is the CHARACTER NAME (what used to say COHORT /
                    FOUNDER). Recruitment type becomes a small subtext
                    under the name. Apprentice rows expose their master
                    PC inline ("Apprentice ⇐ Stellan Yardley") so players
                    can see who's apprenticed to whom at a glance. */}
                {(() => {
                  const renderRow = (m: Member, accent: string) => {
                    // Name is always the dominant visual — bigger font,
                    // takes all remaining flex space. Apprentice rows
                    // get their master appended inline so the chain
                    // reads at a glance without a second line of text.
                    const rawName = memberLabel(m)
                    const masterName = m.apprentice_of_character_id
                      ? (chars.find(c => c.id === m.apprentice_of_character_id)?.name ?? null)
                      : null
                    const displayName = m.recruitment_type === 'apprentice' && masterName
                      ? `${rawName} ⇐ ${masterName}`
                      : rawName
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#111', border: `1px solid ${accent}`, borderRadius: '2px' }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayName || (m.npc_id ? '(NPC)' : '(PC)')}
                        </span>
                        <select value={m.role} onChange={e => handleChangeRole(m, e.target.value as Role)}
                          style={{ width: '110px', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                          {(Object.keys(ROLE_LABEL) as Role[]).map(ro => <option key={ro} value={ro}>{ROLE_LABEL[ro]}</option>)}
                        </select>
                        <button onClick={() => handleRemoveMember(m)} title="Remove"
                          style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '16px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
                      </div>
                    )
                  }

                  return (
                    <>
                      {/* PC block — between the role bars and NPC roster */}
                      {pcMems.length > 0 && (
                        <div>
                          <div style={{ fontSize: '14px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Player Characters ({pcMems.length})</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {pcMems.map(m => renderRow(m, '#2e2e4a'))}
                          </div>
                        </div>
                      )}

                      {/* NPC roster grouped by role. Order: labor roles
                          (Gatherers, Maintainers, Safety), then Assigned
                          (PC-directed tasks), then Unassigned (idle).
                          Assigned gets a purple accent so it reads as
                          distinct from the general workforce. */}
                      {(['gatherer', 'maintainer', 'safety', 'assigned', 'unassigned'] as Role[]).map(r => {
                        const list = openMembersByRole[r].filter(m => !!m.npc_id)
                        if (list.length === 0) return null
                        const headerColor = r === 'assigned' ? '#d48bd4' : '#EF9F27'
                        const rowAccent = r === 'assigned' ? '#5a2e5a' : '#2e2e2e'
                        return (
                          <div key={r}>
                            <div style={{ fontSize: '14px', color: headerColor, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>{ROLE_LABEL[r]} ({list.length})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {list.map(m => renderRow(m, rowAccent))}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )
                })()}

                {/* Add member */}
                {(availableNpcs.length > 0 || availableChars.length > 0) && (
                  <div style={{ padding: '14px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
                    <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 600 }}>Add Member</div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <select value={addKind} onChange={e => { setAddKind(e.target.value as 'npc' | 'pc'); setAddSubjectId('') }}
                        style={{ padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                        <option value="npc">NPC</option>
                        <option value="pc">PC</option>
                      </select>
                      <select value={addSubjectId} onChange={e => setAddSubjectId(e.target.value)}
                        style={{ flex: 1, padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                        <option value="">— choose —</option>
                        {(addKind === 'npc' ? availableNpcs : availableChars).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <select value={addRole} onChange={e => setAddRole(e.target.value as Role)}
                        style={{ flex: 1, padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                        {(Object.keys(ROLE_LABEL) as Role[]).map(ro => <option key={ro} value={ro}>{ROLE_LABEL[ro]}</option>)}
                      </select>
                      <select value={addType} onChange={e => setAddType(e.target.value as RecruitmentType)}
                        style={{ flex: 1, padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                        {(Object.keys(RECRUITMENT_LABEL) as RecruitmentType[]).map(rt => <option key={rt} value={rt}>{RECRUITMENT_LABEL[rt]}</option>)}
                      </select>
                    </div>
                    <button onClick={() => handleAddMember(c.id)} disabled={!addSubjectId}
                      style={{ padding: '8px 16px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: addSubjectId ? 'pointer' : 'not-allowed', opacity: addSubjectId ? 1 : 0.5, fontWeight: 600 }}>
                      + Add
                    </button>
                  </div>
                )}

                {/* Danger zone */}
                <button onClick={() => handleDeleteCommunity(c)}
                  style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '2px', color: '#c0392b', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start' }}>
                  Delete Community
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Phase C — Weekly Check modal. Rendered once at top level;
          the individual community cards just set moraleCommunityId
          to open it. Success → reload the whole panel so the updated
          week_number / consecutive_failures / member roster all
          reflect the just-committed check. */}
      {moraleCommunityId && (() => {
        const comm = communities.find(c => c.id === moraleCommunityId)
        if (!comm) return null
        const mems = members[moraleCommunityId] ?? []
        const nameMap = new Map<string, string>()
        for (const m of mems) nameMap.set(m.id, memberLabel(m))
        return (
          <CommunityMoraleModal
            open
            onClose={() => setMoraleCommunityId(null)}
            community={comm}
            members={mems}
            memberNameById={nameMap}
            campaignId={campaignId}
            userId={myUserId}
            onComplete={() => { setMoraleCommunityId(null); load() }}
          />
        )
      })()}
    </div>
  )
}

export { CommunityTAB_LABEL }
