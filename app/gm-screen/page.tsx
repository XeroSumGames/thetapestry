'use client'

// Skip Next's static prerender entirely. /gm-screen mounts a Supabase client
// (via the GmNotes panel + layout persistence) and reads useSearchParams() -
// both patterns that have hit prerender-time failures on Vercel. The popout is
// always opened from a story header, never crawled, so dynamic is right.
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { loadGmScreenLayout, saveGmScreenLayout, type CardPos } from '../../lib/data/gm-screen-layout'

// Client-only import - GmNotes pulls in @supabase/ssr's browser client at
// module load. Keeping it out of the server bundle shrinks the SSR payload.
const GmNotes = dynamicImport(() => import('../../components/GmNotes'), { ssr: false })

// ---------------------------------------------------------------------------
// Redesign 2026-07-20: the hand-rolled free-float drag engine (raw mousemove/
// mouseup + a mutable dragRef + a deferred setLayout updater that threw a
// null-deref on mouseup, 66bea03f) is gone. Cards drag freely on a dnd-kit
// canvas - dnd-kit owns the drag lifecycle, so that crash class cannot recur -
// snapping to an 8px grid on drop and clamped so they can't leave the canvas.
// Position (x/y/width) + collapsed + filter save per-GM to gm_screen_layouts.
// NOTE (accepted tradeoff): freeform placement allows overlap and does not
// responsively reflow (react-grid-layout, which auto-packs, calls the removed
// findDOMNode and crashes on React 19) - same behavior as the old screen.
// ---------------------------------------------------------------------------

const OUTCOMES = [
  { roll: '1+1', label: 'Low Insight', color: '#c0392b', desc: 'Critical failure. +1 Insight Die. Weapon jam possible.' },
  { roll: '0-3', label: 'Dire Failure', color: '#f5a89a', desc: 'Very bad result.' },
  { roll: '4-8', label: 'Failure', color: '#EF9F27', desc: 'Standard failure.' },
  { roll: '9-13', label: 'Success', color: '#7fc458', desc: 'Standard success.' },
  { roll: '14+', label: 'Wild Success', color: '#7ab3d4', desc: 'Exceptional success.' },
  { roll: '6+6', label: 'High Insight', color: '#d48bd4', desc: 'Critical success. +1 Insight Die.' },
]

const COMBAT_ACTIONS = [
  { name: 'Aim', cost: 1, desc: '+2 CMod on next attack. Must attack next or lost.' },
  { name: 'Attack', cost: 1, desc: 'Roll weapon skill. Damage on success.' },
  { name: 'Charge', cost: 2, desc: 'Move 20ft + melee/unarmed attack.' },
  { name: 'Coordinate', cost: 1, desc: 'Tactics roll. Allies in Close get +2 CMod vs target.' },
  { name: 'Cover Fire', cost: 1, desc: "-2 CMod to enemy's next action. Spends a round of ammo." },
  { name: 'Defend', cost: 1, desc: '+2 defensive mod vs next attack. Clears after one hit.' },
  { name: 'Distract', cost: 1, desc: 'Steal 1 action from target.' },
  { name: 'Fire from Cover', cost: 2, desc: 'Attack from cover. Keep defense bonus.' },
  { name: 'Grapple', cost: 1, desc: 'Opposed PHY + Unarmed. Winner restrains or takes 1 RP.' },
  { name: 'Inspire', cost: 1, desc: 'Grant +1 action to ally. Once per round.' },
  { name: 'Move', cost: 1, desc: 'Move 10ft (Chebyshev).' },
  { name: 'Rapid Fire', cost: 2, desc: 'Two shots. -1 CMod first, -3 second. Ranged only.' },
  { name: 'Ready Weapon', cost: 1, desc: 'Switch, Reload, or Unjam weapon.' },
  { name: 'Reposition', cost: 1, desc: 'End-of-round positioning.' },
  { name: 'Sprint', cost: 2, desc: 'Move 30ft. Athletics check or Winded.' },
  { name: 'Subdue', cost: 1, desc: 'Non-lethal. Full RP, 50% WP damage.' },
  { name: 'Take Cover', cost: 1, desc: '+2 defense for all attacks this round. Once per round.' },
  { name: 'Unarmed', cost: 1, desc: 'PHY + Unarmed Combat. 1d3 damage.' },
  { name: 'Stabilize', cost: 1, desc: 'Medicine roll on mortally wounded. Must be Engaged.' },
]

