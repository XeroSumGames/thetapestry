'use client'
// CharacterEvolution — the spend side of the CDP loop. Triggered from
// the purple Evolution button on <CharacterCard>. Players use this to
// turn earned CDP into RAPID raises and skill raises (or new-skill
// learns). The GM-side award flow already exists at /stories/[id]/table
// → GM Tools ▾ → CDP and is unchanged here.
//
// Per spec digest at tasks/rules-extract-cdp.md:
//   - SRD-canonical costs: 1 CDP to learn a skill, then 2N+1 CDP per
//     skill step; 3×(N+1) CDP per RAPID step. (CRB has a typo on
//     RAPID; SRD wins per CLAUDE.md precedence.)
//   - One-step-at-a-time: a single spend raises one stat by one
//     level. Multiple raises = multiple spends.
//   - Lv 4 narrative gate: raising 3 → 4 (Human Peak / Life's Work)
//     requires a Fill-In-The-Gaps justification stored on the
//     progression-log entry. No formal GM-approval pipeline in v1
//     (per the 2026-04-29 backburner ruling).
//   - Lv 4 Skill Trait mechanics stay backburnered — the +1 SMod from
//     Lv 4 still applies, no Trait surface exposed.
//
// Save flow:
//   1. UPDATE character_states.cdp (deduct cost) — per-campaign.
//   2. UPDATE characters.data.rapid OR characters.data.skills
//      (cross-campaign — same character row across all their stories).
//   3. APPEND progression_log entry (type 'attribute' | 'skill' |
//      'item' — finally populating types the curation pass declared
//      but left unwritten).

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SKILLS, type AttributeName, type SkillValue } from '../lib/xse-schema'
import { skillRaiseCost, skillNextLevel, rapidRaiseCost, isLv4Step } from '../lib/cdp-costs'
import { appendProgressionEntry } from '../lib/progression-log'

const ATTR_ORDER: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<AttributeName, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity',
}

interface SkillEntry { skillName: string; level: SkillValue }

interface PendingSpend {
  kind: 'rapid' | 'skill'
  key: string                     // attr name (RSN/etc.) or skill name
  fromLevel: number
  toLevel: number
  cost: number
  needsNarrative: boolean         // true for any 3 → 4 step
  narrative: string               // filled in by the user when needsNarrative
}

// The master PC's Apprentice, surfaced as a spend target alongside
// the master PC themselves. Loaded on mount; null when the master PC
// has no Apprentice (the toggle then doesn't render).
interface ApprenticeTarget {
  npcId: string                   // campaign_npcs.id
  name: string
  rapid: Record<AttributeName, number>
  skillMap: Record<string, SkillValue>
}

interface Props {
  supabase: SupabaseClient
  characterId: string             // master PC's character id
  characterName: string
  characterData: any              // characters.data jsonb
  stateId: string                 // character_states.id (per-campaign CDP row)
  cdpBalance: number              // current character_states.cdp
  campaignId: string              // for the Apprentice lookup query
  onClose: () => void
  onSaved: () => void             // parent refreshes after a spend
}

