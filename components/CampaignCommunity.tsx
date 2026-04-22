'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

// Phase A — Communities foundation. Lists communities for a campaign, lets
// the GM create one, drill into the member roster, add/remove members from
// the campaign's NPC pool or PC entries, and assign roles.
// Recruitment Checks (Phase B) + Morale (Phase C) come later; this is
// manual management only.

type Role = 'gatherer' | 'maintainer' | 'safety' | 'unassigned'
type RecruitmentType = 'cohort' | 'conscript' | 'convert' | 'apprentice' | 'founder'

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

interface NpcOption { id: string; name: string }
interface CharOption { id: string; name: string }
interface PinOption { id: string; name: string }

const ROLE_LABEL: Record<Role, string> = {
  gatherer: 'Gatherers',
  maintainer: 'Maintainers',
  safety: 'Safety',
  unassigned: 'Unassigned',
}
// SRD §08 minimums
const ROLE_MIN_PCT: Record<Role, number> = {
  gatherer: 33,
  maintainer: 20,
  safety: 5,
  unassigned: 0,
}
const ROLE_MAX_PCT: Record<Role, number> = {
  gatherer: 100,
  maintainer: 100,
  safety: 10,
  unassigned: 100,
}
const RECRUITMENT_LABEL: Record<RecruitmentType, string> = {
  cohort: 'Cohort',
  conscript: 'Conscript',
  convert: 'Convert',
  apprentice: 'Apprentice',
  founder: 'Founder',
}

const CommunityTAB_LABEL = 'Community'

interface Props {
  campaignId: string
  isGM: boolean
}

export default function CampaignCommunity({ campaignId, isGM }: Props) {
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
  const [addType, setAddType] = useState<RecruitmentType>('founder')

  useEffect(() => { load() }, [campaignId])

  async function load() {
    setLoading(true)
    const [comsRes, npcsRes, charsRes, pinsRes] = await Promise.all([
      supabase.from('communities').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true }),
      supabase.from('campaign_npcs').select('id, name').eq('campaign_id', campaignId).order('name'),
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
    } else {
      setMembers({})
      setPendingByCommunity({})
    }
    // Cache current auth user id so the UI can check leader_user_id.
    const { data: { user } } = await supabase.auth.getUser()
    setMyUserId(user?.id ?? null)
    setLoading(false)
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
      setAddType('founder')
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
    setMembers(prev => ({
      ...prev,
      [m.community_id]: (prev[m.community_id] ?? []).filter(x => x.id !== m.id),
    }))
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
    const g: Record<Role, Member[]> = { gatherer: [], maintainer: [], safety: [], unassigned: [] }
    for (const m of openMembers) g[m.role].push(m)
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
        <div style={{ textAlign: 'center', color: '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', padding: '2rem 1rem' }}>
          No communities yet
        </div>
      )}

      {communities.map(c => {
        const mems = members[c.id] ?? []
        const total = mems.length
        const isCommunity = total >= 13
        const isOpen = openId === c.id
        const gatherPct = total > 0 ? Math.round(100 * mems.filter(m => m.role === 'gatherer').length / total) : 0
        const maintainPct = total > 0 ? Math.round(100 * mems.filter(m => m.role === 'maintainer').length / total) : 0
        const safetyPct = total > 0 ? Math.round(100 * mems.filter(m => m.role === 'safety').length / total) : 0
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
                  {total} member{total === 1 ? '' : 's'}{!isCommunity && total > 0 ? ` · ${13 - total} more for Community` : ''}
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
                            <span style={{ fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
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

                {/* Role bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(['gatherer', 'maintainer', 'safety'] as Role[]).map(r => {
                    const pct = r === 'gatherer' ? gatherPct : r === 'maintainer' ? maintainPct : safetyPct
                    const min = ROLE_MIN_PCT[r]
                    const max = ROLE_MAX_PCT[r]
                    const count = mems.filter(m => m.role === r).length
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

                {/* Members grouped by role */}
                {(['gatherer', 'maintainer', 'safety', 'unassigned'] as Role[]).map(r => {
                  const list = openMembersByRole[r]
                  if (list.length === 0) return null
                  return (
                    <div key={r}>
                      <div style={{ fontSize: '14px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>{ROLE_LABEL[r]}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {list.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 6px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '2px' }}>
                            <span style={{ fontSize: '14px' }}>{m.npc_id ? '👤' : '🎭'}</span>
                            <span style={{ flex: 1, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memberLabel(m)}</span>
                            <span style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{RECRUITMENT_LABEL[m.recruitment_type]}</span>
                            <select value={m.role} onChange={e => handleChangeRole(m, e.target.value as Role)}
                              style={{ padding: '1px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                              {(Object.keys(ROLE_LABEL) as Role[]).map(ro => <option key={ro} value={ro}>{ROLE_LABEL[ro]}</option>)}
                            </select>
                            <button onClick={() => handleRemoveMember(m)} title="Remove"
                              style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '14px', cursor: 'pointer', padding: '0 4px' }}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

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
    </div>
  )
}

export { CommunityTAB_LABEL }