const RANGE_BANDS = [
  { band: 'Engaged', range: '0-5ft', color: '#7fc458' },
  { band: 'Close', range: '6-30ft', color: '#7ab3d4' },
  { band: 'Medium', range: '31-100ft', color: '#EF9F27' },
  { band: 'Long', range: '101-300ft', color: '#f5a89a' },
  { band: 'Distant', range: '301-600ft', color: '#c0392b' },
]

const CONDITIONS = [
  { cond: 'Pristine', cmod: '+1', color: '#7fc458' },
  { cond: 'Used', cmod: '0', color: '#f5f2ee' },
  { cond: 'Worn', cmod: '-1', color: '#EF9F27' },
  { cond: 'Damaged', cmod: '-2', color: '#f5a89a' },
  { cond: 'Broken', cmod: 'Unusable', color: '#c0392b' },
]

const CMODS = [
  { source: 'Aim', mod: '+2' },
  { source: 'Defend', mod: '+2 defense' },
  { source: 'Take Cover', mod: '+2 defense (all attacks)' },
  { source: 'Same Target', mod: '+1 (second attack)' },
  { source: 'Coordinate', mod: '+2 vs coordinated target' },
  { source: 'Inspired', mod: '+1 action' },
  { source: 'Distracted', mod: '-1 action' },
  { source: 'Cover Fire', mod: '-2 to target' },
  { source: 'Winded', mod: '1 action next round' },
]

const HEALING = [
  { type: 'WP Recovery', rate: '1 WP per day of rest' },
  { type: 'WP (Mortally Wounded)', rate: '1 WP per 2 days of rest' },
  { type: 'RP Recovery', rate: '1 RP per hour' },
  { type: 'Death Countdown', rate: '4 + PHY rounds' },
  { type: 'Incapacitation', rate: '4 - PHY rounds, then 1 WP + 1 RP' },
  { type: 'Stress Check', rate: '2d6 + RSN + ACU >= 7' },
  { type: 'Reduce Stress', rate: '8+ hours narrative downtime' },
]

const SKILLS_MAP = [
  { skill: 'Animal Handling', attr: 'INF' }, { skill: 'Athletics', attr: 'PHY' },
  { skill: 'Barter', attr: 'INF' }, { skill: 'Demolitions', attr: 'PHY' },
  { skill: 'Driving', attr: 'DEX' }, { skill: 'Entertainment', attr: 'INF' },
  { skill: 'Farming', attr: 'ACU' }, { skill: 'Gambling', attr: 'ACU' },
  { skill: 'Heavy Weapons', attr: 'PHY' }, { skill: 'Inspiration', attr: 'INF' },
  { skill: 'Lock-Picking', attr: 'ACU' }, { skill: 'Manipulation', attr: 'INF' },
  { skill: 'Mechanic', attr: 'RSN' }, { skill: 'Medicine', attr: 'RSN' },
  { skill: 'Melee Combat', attr: 'PHY' }, { skill: 'Navigation', attr: 'RSN' },
  { skill: 'Psychology', attr: 'RSN' }, { skill: 'Ranged Combat', attr: 'DEX' },
  { skill: 'Research', attr: 'RSN' }, { skill: 'Scavenging', attr: 'ACU' },
  { skill: 'Sleight of Hand', attr: 'DEX' }, { skill: 'Specific Knowledge', attr: 'RSN' },
  { skill: 'Stealth', attr: 'PHY' }, { skill: 'Streetwise', attr: 'ACU' },
  { skill: 'Survival', attr: 'ACU' }, { skill: 'Tactics', attr: 'RSN' },
  { skill: 'Tinkerer', attr: 'DEX' }, { skill: 'Unarmed Combat', attr: 'PHY' },
  { skill: 'Weaponsmith', attr: 'DEX' },
]

