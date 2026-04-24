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
  // Phase D Apprentice task delegation — freeform "current task" the
  // GM (eventually also the master PC) can set on an Apprentice NPC
  // or an Assigned NPC. Null = idle. Column added via
  // sql/community-members-add-current-task.sql.
  current_task: string | null
  // "Assigned" role mission linkage — character_id of the PC directing
  // this NPC's off-screen work. Only meaningful when role='assigned';
  // cleared automatically when the role changes back. Column added via
  // sql/community-members-add-assignment-pc.sql. FK with ON DELETE
  // SET NULL so a deleted PC silently clears the assignment.
  assignment_pc_id: string | null
}

interface NpcOption {
  id: string
  name: string
  // skills.entries drives auto-assign. Shape: { entries: [{ name, level }] }
  skills?: { entries?: { name: string; level: number }[] } | null
}
interface CharOption { id: string; name: string }
interface PinOption { id: string; name: string; lat?: number | null; lng?: number | null }

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
  // Last-5 Morale outcomes per community, newest-first. Drives the
  // "Recent Morale" trend chip strip on the At-a-Glance block.
  const [recentMorale, setRecentMorale] = useState<Record<string, { week_number: number; outcome: string }[]>>({})
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

  // Phase D — Apprentice task delegation. Null = no row in edit mode.
  // memberId = that apprentice row shows an inline input. Draft holds
  // the in-progress text; save writes to community_members.current_task.
  const [editingTaskMemberId, setEditingTaskMemberId] = useState<string | null>(null)
  const [taskDraft, setTaskDraft] = useState<string>('')

  // "Assigned" role mission linkage — modal that opens when a member's
  // role flips to 'assigned'. Captures directing PC + task text, writes
  // both plus the role in a single update. Null = modal closed.
  const [assigningMember, setAssigningMember] = useState<Member | null>(null)
  const [assignmentPcDraft, setAssignmentPcDraft] = useState<string>('')
  const [assignmentTaskDraft, setAssignmentTaskDraft] = useState<string>('')

  // Phase E Sprint 4e — Migration on dissolution. After a community
  // dissolves (3-failure), the GM can offer surviving NPCs to nearby
  // published communities. Receiver GMs accept or decline. MVP scope:
  // offer + narrative + notification; auto NPC copy on acceptance is
  // a follow-up.
  const [migrationCommunityId, setMigrationCommunityId] = useState<string | null>(null)
  const [migrationTargetId, setMigrationTargetId] = useState<string>('')
  const [migrationPickedIds, setMigrationPickedIds] = useState<Set<string>>(new Set())
  const [migrationNarrative, setMigrationNarrative] = useState<string>('')
  const [migrationSubmitting, setMigrationSubmitting] = useState<boolean>(false)
  // Survivors per dissolved community (community_members where
  // left_reason='dissolved'). Loaded alongside members.
  const [dissolvedSurvivors, setDissolvedSurvivors] = useState<Record<string, Member[]>>({})
  // All approved world_communities for the migration target picker.
  // Includes the source (rare; allowed to GM-decide; we filter UI-side).
  const [migrationTargets, setMigrationTargets] = useState<{
    id: string; name: string; size_band: string; faction_label: string | null
  }[]>([])

  // Phase E Sprint 4d — Schism. A large community splits in two: the
  // original keeps its roster minus the breakaway, the breakaway is
  // a brand-new community (same campaign) with the picked members
  // and an optional new Homestead pin. Lineage preserved by
  // soft-removing the breakaway members from the original with
  // left_reason='schism' and inserting fresh rows in the new
  // community.
  const [schismCommunityId, setSchismCommunityId] = useState<string | null>(null)
  const [schismName, setSchismName] = useState<string>('')
  const [schismDescription, setSchismDescription] = useState<string>('')
  const [schismHomesteadPinId, setSchismHomesteadPinId] = useState<string>('')
  const [schismPickedIds, setSchismPickedIds] = useState<Set<string>>(new Set())
  const [schismSubmitting, setSchismSubmitting] = useState<boolean>(false)

  // Phase E — Publish to Distemperverse modal. When set, the publish
  // confirmation UI renders for that community. Faction label is GM
  // freeform; captured pre-commit so the GM sees what goes public
  // before the row is actually inserted.
  const [publishingCommunityId, setPublishingCommunityId] = useState<string | null>(null)
  const [publishFactionLabel, setPublishFactionLabel] = useState<string>('')
  const [publishing, setPublishing] = useState<boolean>(false)
  // World-row lookup per community id. Loaded alongside members;
  // drives the "Published" chip + button state on each community
  // (Publish vs. Update vs. Unpublish).
  const [worldRows, setWorldRows] = useState<Record<string, {
    id: string
    moderation_status: 'pending' | 'approved' | 'rejected'
    community_status: string
    size_band: string
    faction_label: string | null
    last_public_update_at: string
  }>>({})

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
      supabase.from('campaign_pins').select('id, name, lat, lng').eq('campaign_id', campaignId).order('name'),
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
      // Parallel — recent Morale outcomes for each community. Small
      // window (6 rows per community) for the trend chip strip; we
      // DESC order them by week and slice to 5 on the client so we
      // have room to filter/adjust display later.
      const moraleRes = await supabase
        .from('community_morale_checks')
        .select('community_id, week_number, outcome')
        .in('community_id', coms.map(c => c.id))
        .order('week_number', { ascending: false })
      const moraleByCom: Record<string, { week_number: number; outcome: string }[]> = {}
      for (const row of ((moraleRes.data ?? []) as any[])) {
        const cid = row.community_id as string
        if (!moraleByCom[cid]) moraleByCom[cid] = []
        if (moraleByCom[cid].length < 5) moraleByCom[cid].push({ week_number: row.week_number, outcome: row.outcome })
      }
      setRecentMorale(moraleByCom)
      // Phase E — world-facing mirror rows. One-per-source so we can
      // index by community_id. Read policies let campaign members see
      // their own pending rows, so this works for GMs mid-moderation
      // too.
      const worldRes = await supabase
        .from('world_communities')
        .select('id, source_community_id, moderation_status, community_status, size_band, faction_label, last_public_update_at')
        .in('source_community_id', coms.map(c => c.id))
      const worldByCom: typeof worldRows = {}
      for (const w of (worldRes.data ?? []) as any[]) {
        worldByCom[w.source_community_id] = {
          id: w.id,
          moderation_status: w.moderation_status,
          community_status: w.community_status,
          size_band: w.size_band,
          faction_label: w.faction_label,
          last_public_update_at: w.last_public_update_at,
        }
      }
      setWorldRows(worldByCom)
      // Phase E Sprint 4e — survivors per dissolved community for
      // the Migration modal. Soft-removed rows with left_reason
      // 'dissolved' are the eligible offer pool.
      const dissolvedComIds = coms.filter(c => c.status === 'dissolved').map(c => c.id)
      if (dissolvedComIds.length > 0) {
        const { data: survivors } = await supabase
          .from('community_members')
          .select('*')
          .in('community_id', dissolvedComIds)
          .eq('left_reason', 'dissolved')
        const byCom: Record<string, Member[]> = {}
        for (const m of (survivors ?? []) as Member[]) {
          (byCom[m.community_id] ||= []).push(m)
        }
        setDissolvedSurvivors(byCom)
      } else {
        setDissolvedSurvivors({})
      }
      // Migration target picker — every approved world_community is
      // a potential destination. RLS already exposes approved rows
      // publicly so this query is unauthenticated-friendly.
      const { data: targets } = await supabase
        .from('world_communities')
        .select('id, name, size_band, faction_label')
        .eq('moderation_status', 'approved')
        .order('name')
      setMigrationTargets((targets ?? []) as any[])
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

  // ── Phase E Sprint 4e — Migration handlers ──────────────────────
  function openMigrationModal(c: Community) {
    setMigrationCommunityId(c.id)
    setMigrationTargetId('')
    setMigrationPickedIds(new Set())
    setMigrationNarrative('')
  }
  function closeMigrationModal() {
    if (migrationSubmitting) return
    setMigrationCommunityId(null)
    setMigrationTargetId('')
    setMigrationPickedIds(new Set())
    setMigrationNarrative('')
  }
  function toggleMigrationMember(memberId: string) {
    setMigrationPickedIds(prev => {
      const next = new Set(prev)
      next.has(memberId) ? next.delete(memberId) : next.add(memberId)
      return next
    })
  }
  // Submit: insert one community_migrations row per picked NPC, all
  // pointing at the chosen target. Each insert fires the notify
  // trigger so the target GM gets one notification per migrant.
  async function handleMigration() {
    if (!migrationCommunityId || migrationSubmitting) return
    if (!migrationTargetId) { alert('Pick a target community for the survivors.'); return }
    if (migrationPickedIds.size === 0) { alert('Pick at least one survivor to offer.'); return }
    const original = communities.find(c => c.id === migrationCommunityId)
    if (!original) return
    const survivors = (dissolvedSurvivors[migrationCommunityId] ?? []).filter(m => migrationPickedIds.has(m.id) && m.npc_id)
    if (survivors.length === 0) return
    setMigrationSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    // Resolve npc names for the snapshot so the notification shows
    // them even if the source NPC is later deleted.
    const npcById = new Map(npcs.map(n => [n.id, n.name]))
    const rows = survivors.map(m => ({
      source_community_id: original.id,
      source_community_name: original.name,
      source_member_id: m.id,
      source_npc_id: m.npc_id,
      npc_name: npcById.get(m.npc_id!) ?? '(unknown)',
      target_world_community_id: migrationTargetId,
      offered_by_user_id: user?.id ?? null,
      narrative: migrationNarrative.trim() || null,
    }))
    const { error } = await supabase.from('community_migrations').insert(rows)
    setMigrationSubmitting(false)
    if (error) { alert(`Migration offer failed: ${error.message}`); return }
    setMigrationCommunityId(null)
    setMigrationTargetId('')
    setMigrationPickedIds(new Set())
    setMigrationNarrative('')
    alert(`Sent ${rows.length} migration offer${rows.length === 1 ? '' : 's'}. The receiving GM will see them in their notifications.`)
  }

  // ── Phase E Sprint 4d — Schism handlers ──────────────────────────
  function openSchismModal(c: Community) {
    setSchismCommunityId(c.id)
    setSchismName(`${c.name} Breakaway`)
    setSchismDescription('')
    setSchismHomesteadPinId('')
    setSchismPickedIds(new Set())
  }
  function closeSchismModal() {
    if (schismSubmitting) return
    setSchismCommunityId(null)
    setSchismName('')
    setSchismDescription('')
    setSchismHomesteadPinId('')
    setSchismPickedIds(new Set())
  }
  function toggleSchismMember(memberId: string) {
    setSchismPickedIds(prev => {
      const next = new Set(prev)
      next.has(memberId) ? next.delete(memberId) : next.add(memberId)
      return next
    })
  }
  // Commit the split: insert the new community, soft-remove picked
  // members from the original with reason='schism', insert fresh
  // member rows in the new community preserving role +
  // recruitment_type. Apprentice bonds carry over because
  // apprentice_of_character_id is just a uuid that doesn't care
  // which community contains the apprentice.
  async function handleSchism() {
    if (!schismCommunityId || schismSubmitting) return
    if (!schismName.trim()) { alert('Give the breakaway community a name.'); return }
    if (schismPickedIds.size === 0) { alert('Pick at least one member to leave with the breakaway.'); return }
    const original = communities.find(c => c.id === schismCommunityId)
    if (!original) return
    const sourceMembers = (members[schismCommunityId] ?? []).filter(m => schismPickedIds.has(m.id))
    if (sourceMembers.length === 0) return
    setSchismSubmitting(true)
    const now = new Date().toISOString()
    // 1) Create the new community.
    const { data: newCommRow, error: cErr } = await supabase
      .from('communities')
      .insert({
        campaign_id: campaignId,
        name: schismName.trim(),
        description: schismDescription.trim() || `Splintered from ${original.name}.`,
        homestead_pin_id: schismHomesteadPinId || null,
      })
      .select()
      .single()
    if (cErr || !newCommRow) {
      setSchismSubmitting(false)
      alert(`Schism failed at community create: ${cErr?.message ?? 'unknown'}`)
      return
    }
    const newComm = newCommRow as Community
    // 2) Soft-remove the picked members from the original. Try
    //    'schism' first; if the CHECK constraint hasn't been widened
    //    yet on this DB, fall back to 'manual' so the schism still
    //    proceeds (the new rows in the new community are the source
    //    of truth either way).
    let removeErr = (await supabase.from('community_members')
      .update({ left_at: now, left_reason: 'schism' })
      .in('id', Array.from(schismPickedIds))).error
    if (removeErr) {
      removeErr = (await supabase.from('community_members')
        .update({ left_at: now, left_reason: 'manual' })
        .in('id', Array.from(schismPickedIds))).error
    }
    if (removeErr) {
      setSchismSubmitting(false)
      alert(`Schism failed at member removal: ${removeErr.message}`)
      return
    }
    // 3) Insert fresh member rows in the new community.
    const newMemberRows = sourceMembers.map(m => ({
      community_id: newComm.id,
      npc_id: m.npc_id,
      character_id: m.character_id,
      role: m.role,
      recruitment_type: m.recruitment_type,
      apprentice_of_character_id: m.apprentice_of_character_id,
      joined_at: now,
    }))
    const { error: insErr } = await supabase.from('community_members').insert(newMemberRows)
    if (insErr) {
      setSchismSubmitting(false)
      alert(`Schism partial: new community created + members removed but the new roster insert failed: ${insErr.message}. You may need to add the breakaway members manually.`)
      return
    }
    setSchismSubmitting(false)
    setSchismCommunityId(null)
    setSchismName('')
    setSchismDescription('')
    setSchismHomesteadPinId('')
    setSchismPickedIds(new Set())
    // Reload to pick up the new community + roster reshuffle.
    await load()
  }

  // ── Phase E — Publish to Distemperverse ─────────────────────────
  // Size band derived from actual roster count. Anchored to Distemper
  // narrative scale: sub-13 is pre-Community "Small", then Band at
  // the 13-member Community threshold, then wider steps through
  // Settlement / Enclave / City. GM can override post-publish by
  // updating the world row directly (not wired in this sprint).
  function computeSizeBand(n: number): 'Small' | 'Band' | 'Settlement' | 'Enclave' | 'City' {
    if (n < 13) return 'Small'
    if (n < 33) return 'Band'
    if (n < 100) return 'Settlement'
    if (n < 500) return 'Enclave'
    return 'City'
  }
  // Public status (Thriving / Holding / Struggling / Dying / Dissolved)
  // derived from the community's current state at publish time:
  //   - dissolved → Dissolved
  //   - consecutive_failures >= 2 → Dying
  //   - consecutive_failures == 1 → Struggling
  //   - last Morale was Wild Success / High Insight → Thriving
  //   - otherwise Holding (steady or no recent check)
  function computePublicStatus(c: Community): 'Thriving' | 'Holding' | 'Struggling' | 'Dying' | 'Dissolved' {
    if (c.status === 'dissolved') return 'Dissolved'
    if (c.consecutive_failures >= 2) return 'Dying'
    if (c.consecutive_failures === 1) return 'Struggling'
    const last = recentMorale[c.id]?.[0]?.outcome?.toLowerCase().replace(/ /g, '_') ?? ''
    if (last === 'wild_success' || last === 'high_insight') return 'Thriving'
    return 'Holding'
  }

  // Open the Publish modal. Pre-seeds faction_label from the existing
  // world row if already published (→ this becomes an "Update" flow).
  function openPublishModal(communityId: string) {
    const world = worldRows[communityId]
    setPublishFactionLabel(world?.faction_label ?? '')
    setPublishingCommunityId(communityId)
  }
  function closePublishModal() {
    if (publishing) return  // don't yank the modal mid-write
    setPublishingCommunityId(null)
    setPublishFactionLabel('')
  }

  // Commit a publish (INSERT) or republish (UPDATE). Also fetches
  // the community's homestead pin lat/lng if one is set so the
  // world map has something to plot. On insert, updates the source
  // community's world_visibility + world_community_id so the UI
  // chip flips to "Published" immediately.
  async function handlePublish() {
    if (!publishingCommunityId || publishing) return
    const c = communities.find(x => x.id === publishingCommunityId)
    if (!c) return
    setPublishing(true)
    const { data: { user } } = await supabase.auth.getUser()
    // Fetch Homestead coords if set. No homestead = null lat/lng,
    // which keeps the world row valid but leaves it off the map.
    let lat: number | null = null
    let lng: number | null = null
    if (c.homestead_pin_id) {
      const { data: pin } = await supabase
        .from('campaign_pins')
        .select('lat, lng')
        .eq('id', c.homestead_pin_id)
        .maybeSingle()
      if (pin) { lat = (pin as any).lat ?? null; lng = (pin as any).lng ?? null }
    }
    const total = (members[c.id] ?? []).length
    const sizeBand = computeSizeBand(total)
    const publicStatus = computePublicStatus(c)
    const factionLabel = publishFactionLabel.trim() || null
    const now = new Date().toISOString()
    const existing = worldRows[c.id]
    if (existing) {
      // Republish — patch the public-facing fields. Moderation state
      // is preserved (a GM updating their community's public card
      // doesn't re-trigger Thriver moderation for now; major changes
      // could eventually flip it back to pending but we don't want
      // to block every tiny description tweak).
      const { error } = await supabase.from('world_communities')
        .update({
          name: c.name,
          description: c.description,
          homestead_lat: lat,
          homestead_lng: lng,
          size_band: sizeBand,
          faction_label: factionLabel,
          community_status: publicStatus,
          last_public_update_at: now,
        })
        .eq('id', existing.id)
      if (error) { setPublishing(false); alert(`Publish update failed: ${error.message}`); return }
      setWorldRows(prev => ({
        ...prev,
        [c.id]: { ...prev[c.id], size_band: sizeBand, faction_label: factionLabel, community_status: publicStatus, last_public_update_at: now },
      }))
    } else {
      // First publish. Insert the world row with status='pending' so
      // Thriver moderation gates visibility on the world map (sprint 2).
      const { data, error } = await supabase.from('world_communities').insert({
        source_community_id: c.id,
        source_campaign_id: campaignId,
        published_by: user?.id ?? null,
        name: c.name,
        description: c.description,
        homestead_lat: lat,
        homestead_lng: lng,
        size_band: sizeBand,
        faction_label: factionLabel,
        community_status: publicStatus,
        moderation_status: 'pending',
        last_public_update_at: now,
      }).select('id, moderation_status, community_status, size_band, faction_label, last_public_update_at').single()
      if (error || !data) { setPublishing(false); alert(`Publish failed: ${error?.message ?? 'unknown'}`); return }
      // Back-link on the source community so the UI chip + future
      // cross-campaign lookups can find the world row cheaply.
      await supabase.from('communities')
        .update({
          world_visibility: 'published',
          world_community_id: (data as any).id,
          published_at: now,
        })
        .eq('id', c.id)
      setCommunities(prev => prev.map(x => x.id === c.id
        ? { ...x, world_visibility: 'published' as const }
        : x))
      setWorldRows(prev => ({ ...prev, [c.id]: data as any }))
    }
    setPublishing(false)
    setPublishingCommunityId(null)
    setPublishFactionLabel('')
  }

  // Unpublish — deletes the world row (CASCADE relies on the source
  // community unique constraint so this is idempotent). Reverts the
  // source community's world_visibility to 'private' and clears the
  // back-link. Existing moderation is discarded; next publish goes
  // through the pending queue fresh.
  async function handleUnpublish(communityId: string) {
    const world = worldRows[communityId]
    if (!world) return
    if (!confirm('Remove this community from the Distemperverse? It will disappear from the world map. Republishing later will go back through Thriver moderation.')) return
    const { error } = await supabase.from('world_communities').delete().eq('id', world.id)
    if (error) { alert(`Unpublish failed: ${error.message}`); return }
    await supabase.from('communities')
      .update({ world_visibility: 'private', world_community_id: null, published_at: null })
      .eq('id', communityId)
    setCommunities(prev => prev.map(x => x.id === communityId
      ? { ...x, world_visibility: 'private' as const }
      : x))
    setWorldRows(prev => {
      const n = { ...prev }
      delete n[communityId]
      return n
    })
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

  // ── Homestead pin setter ────────────────────────────────────────
  // The Homestead is the pin a published community shows up at on the
  // world map. Settable at create time (the New Community form), at
  // schism time (the breakaway's form), and here — inline on any
  // existing community body, GM-only. A null value removes the link
  // (community falls back to "unlocated" on publish).
  async function handleSetHomestead(communityId: string, pinId: string | null) {
    const { error } = await supabase
      .from('communities')
      .update({ homestead_pin_id: pinId })
      .eq('id', communityId)
    if (error) { alert(`Homestead change failed: ${error.message}`); return }
    setCommunities(prev => prev.map(c => c.id === communityId ? { ...c, homestead_pin_id: pinId } : c))
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

  // Phase D — Apprentice task delegation handlers. GM-only for MVP;
  // master-PC-edit is a natural extension (gate on member.apprentice_of
  // matching the viewer's PC). Saving null (empty trimmed draft) clears
  // the task back to idle.
  async function handleSaveTask(m: Member) {
    const trimmed = taskDraft.trim()
    const value = trimmed === '' ? null : trimmed
    const { error } = await supabase.from('community_members')
      .update({ current_task: value })
      .eq('id', m.id)
    if (error) { alert(`Task save failed: ${error.message}`); return }
    setMembers(prev => ({
      ...prev,
      [m.community_id]: (prev[m.community_id] ?? []).map(x => x.id === m.id ? { ...x, current_task: value } : x),
    }))
    setEditingTaskMemberId(null)
    setTaskDraft('')
  }
  function handleStartEditTask(m: Member) {
    setEditingTaskMemberId(m.id)
    setTaskDraft(m.current_task ?? '')
  }
  function handleCancelEditTask() {
    setEditingTaskMemberId(null)
    setTaskDraft('')
  }

  async function handleChangeRole(m: Member, role: Role) {
    // Flipping INTO 'assigned' (from anything else) requires a PC
    // director + a task, so divert to the assignment modal. The
    // modal's save handler is what actually writes role + linkage.
    if (role === 'assigned' && m.role !== 'assigned') {
      setAssigningMember(m)
      setAssignmentPcDraft(m.assignment_pc_id ?? '')
      setAssignmentTaskDraft(m.current_task ?? '')
      return
    }
    // Flipping OUT of 'assigned' into any other role — clear the
    // linkage so the previous director / task don't linger as stale
    // ghosts on a Gatherer/Maintainer/Safety/Unassigned row.
    const update: Partial<Member> = { role }
    if (m.role === 'assigned' && role !== 'assigned') {
      update.assignment_pc_id = null
      update.current_task = null
    }
    const { error } = await supabase.from('community_members').update(update).eq('id', m.id)
    if (error) { alert(`Role change failed: ${error.message}`); return }
    setMembers(prev => ({
      ...prev,
      [m.community_id]: (prev[m.community_id] ?? []).map(x => x.id === m.id ? { ...x, ...update } : x),
    }))
  }

  // Save handler for the "Assigned" role modal. Writes role='assigned'
  // + assignment_pc_id + current_task in one round-trip. Cancelling
  // closes the modal without changing anything — the role dropdown
  // never flipped (handleChangeRole stopped short of the update).
  async function handleSaveAssignment() {
    if (!assigningMember) return
    if (!assignmentPcDraft) { alert('Pick a directing PC.'); return }
    const task = assignmentTaskDraft.trim() || null
    const update = {
      role: 'assigned' as Role,
      assignment_pc_id: assignmentPcDraft,
      current_task: task,
    }
    const { error } = await supabase.from('community_members').update(update).eq('id', assigningMember.id)
    if (error) { alert(`Assignment failed: ${error.message}`); return }
    setMembers(prev => ({
      ...prev,
      [assigningMember.community_id]: (prev[assigningMember.community_id] ?? []).map(
        x => x.id === assigningMember.id ? { ...x, ...update } : x
      ),
    }))
    setAssigningMember(null)
    setAssignmentPcDraft('')
    setAssignmentTaskDraft('')
  }
  function handleCancelAssignment() {
    setAssigningMember(null)
    setAssignmentPcDraft('')
    setAssignmentTaskDraft('')
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

                {/* At-a-Glance — player-facing read-only summary.
                    Morale trend chip row (last 5 checks, newest first)
                    and, if the viewer is a member of this community,
                    a "Your role · Apprentice · Recruits" line that
                    surfaces their bonds at a glance. Rendered for
                    everyone so GMs see the same story; for non-GMs
                    this is effectively their primary view of the
                    community since the edit surfaces below stay
                    gated/read-only. */}
                {(() => {
                  const recent = recentMorale[c.id] ?? []
                  // Viewer's bonds: recruits = NPC members invited by
                  // me; apprentice = NPC with apprentice_of tied to
                  // my PC's character_id (found via member list).
                  const myPcMember = myUserId
                    ? mems.find(m => m.character_id && m.invited_by_user_id === myUserId)
                      ?? mems.find(m => m.character_id && m.recruitment_type === 'founder')  // founder fallback (best-effort for pre-migration PCs)
                    : null
                  const myRecruits = myUserId ? mems.filter(m => m.invited_by_user_id === myUserId && m.npc_id) : []
                  const myApprentice = myPcMember?.character_id
                    ? mems.find(m => m.recruitment_type === 'apprentice' && m.apprentice_of_character_id === myPcMember.character_id)
                    : null
                  const viewerIsMember = !!myPcMember
                  if (recent.length === 0 && !viewerIsMember) return null  // no history and not a member → skip
                  const outcomeChipColor = (o: string) => {
                    const s = (o ?? '').toLowerCase().replace(/ /g, '_')
                    if (s === 'wild_success' || s === 'high_insight') return '#7fc458'
                    if (s === 'success') return '#7ab3d4'
                    if (s === 'failure') return '#EF9F27'
                    if (s === 'dire_failure' || s === 'low_insight') return '#c0392b'
                    return '#5a5550'
                  }
                  const outcomeChipLetter = (o: string) => {
                    const s = (o ?? '').toLowerCase().replace(/ /g, '_')
                    if (s === 'wild_success') return 'W'
                    if (s === 'high_insight') return 'H'
                    if (s === 'success') return 'S'
                    if (s === 'failure') return 'F'
                    if (s === 'dire_failure') return 'D'
                    if (s === 'low_insight') return 'L'
                    return '?'
                  }
                  return (
                    <div style={{ padding: '10px 12px', background: '#0f1a2e', border: '1px solid #1a3a5c', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {recent.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>Recent Morale</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[...recent].reverse().map((m, i) => (
                              <span key={i} title={`Week ${m.week_number} — ${m.outcome.replace(/_/g, ' ')}`}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '3px', background: outcomeChipColor(m.outcome) + '22', border: `1px solid ${outcomeChipColor(m.outcome)}`, color: outcomeChipColor(m.outcome), fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '15px' }}>
                                {outcomeChipLetter(m.outcome)}
                              </span>
                            ))}
                          </div>
                          <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>oldest → newest</span>
                        </div>
                      )}
                      {viewerIsMember && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', color: '#cce0f5' }}>
                          <span style={{ color: '#7ab3d4', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>You</span>
                          <span>
                            <span style={{ color: '#5a5550', letterSpacing: '.04em', textTransform: 'uppercase' }}>Role:</span>{' '}
                            <span style={{ color: '#f5f2ee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{ROLE_LABEL[myPcMember!.role]}</span>
                            {myPcMember!.recruitment_type === 'founder' && <span style={{ color: '#EF9F27' }}> · Founder</span>}
                          </span>
                          {myApprentice && (
                            <span>
                              <span style={{ color: '#5a5550', letterSpacing: '.04em', textTransform: 'uppercase' }}>Apprentice:</span>{' '}
                              <span style={{ color: '#d48bd4', fontWeight: 700 }}>{memberLabel(myApprentice)}</span>
                            </span>
                          )}
                          {myRecruits.length > 0 && (
                            <span>
                              <span style={{ color: '#5a5550', letterSpacing: '.04em', textTransform: 'uppercase' }}>Recruits:</span>{' '}
                              <span style={{ color: '#f5f2ee' }}>{myRecruits.map(r => memberLabel(r)).join(', ')}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Homestead — inline dropdown. GM-only; all other
                    viewers see a read-only line. The Homestead pin
                    drives publish coordinates (world map marker) and
                    travels into migration / schism flows, so changing
                    it on a published community will move its dot on
                    the world map after the next publish sync. */}
                {(() => {
                  const homesteadPin = c.homestead_pin_id ? pins.find(p => p.id === c.homestead_pin_id) : null
                  if (!isGM) {
                    return (
                      <div style={{ padding: '8px 12px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>📍 Homestead</span>
                        <span style={{ fontSize: '14px', color: homesteadPin ? '#f5f2ee' : '#5a5550', fontFamily: 'Barlow, sans-serif' }}>
                          {homesteadPin ? homesteadPin.name : 'unlocated'}
                        </span>
                      </div>
                    )
                  }
                  return (
                    <div style={{ padding: '8px 12px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '14px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>📍 Homestead</span>
                      <select
                        value={c.homestead_pin_id ?? ''}
                        onChange={e => handleSetHomestead(c.id, e.target.value || null)}
                        style={{ flex: 1, padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', appearance: 'none' }}>
                        <option value="">— unlocated —</option>
                        {pins.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      {homesteadPin && homesteadPin.lat != null && homesteadPin.lng != null && (
                        <a href={`https://www.openstreetmap.org/#map=15/${homesteadPin.lat}/${homesteadPin.lng}`} target="_blank" rel="noreferrer"
                          title="Open this homestead on OpenStreetMap"
                          style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none' }}>
                          View
                        </a>
                      )}
                    </div>
                  )
                })()}

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

                {/* Phase E — Publish to Distemperverse strip. Shows
                    the world-facing status chip + actions. GM-only;
                    community must be at 13+ members and not dissolved
                    for first publish. Republish (Update) and Unpublish
                    stay available after moderation. */}
                {isGM && isCommunity && c.status !== 'dissolved' && (() => {
                  const world = worldRows[c.id]
                  const isPublished = !!world
                  const modChip = world?.moderation_status === 'approved' ? '✓ Live'
                    : world?.moderation_status === 'rejected' ? '✗ Rejected'
                    : world?.moderation_status === 'pending' ? '⏳ Pending Moderation'
                    : ''
                  const modColor = world?.moderation_status === 'approved' ? '#7fc458'
                    : world?.moderation_status === 'rejected' ? '#c0392b'
                    : '#EF9F27'
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: isPublished ? '#1a102a' : '#1a1a1a', border: `1px solid ${isPublished ? '#5a2e5a' : '#2e2e2e'}`, borderRadius: '3px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', color: isPublished ? '#d48bd4' : '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                          🌐 The Tapestry
                        </div>
                        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>
                          {isPublished
                            ? <>Published as <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{world!.size_band}</span> · <span style={{ color: modColor, fontWeight: 700 }}>{modChip}</span>{world!.faction_label ? <> · <span style={{ color: '#EF9F27' }}>{world!.faction_label}</span></> : null}</>
                            : 'Publish this community to the Distemperverse to make it visible across other campaigns.'}
                        </div>
                      </div>
                      {isPublished ? (
                        <>
                          <button onClick={() => openPublishModal(c.id)}
                            style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Update Public Info
                          </button>
                          <button onClick={() => handleUnpublish(c.id)}
                            style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#c0392b', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Unpublish
                          </button>
                        </>
                      ) : (
                        <button onClick={() => openPublishModal(c.id)}
                          style={{ padding: '8px 14px', background: '#2a102a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                          🌐 Publish to Distemperverse
                        </button>
                      )}
                    </div>
                  )
                })()}

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
                    // takes all remaining flex space. Two flavors pin
                    // a PC to the NPC row:
                    //   - Apprentice → master = apprentice_of_character_id
                    //   - Assigned → director = assignment_pc_id
                    // Both render as "<NPC> ⇐ <PC>" inline, and both
                    // expose the current_task line below the row.
                    const rawName = memberLabel(m)
                    const ownerCharId = m.recruitment_type === 'apprentice'
                      ? m.apprentice_of_character_id
                      : (m.role === 'assigned' ? m.assignment_pc_id : null)
                    const ownerName = ownerCharId
                      ? (chars.find(c => c.id === ownerCharId)?.name ?? null)
                      : null
                    const displayName = ownerName ? `${rawName} ⇐ ${ownerName}` : rawName
                    const hasTaskSurface = m.recruitment_type === 'apprentice'
                      || (m.role === 'assigned' && !!m.assignment_pc_id)
                    const editingTask = editingTaskMemberId === m.id
                    const taskText = m.current_task?.trim() || ''
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 8px', background: '#111', border: `1px solid ${accent}`, borderRadius: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                        {/* Task row. Shows for Apprentices (permanent
                            PC bond) and Assigned NPCs (temporary PC-
                            directed duty). Display mode: "Task: <text>"
                            inline with pencil icon (GM). Edit mode:
                            text input + save/cancel. No task + GM →
                            "+ Assign task" affordance. */}
                        {hasTaskSurface && (editingTask ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '2px' }}>
                            <span style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>Task</span>
                            <input autoFocus value={taskDraft}
                              placeholder="e.g. Scout the warehouse, deliver the message to Maren"
                              onChange={e => setTaskDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveTask(m)
                                if (e.key === 'Escape') handleCancelEditTask()
                              }}
                              style={{ flex: 1, padding: '4px 8px', background: '#242424', border: '1px solid #5a2e5a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }} />
                            <button onClick={() => handleSaveTask(m)}
                              style={{ padding: '4px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '2px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                            <button onClick={handleCancelEditTask}
                              style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '15px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
                          </div>
                        ) : taskText ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '2px' }}>
                            <span style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>Task</span>
                            <span style={{ flex: 1, fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', fontStyle: 'italic' }}>{taskText}</span>
                            {isGM && (
                              <button onClick={() => handleStartEditTask(m)} title="Edit task"
                                style={{ background: 'none', border: 'none', color: '#7ab3d4', fontSize: '13px', cursor: 'pointer', padding: '0 4px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>✎ edit</button>
                            )}
                          </div>
                        ) : isGM ? (
                          <button onClick={() => handleStartEditTask(m)}
                            style={{ alignSelf: 'flex-start', padding: '2px 8px', background: 'transparent', border: '1px dashed #5a2e5a', borderRadius: '2px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                            + Assign task
                          </button>
                        ) : null)}
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

                {/* Phase E Sprint 4e — Migration on dissolution.
                    Shows on dissolved communities only: lists the
                    survivors (left_reason='dissolved') and offers
                    them to nearby published communities. GM-only;
                    receiver acceptance happens in the recipient's
                    notification bell. */}
                {isGM && c.status === 'dissolved' && (() => {
                  const survivors = (dissolvedSurvivors[c.id] ?? []).filter(m => m.npc_id)
                  return (
                    <div style={{ padding: '10px 12px', background: '#1a102a', border: '1px solid #5a2e5a', borderRadius: '3px' }}>
                      <div style={{ fontSize: '14px', color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                        📤 Survivor Migration
                      </div>
                      <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5, marginBottom: '8px' }}>
                        {survivors.length === 0
                          ? 'No NPC survivors recorded. Migration only applies to NPCs scattered by the dissolution.'
                          : `${survivors.length} survivor${survivors.length === 1 ? '' : 's'} can be offered to other communities in the Distemperverse.`}
                      </div>
                      {survivors.length > 0 && migrationTargets.length > 0 && (
                        <button onClick={() => openMigrationModal(c)}
                          style={{ padding: '6px 14px', background: '#2a102a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                          📤 Offer Survivors
                        </button>
                      )}
                      {survivors.length > 0 && migrationTargets.length === 0 && (
                        <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                          No published communities exist yet to offer them to.
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Phase E Sprint 4d — Schism. Splits this community
                    into two: original keeps its remaining roster,
                    breakaway is a brand-new community with the picked
                    members. GM-only; gated on roster ≥ 14 so at
                    least a 13/1 split is possible (the 13-side stays
                    a Community; the 1-side is a Group until it
                    grows). */}
                {isGM && c.status !== 'dissolved' && total >= 14 && (
                  <button onClick={() => openSchismModal(c)}
                    title="Split this community into two — pick which members leave with the breakaway."
                    style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #d48bd4', borderRadius: '2px', color: '#d48bd4', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start' }}>
                    ⛓ Schism
                  </button>
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

      {/* Phase E Sprint 4e — Migration modal. Lists the dissolved
          community's surviving NPCs + an approved-world-community
          target picker + an optional narrative. Submit inserts one
          community_migrations row per picked survivor; trigger fires
          a notification per row to the target's GM. Acceptance
          handled in the recipient's bell (Sprint 4c handler). */}
      {migrationCommunityId && (() => {
        const original = communities.find(c => c.id === migrationCommunityId)
        if (!original) return null
        const survivors = (dissolvedSurvivors[migrationCommunityId] ?? []).filter(m => m.npc_id)
        return (
          <div onClick={closeMigrationModal}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: '20px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#1a1a1a', border: '1px solid #5a2e5a', borderRadius: '4px', width: '640px', maxWidth: '100%', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    📤 Offer Survivors — {original.name}
                  </div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                    Send the dispossessed to a new home
                  </div>
                </div>
                <button onClick={closeMigrationModal}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
              <div style={{ padding: '18px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
                  Each picked survivor becomes a migration request to the chosen community. The receiving GM accepts (the survivor narratively joins them) or declines (the survivor's fate stays open). Picking 5 survivors sends 5 separate requests so the receiver can pick and choose.
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Target community</div>
                  <select value={migrationTargetId} onChange={e => setMigrationTargetId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                    <option value="">— pick a community —</option>
                    {migrationTargets.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.size_band}){t.faction_label ? ` · ${t.faction_label}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Survivors to offer ({migrationPickedIds.size} / {survivors.length})
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '6px' }}>
                    {survivors.map(m => {
                      const checked = migrationPickedIds.has(m.id)
                      return (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', cursor: 'pointer', borderRadius: '2px', background: checked ? '#2a102a' : 'transparent' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleMigrationMember(m.id)} />
                          <span style={{ fontSize: '14px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600 }}>{memberLabel(m)}</span>
                          <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginLeft: 'auto' }}>{ROLE_LABEL[m.role]}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Narrative (optional)</div>
                  <textarea value={migrationNarrative}
                    placeholder="e.g. They survived the raid that broke us. They carry our last stockpile of antibiotics — please honor what's left of us."
                    onChange={e => setMigrationNarrative(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ padding: '14px 18px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={closeMigrationModal} disabled={migrationSubmitting}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: migrationSubmitting ? 'not-allowed' : 'pointer', opacity: migrationSubmitting ? 0.4 : 1 }}>
                  Cancel
                </button>
                <button onClick={handleMigration} disabled={migrationSubmitting || !migrationTargetId || migrationPickedIds.size === 0}
                  style={{ padding: '8px 18px', background: '#2a102a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: (migrationSubmitting || !migrationTargetId || migrationPickedIds.size === 0) ? 'not-allowed' : 'pointer', opacity: (migrationSubmitting || !migrationTargetId || migrationPickedIds.size === 0) ? 0.4 : 1, fontWeight: 600 }}>
                  {migrationSubmitting ? 'Sending…' : '📤 Send Offers'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Phase E Sprint 4d — Schism modal. Pick a name for the new
          breakaway community + optional homestead pin + which members
          go with it. Submit creates the new community, soft-removes
          the picked members from the original (left_reason='schism'),
          and inserts fresh member rows in the breakaway. */}
      {schismCommunityId && (() => {
        const original = communities.find(c => c.id === schismCommunityId)
        if (!original) return null
        const mems = members[schismCommunityId] ?? []
        const remaining = mems.length - schismPickedIds.size
        const picked = schismPickedIds.size
        const remainingIsCommunity = remaining >= 13
        const breakawayIsCommunity = picked >= 13
        return (
          <div onClick={closeSchismModal}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: '20px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#1a1a1a', border: '1px solid #5a2e5a', borderRadius: '4px', width: '640px', maxWidth: '100%', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    ⛓ Schism — {original.name}
                  </div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                    Split into two communities
                  </div>
                </div>
                <button onClick={closeSchismModal}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
              <div style={{ padding: '18px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
                  Pick the breakaway faction's members. They leave with reason "schism" and join a new community in this campaign. The original keeps everyone else and its history (Morale roll log, week counter, consecutive failures).
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Breakaway name</div>
                  <input value={schismName}
                    onChange={e => setSchismName(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Description (optional)</div>
                  <textarea value={schismDescription}
                    placeholder="Why did they leave? What do they believe?"
                    onChange={e => setSchismDescription(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Breakaway Homestead pin (optional)</div>
                  <select value={schismHomesteadPinId} onChange={e => setSchismHomesteadPinId(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                    <option value="">— None (set later) —</option>
                    {pins.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Members joining the breakaway ({schismPickedIds.size} / {mems.length})
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '6px' }}>
                    {mems.map(m => {
                      const checked = schismPickedIds.has(m.id)
                      return (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', cursor: 'pointer', borderRadius: '2px', background: checked ? '#2a102a' : 'transparent' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSchismMember(m.id)} />
                          <span style={{ fontSize: '14px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600 }}>{memberLabel(m)}</span>
                          <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginLeft: 'auto' }}>{m.npc_id ? 'NPC' : 'PC'} · {ROLE_LABEL[m.role]}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', background: '#0f1a2e', border: '1px solid #1a3a5c', borderRadius: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                    <span style={{ color: '#5a5550', textTransform: 'uppercase' }}>After split:</span>{' '}
                    <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{original.name}</span> {remaining} ({remainingIsCommunity ? 'Community' : 'Group'}){' · '}
                    <span style={{ color: '#d48bd4', fontWeight: 700 }}>{schismName.trim() || 'Breakaway'}</span> {picked} ({breakawayIsCommunity ? 'Community' : 'Group'})
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 18px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={closeSchismModal} disabled={schismSubmitting}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: schismSubmitting ? 'not-allowed' : 'pointer', opacity: schismSubmitting ? 0.4 : 1 }}>
                  Cancel
                </button>
                <button onClick={handleSchism} disabled={schismSubmitting || schismPickedIds.size === 0 || !schismName.trim()}
                  style={{ padding: '8px 18px', background: '#2a102a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: (schismSubmitting || schismPickedIds.size === 0 || !schismName.trim()) ? 'not-allowed' : 'pointer', opacity: (schismSubmitting || schismPickedIds.size === 0 || !schismName.trim()) ? 0.4 : 1, fontWeight: 600 }}>
                  {schismSubmitting ? 'Splitting…' : '⛓ Confirm Schism'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Phase E — Publish to Distemperverse modal. GM confirms what
          will go public (name, description, homestead coords if set,
          size band computed from roster, public status from community
          state) plus a freeform faction_label. INSERT → status=pending
          awaits Thriver approval; UPDATE just refreshes the public
          card for already-published communities. */}
      {publishingCommunityId && (() => {
        const c = communities.find(x => x.id === publishingCommunityId)
        if (!c) return null
        const world = worldRows[c.id]
        const total = (members[c.id] ?? []).length
        const sizeBand = computeSizeBand(total)
        const publicStatus = computePublicStatus(c)
        const homesteadPin = c.homestead_pin_id ? pins.find(p => p.id === c.homestead_pin_id) : null
        return (
          <div onClick={closePublishModal}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#1a1a1a', border: '1px solid #5a2e5a', borderRadius: '4px', width: '580px', maxWidth: '100%', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    🌐 {world ? 'Update' : 'Publish'} — {c.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                    {world ? 'Refresh the Distemperverse-facing card' : 'Share this community across the Distemperverse'}
                  </div>
                </div>
                <button onClick={closePublishModal}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
              <div style={{ padding: '18px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
                  Publishing exposes the sanitized fields below to every other campaign in the Distemperverse. Your private roster, Morale rolls, and internal notes stay put. First-time publishes go through Thriver moderation before they appear on the world map.
                </div>

                <div style={{ padding: '12px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>Preview</div>
                  <div style={{ fontSize: '19px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>{c.name}</div>
                  {c.description && (
                    <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>{c.description}</div>
                  )}
                  <div style={{ display: 'flex', gap: '14px', fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                    <span><span style={{ color: '#5a5550', textTransform: 'uppercase' }}>Size:</span> <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{sizeBand}</span> <span style={{ color: '#5a5550' }}>({total} members)</span></span>
                    <span><span style={{ color: '#5a5550', textTransform: 'uppercase' }}>Status:</span> <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{publicStatus}</span></span>
                    <span><span style={{ color: '#5a5550', textTransform: 'uppercase' }}>Homestead:</span> <span style={{ color: homesteadPin ? '#7fc458' : '#EF9F27', fontWeight: 700 }}>{homesteadPin ? homesteadPin.name : 'none set — will publish unlocated'}</span></span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Faction / flavor label (optional)</div>
                  <input value={publishFactionLabel}
                    placeholder="e.g. Reformed Church, Mercantile, Mongrels, Scholars"
                    onChange={e => setPublishFactionLabel(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>
                    Short label shown on the world map alongside the community's public card. Leave blank for none.
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 18px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={closePublishModal} disabled={publishing}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: publishing ? 'not-allowed' : 'pointer', opacity: publishing ? 0.4 : 1 }}>
                  Cancel
                </button>
                <button onClick={handlePublish} disabled={publishing}
                  style={{ padding: '8px 18px', background: '#2a102a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: publishing ? 'not-allowed' : 'pointer', opacity: publishing ? 0.4 : 1, fontWeight: 600 }}>
                  {publishing ? 'Publishing…' : world ? 'Update Public Info' : '🌐 Publish'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* "Assigned" role mission modal. Triggered from handleChangeRole
          when an NPC's role flips to 'assigned'. Captures director PC
          + task in one dialog; save handler writes both plus the role.
          Cancel leaves the role unchanged (handleChangeRole never
          called supabase). */}
      {assigningMember && (() => {
        const m = assigningMember
        const communityMems = members[m.community_id] ?? []
        // PCs eligible to direct: any PC in this campaign. We prefer
        // listing PCs who are community members first, since the GM
        // usually assigns to someone present — but include all
        // chars so absent PCs can still direct (narrative freedom).
        const memberPcIds = new Set(communityMems.filter(x => x.character_id).map(x => x.character_id))
        const orderedChars = [...chars].sort((a, b) => {
          const aMem = memberPcIds.has(a.id) ? 0 : 1
          const bMem = memberPcIds.has(b.id) ? 0 : 1
          return aMem - bMem || a.name.localeCompare(b.name)
        })
        return (
          <div onClick={handleCancelAssignment}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', width: '520px', maxWidth: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  Assign {memberLabel(m)}
                </div>
                <button onClick={handleCancelAssignment}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
                  Assigned NPCs are off doing a PC-directed task and don't count toward the SRD labor minimums. Pick who's directing them and what they're doing.
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Directed by</div>
                  <select value={assignmentPcDraft}
                    onChange={e => setAssignmentPcDraft(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                    <option value="">— pick a PC —</option>
                    {orderedChars.map(c => {
                      const isMember = memberPcIds.has(c.id)
                      return <option key={c.id} value={c.id}>{c.name}{isMember ? '' : ' (not in this community)'}</option>
                    })}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Task</div>
                  <input autoFocus value={assignmentTaskDraft}
                    placeholder="e.g. Scouting the Belvedere's warehouse"
                    onChange={e => setAssignmentTaskDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && assignmentPcDraft) handleSaveAssignment()
                      if (e.key === 'Escape') handleCancelAssignment()
                    }}
                    style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ padding: '14px 18px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={handleCancelAssignment}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveAssignment}
                  disabled={!assignmentPcDraft}
                  style={{ padding: '8px 16px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: assignmentPcDraft ? 'pointer' : 'not-allowed', opacity: assignmentPcDraft ? 1 : 0.4, fontWeight: 600 }}>
                  Assign
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