export default function CharacterEvolution({
  supabase, characterId, characterName, characterData, stateId, cdpBalance,
  campaignId, onClose, onSaved,
}: Props) {
  const [pending, setPending] = useState<PendingSpend | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Spend target — defaults to the master PC. Flips to 'apprentice'
  // when the toggle is clicked, which swaps the spend list to read
  // the Apprentice's RAPID + skills + write back to campaign_npcs
  // instead of characters.data. CDP still deducts from the master
  // PC's character_states.cdp regardless of target (the master PC's
  // earned CDP fuels both their own and the Apprentice's growth, per
  // Distemper CRB §08 p.21 — "CDP the PC earns later can be spent on
  // the Apprentice").
  const [target, setTarget] = useState<'pc' | 'apprentice'>('pc')
  const [apprentice, setApprentice] = useState<ApprenticeTarget | null>(null)

  // Look up the master PC's Apprentice on mount. Single query: the
  // community_members row tagged apprentice_of_character_id = master
  // PC, joined to the campaign_npcs row that IS the Apprentice. Only
  // looks within this campaign — Apprentice bonds are campaign-scoped
  // via community membership.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: bond } = await supabase
        .from('community_members')
        .select('npc_id, communities!inner(campaign_id)')
        .eq('apprentice_of_character_id', characterId)
        .eq('recruitment_type', 'apprentice')
        .is('left_at', null)
        .eq('communities.campaign_id', campaignId)
        .maybeSingle()
      if (cancelled || !bond || !(bond as any).npc_id) return
      const npcId = (bond as any).npc_id as string
      const { data: npc } = await supabase
        .from('campaign_npcs')
        .select('id, name, reason, acumen, physicality, influence, dexterity, skills')
        .eq('id', npcId)
        .maybeSingle()
      if (cancelled || !npc) return
      const skillEntries = Array.isArray((npc as any).skills?.entries) ? (npc as any).skills.entries : []
      const sm: Record<string, SkillValue> = {}
      for (const e of skillEntries) sm[e.name] = e.level as SkillValue
      setApprentice({
        npcId: (npc as any).id,
        name: (npc as any).name ?? 'Apprentice',
        rapid: {
          RSN: (npc as any).reason ?? 0,
          ACU: (npc as any).acumen ?? 0,
          PHY: (npc as any).physicality ?? 0,
          INF: (npc as any).influence ?? 0,
          DEX: (npc as any).dexterity ?? 0,
        },
        skillMap: sm,
      })
    }
    void load()
    return () => { cancelled = true }
  }, [characterId, campaignId, supabase])

  // PC's RAPID + skills off characters.data — the master-PC source of
  // truth. Same character row across all campaigns.
  const pcRapid: Record<AttributeName, number> = useMemo(() => {
    const r = (characterData?.rapid ?? {}) as any
    return {
      RSN: r.RSN ?? 0, ACU: r.ACU ?? 0, PHY: r.PHY ?? 0, INF: r.INF ?? 0, DEX: r.DEX ?? 0,
    }
  }, [characterData])

  const pcSkillMap: Record<string, SkillValue> = useMemo(() => {
    const arr = (characterData?.skills ?? []) as SkillEntry[]
    const m: Record<string, SkillValue> = {}
    for (const e of arr) m[e.skillName] = e.level as SkillValue
    return m
  }, [characterData])

  // The active spend target's stats — flips to the Apprentice when the
  // toggle is set. Falls back to the PC's stats when no Apprentice is
  // bound (the toggle doesn't render in that case anyway).
  const rapid = target === 'apprentice' && apprentice ? apprentice.rapid : pcRapid
  const skillMap = target === 'apprentice' && apprentice ? apprentice.skillMap : pcSkillMap
  const targetName = target === 'apprentice' && apprentice ? apprentice.name : characterName

  function getSkillCurrent(name: string): SkillValue {
    if (skillMap[name] != null) return skillMap[name]
    const def = SKILLS.find(s => s.name === name)
    return (def?.vocational ? -3 : 0) as SkillValue
  }

  // ESC closes when nothing is mid-save / mid-confirm.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        if (pending) setPending(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending, saving])

  function startRapidSpend(attr: AttributeName) {
    const current = rapid[attr]
    const cost = rapidRaiseCost(current)
    if (cost == null || cost > cdpBalance) return
    setPending({
      kind: 'rapid', key: attr,
      fromLevel: current, toLevel: current + 1,
      cost, needsNarrative: isLv4Step(current), narrative: '',
    })
    setError(null)
  }

  function startSkillSpend(name: string) {
    const current = getSkillCurrent(name)
    const cost = skillRaiseCost(current)
    const next = skillNextLevel(current)
    if (cost == null || next == null || cost > cdpBalance) return
    setPending({
      kind: 'skill', key: name,
      fromLevel: current, toLevel: next,
      cost, needsNarrative: isLv4Step(current), narrative: '',
    })
    setError(null)
  }

  async function commit() {
    if (!pending) return
    if (pending.needsNarrative && pending.narrative.trim().length < 12) {
      setError('Lv 4 raises require a Fill-In-The-Gaps narrative — at least one full sentence so the GM can read back why the breakthrough happened.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const newCdp = cdpBalance - pending.cost
      // 1) Deduct CDP from the per-campaign character_states row.
      //    Master PC's CDP fuels both their own and the Apprentice's
      //    growth, per Distemper CRB §08 p.21.
      const { error: stErr } = await supabase
        .from('character_states')
        .update({ cdp: newCdp, updated_at: new Date().toISOString() })
        .eq('id', stateId)
      if (stErr) throw new Error(`deduct CDP: ${stErr.message}`)

      // 2) Apply the raise. Forks by target — PC writes to
      //    characters.data (cross-campaign source of truth); Apprentice
      //    writes to campaign_npcs columns (the NPC IS the Apprentice).
      if (target === 'apprentice') {
        if (!apprentice) throw new Error('apprentice target lost — try reopening the modal')
        // Read current row to merge skills.entries safely (don't blow
        // away other slots like equipment / portrait_url / etc.).
        const { data: npcRow, error: nReadErr } = await supabase
          .from('campaign_npcs')
          .select('skills')
          .eq('id', apprentice.npcId)
          .single()
        if (nReadErr) throw new Error(`read apprentice: ${nReadErr.message}`)
        const npcUpdate: any = {}
        if (pending.kind === 'rapid') {
          // Map AttributeName → campaign_npcs column.
          const col = ({ RSN: 'reason', ACU: 'acumen', PHY: 'physicality', INF: 'influence', DEX: 'dexterity' } as Record<string, string>)[pending.key]
          npcUpdate[col] = pending.toLevel
        } else {
          const skillsBase: any = (npcRow as any)?.skills ?? {}
          const entries = Array.isArray(skillsBase.entries) ? [...skillsBase.entries] : []
          const idx = entries.findIndex((e: any) => e.name === pending.key)
          if (idx >= 0) {
            entries[idx] = { ...entries[idx], level: pending.toLevel }
          } else {
            entries.push({ name: pending.key, level: pending.toLevel })
          }
          npcUpdate.skills = { ...skillsBase, entries }
        }
        const { error: nUpdErr } = await supabase
          .from('campaign_npcs')
          .update(npcUpdate)
          .eq('id', apprentice.npcId)
        if (nUpdErr) throw new Error(`update apprentice: ${nUpdErr.message}`)
      } else {
        // PC path — read characters.data, mutate, write back.
        const { data: charRow, error: readErr } = await supabase
          .from('characters')
          .select('data')
          .eq('id', characterId)
          .single()
        if (readErr) throw new Error(`read character: ${readErr.message}`)
        const base: any = charRow?.data ?? {}
        let newData: any = base
        if (pending.kind === 'rapid') {
          newData = {
            ...base,
            rapid: { ...(base.rapid ?? {}), [pending.key]: pending.toLevel },
          }
        } else {
          const arr: SkillEntry[] = Array.isArray(base.skills) ? [...base.skills] : []
          const idx = arr.findIndex(e => e.skillName === pending.key)
          if (idx >= 0) {
            arr[idx] = { ...arr[idx], level: pending.toLevel as SkillValue }
          } else {
            arr.push({ skillName: pending.key, level: pending.toLevel as SkillValue })
          }
          newData = { ...base, skills: arr }
        }
        const { error: chErr } = await supabase
          .from('characters')
          .update({ data: newData })
          .eq('id', characterId)
        if (chErr) throw new Error(`update character: ${chErr.message}`)
      }

      // 3) Append a progression-log entry — the curation pass left the
      //    'attribute' / 'skill' types declared but unwritten because
      //    nothing actually spent CDP via UI. The Calculator finally
      //    populates them.
      //
      //    Apprentice raises log to the MASTER PC's progression_log
      //    (the master is the journey-keeper; the Apprentice is an NPC
      //    without their own progression_log). The text prefixes the
      //    Apprentice's name so the journal reads as "I trained <X>".
      const niceFromTo = pending.fromLevel < 1 && pending.kind === 'skill'
        ? `learned (Lv ${pending.toLevel})`
        : `Lv ${pending.fromLevel} → Lv ${pending.toLevel}`
      const apprenticePrefix = target === 'apprentice' && apprentice
        ? `Apprentice ${apprentice.name}: `
        : ''
      const headline = pending.kind === 'rapid'
        ? `📈 ${apprenticePrefix}${ATTR_FULL[pending.key as AttributeName]} ${niceFromTo} — ${pending.cost} CDP.`
        : pending.fromLevel < 1
          ? `📈 ${apprenticePrefix}Learned ${pending.key} (Lv ${pending.toLevel}) — ${pending.cost} CDP.`
          : `📈 ${apprenticePrefix}${pending.key} ${niceFromTo} — ${pending.cost} CDP.`
      const narrative = pending.needsNarrative
        ? ` "${pending.narrative.trim()}"`
        : ''
      // Map our internal `kind` to the progression-log type vocabulary
      // — RAPID raises log as 'attribute' per the curation memory.
      const logType = pending.kind === 'rapid' ? 'attribute' : 'skill'
      void appendProgressionEntry(
        supabase,
        characterId,
        logType,
        `${headline}${narrative}`,
      )

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  // Skill rows sorted by current level descending — the eye lands on
  // the player's standout skills first, untrained skills cluster at
  // the bottom for "I want to learn something new" mode.
  const sortedSkills = useMemo(() => {
    return [...SKILLS].sort((a, b) => {
      const aCur = getSkillCurrent(a.name), bCur = getSkillCurrent(b.name)
      if (aCur !== bCur) return bCur - aCur
      return a.name.localeCompare(b.name)
    })
  }, [skillMap])

  return (
    <div onClick={!pending && !saving ? onClose : undefined}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1a1a1a', border: '1px solid #5a2e5a', borderRadius: '4px', width: '720px', maxWidth: '100%', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>
              ⭐ Character Evolution
            </div>
            <div style={{ fontSize: '17px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>
              {targetName}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>CDP</div>
              <div style={{ fontSize: '22px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', fontWeight: 700, lineHeight: 1 }}>{cdpBalance}</div>
            </div>
            <button onClick={!saving ? onClose : undefined}
              style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: saving ? 'not-allowed' : 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
          {/* Spend-target toggle — only renders when the master PC has
              an Apprentice. Per Distemper CRB §08 p.21, "CDP the PC
              earns later can be spent on the Apprentice." Both targets
              draw from the same per-campaign CDP balance. */}
          {apprentice && (
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', padding: '4px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
              <button onClick={() => setTarget('pc')}
                style={{
                  flex: 1, padding: '6px 10px',
                  background: target === 'pc' ? '#2a1a3e' : 'transparent',
                  border: `1px solid ${target === 'pc' ? '#5a2e5a' : 'transparent'}`,
                  borderRadius: '2px',
                  color: target === 'pc' ? '#c4a7f0' : '#5a5550',
                  fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                  letterSpacing: '.06em', textTransform: 'uppercase',
                  fontWeight: target === 'pc' ? 700 : 400,
                  cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1,
                }}>
                {characterName}
              </button>
              <button onClick={() => setTarget('apprentice')}
                style={{
                  flex: 1, padding: '6px 10px',
                  background: target === 'apprentice' ? '#2a102a' : 'transparent',
                  border: `1px solid ${target === 'apprentice' ? '#8b2e8b' : 'transparent'}`,
                  borderRadius: '2px',
                  color: target === 'apprentice' ? '#d48bd4' : '#5a5550',
                  fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                  letterSpacing: '.06em', textTransform: 'uppercase',
                  fontWeight: target === 'apprentice' ? 700 : 400,
                  cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1,
                }}>
                ⭐ Apprentice {apprentice.name}
              </button>
            </div>
          )}
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5, marginBottom: '14px' }}>
            One spend raises one stat by one level. Costs follow SRD §07 — RAPID raises cost 3× the new level; skill raises cost current+next; learning a new skill costs 1 CDP. Lv 4 (Human Peak / Life&apos;s Work) requires a Fill-In-The-Gaps narrative.
            {target === 'apprentice' && apprentice && (
              <> Spends here apply to <strong style={{ color: '#d48bd4' }}>{apprentice.name}</strong>; CDP still draws from {characterName}&apos;s balance.</>
            )}
          </div>

          {/* RAPID block */}
          <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
            RAPID Range Attributes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
            {ATTR_ORDER.map(k => {
              const current = rapid[k]
              const cost = rapidRaiseCost(current)
              const canBuy = cost != null && cost <= cdpBalance
              const isMax = current >= 4
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    {ATTR_FULL[k]}
                  </span>
                  <span style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
                    {current >= 0 ? '+' : ''}{current}
                  </span>
                  {isMax ? (
                    <span style={{ padding: '4px 10px', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: '160px', textAlign: 'right' }}>Human Peak</span>
                  ) : (
                    <button onClick={() => startRapidSpend(k)} disabled={!canBuy}
                      style={{
                        padding: '4px 12px',
                        background: canBuy ? '#2a1a3e' : '#1a1a1a',
                        border: `1px solid ${canBuy ? '#5a2e5a' : '#2e2e2e'}`,
                        borderRadius: '3px',
                        color: canBuy ? '#c4a7f0' : '#5a5550',
                        fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                        letterSpacing: '.04em', textTransform: 'uppercase',
                        cursor: canBuy ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap', minWidth: '160px',
                        fontWeight: isLv4Step(current) ? 700 : 400,
                      }}>
                      Raise to {current + 1}{isLv4Step(current) ? ' ⭐' : ''} — {cost} CDP
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Skills block */}
          <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
            Skills
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {sortedSkills.map(s => {
              const current = getSkillCurrent(s.name)
              const cost = skillRaiseCost(current)
              const next = skillNextLevel(current)
              const canBuy = cost != null && next != null && cost <= cdpBalance
              const isMax = current >= 4
              const learning = current < 1
              return (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#1a1a1a', borderRadius: '2px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: current > 0 ? '#cce0f5' : '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: '14px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>
                    {current}
                  </span>
                  {isMax ? (
                    <span style={{ padding: '2px 8px', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: '160px', textAlign: 'right' }}>Life&apos;s Work</span>
                  ) : (
                    <button onClick={() => startSkillSpend(s.name)} disabled={!canBuy}
                      style={{
                        padding: '2px 10px',
                        background: canBuy ? '#1a2e10' : '#0f0f0f',
                        border: `1px solid ${canBuy ? '#2d5a1b' : '#2e2e2e'}`,
                        borderRadius: '2px',
                        color: canBuy ? '#7fc458' : '#3a3a3a',
                        fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                        letterSpacing: '.04em', textTransform: 'uppercase',
                        cursor: canBuy ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap', minWidth: '160px',
                        fontWeight: isLv4Step(current) ? 700 : 400,
                      }}>
                      {learning ? `Learn` : `Raise to ${next}`}{isLv4Step(current) ? ' ⭐' : ''} — {cost} CDP
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Confirm overlay — appears on top of the spend list when a row
          is clicked. Lv 4 steps require a narrative; everything else
          is a single-tap confirm. */}
      {pending && (
        <div onClick={() => !saving && setPending(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#1a1a1a', border: `1px solid ${pending.needsNarrative ? '#EF9F27' : '#5a2e5a'}`, borderRadius: '4px', width: '480px', maxWidth: '100%', padding: '18px' }}>
            <div style={{ fontSize: '13px', color: pending.needsNarrative ? '#EF9F27' : '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
              {pending.needsNarrative ? '⭐ Lv 4 — Fill In The Gaps' : 'Confirm Spend'}
            </div>
            <div style={{ fontSize: '17px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 700, marginBottom: '8px' }}>
              {pending.kind === 'rapid'
                ? `${ATTR_FULL[pending.key as AttributeName]} → ${pending.toLevel}`
                : pending.fromLevel < 1
                  ? `Learn ${pending.key} (Lv ${pending.toLevel})`
                  : `${pending.key} → ${pending.toLevel}`}
            </div>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '12px' }}>
              Spend <strong style={{ color: '#7ab3d4' }}>{pending.cost} CDP</strong> from your {cdpBalance} balance.
              {pending.needsNarrative && (
                <> Lv 4 is the human ceiling — write how your character broke through.</>
              )}
            </div>
            {pending.needsNarrative && (
              <textarea value={pending.narrative}
                onChange={e => setPending(p => p ? { ...p, narrative: e.target.value } : p)}
                rows={4}
                placeholder="One full sentence minimum. The GM reads this back later — make it a real moment in your character's arc."
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', resize: 'vertical', marginBottom: '10px' }} />
            )}
            {error && (
              <div style={{ padding: '8px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', marginBottom: '10px' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <button onClick={() => setPending(null)} disabled={saving}
                style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.4 : 1 }}>
                Cancel
              </button>
              <button onClick={commit} disabled={saving}
                style={{ padding: '8px 18px', background: pending.needsNarrative ? '#2a2010' : '#1a2e10', border: `1px solid ${pending.needsNarrative ? '#5a4a1b' : '#2d5a1b'}`, borderRadius: '3px', color: pending.needsNarrative ? '#EF9F27' : '#7fc458', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Saving…' : '✓ Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