// EMPTY / Session Zero example shown in the GM Notes card standalone (no ?c=).
// Source: sql/empty-seed.sql. Stand-in for the planned Campaign Builder.
const EMPTY_SESSION_ZERO: { heading: string; body: string }[] = [
  { heading: 'The setup - Battersby Farm', body: 'Almost a year since the dog flu. The party are friends/family of David Battersby, waiting out the pandemic on his farm near the Maryland / Delaware border. A tractor broke and needs an arc welder; David knows of a garage nearby. The party takes his truck after breakfast. This is where Empty begins.' },
  { heading: "Stansfield's Gas Station", body: "Owned by Errol and Martina Stansfield ~15 years; both died at home within days. Secluded, so it sits untouched - store intact but contents expired. Inside is Becky; she and Dylan arrived the night before. Dylan is out hunting and returns soon after the party meets Becky, down to 3 bullets (more in Becky's bag on the counter; a shotgun with 2 shells in their truck)." },
  { heading: 'Becky (late 20s)', body: 'Long red hair, easy smile, calm and insightful. Complication: Loss. Motivation: Find Safety. Friendly but never answers directly - buys time for Dylan, mirrors his mood on arrival. If Dylan dies or is incapacitated she surrenders, overwhelmed with grief, and will not stop the party taking her belongings.' },
  { heading: 'Dylan (early 30s)', body: 'Short hair, tattoos, wears a holster. Charming, furtive, smart like a fox. Complication: Dark Secret. Motivation: To Take Advantage. Two modes - PEACEFUL (wants to join a group, offers skills) or HOSTILE (views survivors as marks, may tail the party home). Pulls his gun if talks fail. Grapple +3; grabs the weakest player as a hostage if outnumbered.' },
  { heading: 'The map - eight key locations', body: '(1) Entrance - park the truck. (2) Abandoned car - dead battery, nothing of value. (3) Dylan\'s bike - saddlebags of survival gear. (4) Main entrance - door bell rings unless Wild Success on Stealth. (5) Breakroom - pullout couch, instant noodles. (6) Rear fire escape - unlocked, heavy, noisy. (7) Workshop - arc welder + a tow truck that starts first try. (8) Side fire escape - same as 6.' },
]

// ---------------------------------------------------------------------------

type CardKey = 'outcomes' | 'combat-actions' | 'range-bands' | 'weapon-condition' | 'cmods' | 'healing' | 'skills-attrs' | 'gm-notes'
type Category = 'combat' | 'reference' | 'notes'
type Filter = 'all' | Category

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'combat', label: 'Combat' },
  { key: 'reference', label: 'Reference' },
  { key: 'notes', label: 'GM Notes' },
]

const CARD_META: { key: CardKey; title: string; category: Category }[] = [
  { key: 'outcomes', title: 'Outcomes', category: 'reference' },
  { key: 'combat-actions', title: 'Combat Actions', category: 'combat' },
  { key: 'cmods', title: 'Conditional Modifiers', category: 'combat' },
  { key: 'range-bands', title: 'Range Bands', category: 'combat' },
  { key: 'weapon-condition', title: 'Weapon Condition', category: 'combat' },
  { key: 'healing', title: 'Healing & Recovery', category: 'reference' },
  { key: 'skills-attrs', title: 'Skills -> Attributes', category: 'reference' },
  { key: 'gm-notes', title: 'GM Notes', category: 'notes' },
]
const CARD_KEYS = CARD_META.map(m => m.key)
const CATEGORY_OF = Object.fromEntries(CARD_META.map(m => [m.key, m.category])) as Record<CardKey, Category>
const TITLE_OF = Object.fromEntries(CARD_META.map(m => [m.key, m.title])) as Record<CardKey, string>

// Default freeform arrangement: two columns, with Conditional Modifiers placed
// directly beneath Outcomes in the left column (Xero 2026-07-20).
const COL2 = 440
// Two columns; CMods directly beneath Outcomes (Xero 2026-07-20). y offsets
// leave room for each card's FULL content height (cards auto-grow to show
// everything by default), so the initial layout does not overlap.
const DEFAULT_POSITIONS: Record<CardKey, CardPos> = {
  'outcomes':         { x: 0,    y: 0,   w: 424 },
  'cmods':            { x: 0,    y: 256, w: 424 },
  'range-bands':      { x: 0,    y: 576, w: 424 },
  'weapon-condition': { x: 0,    y: 768, w: 424 },
  'combat-actions':   { x: COL2, y: 0,   w: 424 },
  'healing':          { x: COL2, y: 560, w: 424 },
  'skills-attrs':     { x: COL2, y: 816, w: 424 },
  'gm-notes':         { x: 0,    y: 984, w: 864 },
}

const GRID = 8
const snap = (v: number) => Math.round(v / GRID) * GRID
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const sectionHeading: React.CSSProperties = { fontSize: '15px', color: '#c0392b', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }
const cellStyle: React.CSSProperties = { fontSize: '15px', fontFamily: 'Carlito, sans-serif', padding: '2px 6px', borderBottom: '1px solid #2e2e2e' }

function cardBody(key: CardKey, campaignId: string): React.ReactNode {
  switch (key) {
    case 'outcomes':
      return OUTCOMES.map(o => (
        <div key={o.label} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
          <span style={{ ...cellStyle, color: o.color, fontWeight: 700, minWidth: '36px' }}>{o.roll}</span>
          <span style={{ ...cellStyle, color: o.color, fontWeight: 700, minWidth: '100px' }}>{o.label}</span>
          <span style={{ ...cellStyle, color: '#f5f2ee', flex: 1 }}>{o.desc}</span>
        </div>
      ))
    case 'combat-actions':
      return COMBAT_ACTIONS.map(a => (
        <div key={a.name} style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginBottom: '2px' }}>
          <span style={{ ...cellStyle, fontWeight: 700, color: '#f5f2ee', minWidth: '90px' }}>{a.name}</span>
          <span style={{ ...cellStyle, color: a.cost === 2 ? '#EF9F27' : '#7fc458', minWidth: '16px', textAlign: 'center' }}>{a.cost}</span>
          <span style={{ ...cellStyle, color: '#f5f2ee', flex: 1 }}>{a.desc}</span>
        </div>
      ))
    case 'range-bands':
      return RANGE_BANDS.map(r => (
        <div key={r.band} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
          <span style={{ ...cellStyle, color: r.color, fontWeight: 700, minWidth: '70px' }}>{r.band}</span>
          <span style={{ ...cellStyle, color: '#f5f2ee' }}>{r.range}</span>
        </div>
      ))
    case 'weapon-condition':
      return CONDITIONS.map(c => (
        <div key={c.cond} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
          <span style={{ ...cellStyle, color: c.color, fontWeight: 700, minWidth: '70px' }}>{c.cond}</span>
          <span style={{ ...cellStyle, color: c.color }}>{c.cmod}</span>
        </div>
      ))
    case 'cmods':
      return CMODS.map(c => (
        <div key={c.source} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
          <span style={{ ...cellStyle, color: '#f5f2ee', fontWeight: 700, minWidth: '90px' }}>{c.source}</span>
          <span style={{ ...cellStyle, color: '#7fc458' }}>{c.mod}</span>
        </div>
      ))
    case 'healing':
      return HEALING.map(h => (
        <div key={h.type} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
          <span style={{ ...cellStyle, color: '#f5f2ee', fontWeight: 700, minWidth: '130px' }}>{h.type}</span>
          <span style={{ ...cellStyle, color: '#f5f2ee' }}>{h.rate}</span>
        </div>
      ))
    case 'skills-attrs':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
          {SKILLS_MAP.map(s => (
            <div key={s.skill} style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
              <span style={{ ...cellStyle, color: '#f5f2ee', flex: 1 }}>{s.skill}</span>
              <span style={{ ...cellStyle, color: '#7ab3d4', fontWeight: 700, minWidth: '30px' }}>{s.attr}</span>
            </div>
          ))}
        </div>
      )
    case 'gm-notes':
      return campaignId ? <GmNotes campaignId={campaignId} /> : (
        <div style={{ fontFamily: 'Carlito, sans-serif' }}>
          <div style={{ fontSize: '13px', color: '#7ab3d4', marginBottom: '8px', lineHeight: 1.4 }}>
            Example content from the <strong>Empty</strong> starter (Session Zero). Open the GM Screen from a story to load that story&rsquo;s live notes here instead.
          </div>
          {EMPTY_SESSION_ZERO.map(s => (
            <div key={s.heading} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '14px', color: '#f5f2ee', fontWeight: 700, marginBottom: '2px' }}>{s.heading}</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.5 }}>{s.body}</div>
            </div>
          ))}
        </div>
      )
  }
}

function FreeformCard({ cardKey, campaignId, pos, collapsed, onToggle, onMeasure }: {
  cardKey: CardKey; campaignId: string; pos: CardPos; collapsed: boolean
  onToggle: (k: CardKey) => void
  onMeasure: (k: CardKey, width: number, height: number | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: cardKey })
  const elRef = useRef<HTMLDivElement | null>(null)
  const setRefs = useCallback((node: HTMLDivElement | null) => { setNodeRef(node); elRef.current = node }, [setNodeRef])

  // Report size so the parent can persist a CSS resize (width + height) and
  // size the canvas. Height is reported as null while collapsed so the header-
  // only height never gets saved as the card's real height.
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const ro = new ResizeObserver(() => onMeasure(cardKey, el.offsetWidth, collapsed ? null : el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [cardKey, onMeasure, collapsed])

  const style: React.CSSProperties = {
    position: 'absolute', left: pos.x, top: pos.y, width: pos.w,
    // Explicit height only when expanded AND the GM has sized it; otherwise auto
    // so the card grows to show ALL its content (no scroll cap).
    height: (!collapsed && pos.h) ? pos.h : undefined,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 20 : 1,
    background: '#191919', border: '1px solid ' + (isDragging ? '#4a6a8a' : '#2e2e2e'),
    borderRadius: 4, overflow: 'hidden', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
    minWidth: 260, minHeight: 44,
    // Drag the corner to resize both ways; content scrolls if you make it short.
    resize: collapsed ? 'none' : 'both',
  }
  const isNotes = cardKey === 'gm-notes'
  return (
    <div ref={setRefs} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderBottom: collapsed ? 'none' : '1px solid #2e2e2e', background: '#151515', flexShrink: 0 }}>
        <button {...attributes} {...listeners} aria-label="Drag to move" title="Drag to move"
          style={{ cursor: 'grab', background: 'transparent', border: 'none', color: '#6a6a6a', fontSize: '16px', lineHeight: 1, padding: '0 2px', touchAction: 'none' }}>&#x2237;&#x2237;</button>
        <div style={{ ...sectionHeading, flex: 1 }}>{TITLE_OF[cardKey]}</div>
        <button onClick={() => onToggle(cardKey)} aria-label={collapsed ? 'Expand' : 'Collapse'} title={collapsed ? 'Expand' : 'Collapse'}
          style={{ background: 'transparent', border: '1px solid #3a3a3a', borderRadius: 3, color: '#cce0f5', width: 24, height: 24, cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: 0, flexShrink: 0, fontFamily: 'Carlito, sans-serif' }}>{collapsed ? '▸' : '▾'}</button>
      </div>
      {!collapsed && (
        <div style={{ padding: isNotes ? '8px 10px 10px' : '6px 12px 10px', overflow: 'auto', flex: 1, minHeight: 0 }}>
          {cardBody(cardKey, campaignId)}
        </div>
      )}
    </div>
  )
}

export default function GMScreen() {
  const searchParams = useSearchParams()
  const campaignId = searchParams?.get('c') ?? ''

  const [positions, setPositions] = useState<Record<CardKey, CardPos>>(DEFAULT_POSITIONS)
  const [collapsed, setCollapsed] = useState<Set<CardKey>>(new Set())
  const [filter, setFilter] = useState<Filter>('all')
  const [hydrated, setHydrated] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  // Load per-GM layout once. Missing row / signed-out / pre-migration -> defaults.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const saved = await loadGmScreenLayout()
      if (!alive) return
      if (saved) {
        const known = new Set<string>(CARD_KEYS)
        // Merge: saved position per known key wins; unknown keys ignored; any
        // card missing from the save keeps its default (never orphaned).
        const merged = { ...DEFAULT_POSITIONS }
        for (const [k, p] of Object.entries(saved.positions)) if (known.has(k)) merged[k as CardKey] = p
        setPositions(merged)
        setCollapsed(new Set(saved.collapsed.filter((k): k is CardKey => known.has(k))))
        if (FILTERS.some(f => f.key === saved.filter)) setFilter(saved.filter as Filter)
      }
      setHydrated(true)
    })()
    return () => { alive = false }
  }, [])

  // Persist (debounced) after hydration so the initial load doesn't echo back.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!hydrated) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveGmScreenLayout({ positions, collapsed: Array.from(collapsed), filter })
    }, 600)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [positions, collapsed, filter, hydrated])

  // 6px activation so a click on the chevron / a resize-grab does not drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(e: DragEndEvent) {
    const key = e.active.id as CardKey
    const cw = canvasRef.current?.offsetWidth ?? 4000
    setPositions(prev => {
      const p = prev[key]
      if (!p) return prev
      const nx = clamp(snap(p.x + e.delta.x), 0, Math.max(0, cw - p.w))
      const ny = Math.max(0, snap(p.y + e.delta.y))
      if (nx === p.x && ny === p.y) return prev
      return { ...prev, [key]: { ...p, x: nx, y: ny } }
    })
  }

  // A card's CSS resize changed its size -> persist width and (when expanded)
  // height. Guarded by a >=2px delta so re-applying the persisted size doesn't
  // loop the observer. height === null means collapsed; leave the saved height.
  const handleMeasure = useCallback((key: CardKey, width: number, height: number | null) => {
    setPositions(prev => {
      const p = prev[key]
      if (!p) return prev
      const wChanged = Math.abs(width - p.w) >= 2
      const hChanged = height != null && (p.h == null || Math.abs(height - p.h) >= 2)
      if (!wChanged && !hChanged) return prev
      return { ...prev, [key]: { ...p, ...(wChanged ? { w: width } : {}), ...(hChanged ? { h: height } : {}) } }
    })
  }, [])

  const toggleCollapse = useCallback((k: CardKey) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }, [])

  function resetLayout() {
    setPositions(DEFAULT_POSITIONS)
    setCollapsed(new Set())
    setFilter('all')
  }

  const visible = CARD_KEYS.filter(k => filter === 'all' || CATEGORY_OF[k] === filter)
  const canvasHeight = Math.max(400, ...visible.map(k => positions[k].y + (positions[k].h ?? 280))) + 24

  const chipStyle = (active: boolean): React.CSSProperties => ({
    height: 30, padding: '0 14px', fontFamily: 'Carlito, sans-serif', fontSize: 13,
    background: active ? '#22303d' : '#151515',
    color: active ? '#f5f2ee' : '#cce0f5',
    border: '1px solid ' + (active ? '#4a6a8a' : '#3a3a3a'),
    borderRadius: 4, cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase',
  })

  return (
    <div style={{ background: '#0f0f0f', color: '#f5f2ee', minHeight: '100vh', padding: '12px', fontFamily: 'Carlito, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>GM Screen</div>
        <div style={{ fontSize: '15px', color: '#c0392b', letterSpacing: '.06em', textTransform: 'uppercase' }}>Xero Sum Engine SRD v1.1</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={chipStyle(filter === f.key)}>{f.label}</button>
          ))}
        </div>
        <button onClick={resetLayout} style={chipStyle(false)}>Reset</button>
      </div>

      <div style={{ fontSize: 13, color: '#6a6a6a', marginBottom: '10px' }}>
        Drag the &#x2237;&#x2237; handle to move a card anywhere (snaps to a grid). Drag a card&rsquo;s right edge to widen it. Chevron collapses it. Your layout saves to your account.
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div ref={canvasRef} style={{ position: 'relative', width: '100%', height: canvasHeight }}>
          {visible.map(k => (
            <FreeformCard key={k} cardKey={k} campaignId={campaignId} pos={positions[k]} collapsed={collapsed.has(k)} onToggle={toggleCollapse} onMeasure={handleMeasure} />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
