'use client'

import { useEffect, useRef, useState } from 'react'

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
  { name: 'Cover Fire', cost: 1, desc: '-2 CMod to enemy\'s next action.' },
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
  { cond: 'Used', cmod: '0', color: '#d4cfc9' },
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

type BoxKey = 'outcomes' | 'combat-actions' | 'range-bands' | 'weapon-condition' | 'cmods' | 'healing' | 'skills-attrs'

interface BoxLayout { x: number; y: number; w: number; h: number }

const DEFAULT_LAYOUT: Record<BoxKey, BoxLayout> = {
  'outcomes':         { x: 0,   y: 0,   w: 430, h: 175 },
  'combat-actions':   { x: 440, y: 0,   w: 430, h: 460 },
  'range-bands':      { x: 0,   y: 185, w: 430, h: 155 },
  'weapon-condition': { x: 0,   y: 350, w: 430, h: 155 },
  'cmods':            { x: 0,   y: 515, w: 430, h: 240 },
  'healing':          { x: 440, y: 470, w: 430, h: 200 },
  'skills-attrs':     { x: 440, y: 680, w: 430, h: 380 },
}

const STORAGE_LAYOUT = 'gmscreen.layout.v1'
const STORAGE_LOCKED = 'gmscreen.locked.v1'

const sectionHeading: React.CSSProperties = { fontSize: '15px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }
const cellStyle: React.CSSProperties = { fontSize: '15px', fontFamily: 'Carlito, sans-serif', padding: '2px 6px', borderBottom: '1px solid #2e2e2e' }

export default function GMScreen() {
  const [layout, setLayout] = useState<Record<BoxKey, BoxLayout>>(DEFAULT_LAYOUT)
  const [locked, setLocked] = useState<boolean>(true)
  const [hydrated, setHydrated] = useState(false)
  const boxRefs = useRef<Partial<Record<BoxKey, HTMLDivElement | null>>>({})
  const dragRef = useRef<{ key: BoxKey; startX: number; startY: number; origX: number; origY: number } | null>(null)

  useEffect(() => {
    try {
      const savedLayout = localStorage.getItem(STORAGE_LAYOUT)
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout)
        if (parsed && typeof parsed === 'object') {
          setLayout(prev => ({ ...prev, ...parsed }))
        }
      }
      const savedLock = localStorage.getItem(STORAGE_LOCKED)
      if (savedLock !== null) setLocked(savedLock === 'true')
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(layout)) } catch {}
  }, [layout, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_LOCKED, String(locked)) } catch {}
  }, [locked, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const observers: ResizeObserver[] = []
    ;(Object.keys(boxRefs.current) as BoxKey[]).forEach(key => {
      const el = boxRefs.current[key]
      if (!el) return
      const ro = new ResizeObserver(() => {
        const w = el.offsetWidth
        const h = el.offsetHeight
        setLayout(prev => {
          if (prev[key].w === w && prev[key].h === h) return prev
          return { ...prev, [key]: { ...prev[key], w, h } }
        })
      })
      ro.observe(el)
      observers.push(ro)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [hydrated, locked])

  function startDrag(key: BoxKey, e: React.MouseEvent) {
    if (locked) return
    e.preventDefault()
    dragRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      origX: layout[key].x,
      origY: layout[key].y,
    }

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setLayout(prev => ({
        ...prev,
        [dragRef.current!.key]: {
          ...prev[dragRef.current!.key],
          x: Math.max(0, dragRef.current!.origX + dx),
          y: Math.max(0, dragRef.current!.origY + dy),
        },
      }))
    }

    function onUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function resetLayout() {
    if (!confirm('Reset all panels to default layout?')) return
    setLayout(DEFAULT_LAYOUT)
  }

  const canvasWidth = Math.max(...Object.values(layout).map(l => l.x + l.w)) + 12
  const canvasHeight = Math.max(...Object.values(layout).map(l => l.y + l.h)) + 12

  function boxStyle(key: BoxKey): React.CSSProperties {
    const { x, y, w, h } = layout[key]
    return {
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      minWidth: 220,
      minHeight: 90,
      background: '#1a1a1a',
      border: locked ? '1px solid #2e2e2e' : '1px solid #4a6a8a',
      borderRadius: '4px',
      overflow: 'auto',
      resize: locked ? 'none' : 'both',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }
  }

  function dragHandleStyle(): React.CSSProperties {
    return {
      cursor: locked ? 'default' : 'move',
      padding: '8px 12px 6px',
      borderBottom: '1px solid #2e2e2e',
      userSelect: 'none',
      background: locked ? 'transparent' : '#22303d',
      flexShrink: 0,
    }
  }

  const bodyStyle: React.CSSProperties = { padding: '6px 12px 10px', overflow: 'auto', flex: 1 }

  const toolbarBtn = (active: boolean): React.CSSProperties => ({
    height: 28,
    padding: '0 12px',
    fontFamily: 'Carlito, sans-serif',
    fontSize: 13,
    background: active ? '#22303d' : '#1a1a1a',
    color: active ? '#f5f2ee' : '#cce0f5',
    border: '1px solid ' + (active ? '#4a6a8a' : '#3a3a3a'),
    borderRadius: 4,
    cursor: 'pointer',
    letterSpacing: '.06em',
    textTransform: 'uppercase',
  })

  return (
    <div style={{ background: '#0f0f0f', color: '#f5f2ee', minHeight: '100vh', padding: '12px', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>GM Screen</div>
        <div style={{ fontSize: '15px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Xero Sum Engine SRD v1.1</div>
        <div style={{ flex: 1 }} />
        {!locked && (
          <div style={{ fontSize: 13, color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
            Drag the title bar to move · Drag the bottom-right corner to resize
          </div>
        )}
        <button onClick={() => setLocked(l => !l)} style={toolbarBtn(!locked)}>
          {locked ? '🔒 Locked' : '✎ Editing'}
        </button>
        <button onClick={resetLayout} style={toolbarBtn(false)}>Reset Layout</button>
      </div>

      <div style={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>

        {/* Outcomes */}
        <div ref={el => { boxRefs.current['outcomes'] = el }} style={boxStyle('outcomes')}>
          <div onMouseDown={e => startDrag('outcomes', e)} style={dragHandleStyle()}>
            <div style={sectionHeading}>Outcomes</div>
          </div>
          <div style={bodyStyle}>
            {OUTCOMES.map(o => (
              <div key={o.label} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
                <span style={{ ...cellStyle, color: o.color, fontWeight: 700, minWidth: '36px' }}>{o.roll}</span>
                <span style={{ ...cellStyle, color: o.color, fontWeight: 700, minWidth: '100px' }}>{o.label}</span>
                <span style={{ ...cellStyle, color: '#d4cfc9', flex: 1 }}>{o.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Combat Actions */}
        <div ref={el => { boxRefs.current['combat-actions'] = el }} style={boxStyle('combat-actions')}>
          <div onMouseDown={e => startDrag('combat-actions', e)} style={dragHandleStyle()}>
            <div style={sectionHeading}>Combat Actions</div>
          </div>
          <div style={bodyStyle}>
            {COMBAT_ACTIONS.map(a => (
              <div key={a.name} style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginBottom: '2px' }}>
                <span style={{ ...cellStyle, fontWeight: 700, color: '#f5f2ee', minWidth: '90px' }}>{a.name}</span>
                <span style={{ ...cellStyle, color: a.cost === 2 ? '#EF9F27' : '#7fc458', minWidth: '16px', textAlign: 'center' }}>{a.cost}</span>
                <span style={{ ...cellStyle, color: '#d4cfc9', flex: 1 }}>{a.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Range Bands */}
        <div ref={el => { boxRefs.current['range-bands'] = el }} style={boxStyle('range-bands')}>
          <div onMouseDown={e => startDrag('range-bands', e)} style={dragHandleStyle()}>
            <div style={sectionHeading}>Range Bands</div>
          </div>
          <div style={bodyStyle}>
            {RANGE_BANDS.map(r => (
              <div key={r.band} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
                <span style={{ ...cellStyle, color: r.color, fontWeight: 700, minWidth: '70px' }}>{r.band}</span>
                <span style={{ ...cellStyle, color: '#d4cfc9' }}>{r.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weapon Condition */}
        <div ref={el => { boxRefs.current['weapon-condition'] = el }} style={boxStyle('weapon-condition')}>
          <div onMouseDown={e => startDrag('weapon-condition', e)} style={dragHandleStyle()}>
            <div style={sectionHeading}>Weapon Condition</div>
          </div>
          <div style={bodyStyle}>
            {CONDITIONS.map(c => (
              <div key={c.cond} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
                <span style={{ ...cellStyle, color: c.color, fontWeight: 700, minWidth: '70px' }}>{c.cond}</span>
                <span style={{ ...cellStyle, color: c.color }}>{c.cmod}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CMod Bonuses */}
        <div ref={el => { boxRefs.current['cmods'] = el }} style={boxStyle('cmods')}>
          <div onMouseDown={e => startDrag('cmods', e)} style={dragHandleStyle()}>
            <div style={sectionHeading}>Conditional Modifiers</div>
          </div>
          <div style={bodyStyle}>
            {CMODS.map(c => (
              <div key={c.source} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
                <span style={{ ...cellStyle, color: '#f5f2ee', fontWeight: 700, minWidth: '90px' }}>{c.source}</span>
                <span style={{ ...cellStyle, color: '#7fc458' }}>{c.mod}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Healing & Recovery */}
        <div ref={el => { boxRefs.current['healing'] = el }} style={boxStyle('healing')}>
          <div onMouseDown={e => startDrag('healing', e)} style={dragHandleStyle()}>
            <div style={sectionHeading}>Healing & Recovery</div>
          </div>
          <div style={bodyStyle}>
            {HEALING.map(h => (
              <div key={h.type} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
                <span style={{ ...cellStyle, color: '#f5f2ee', fontWeight: 700, minWidth: '130px' }}>{h.type}</span>
                <span style={{ ...cellStyle, color: '#d4cfc9' }}>{h.rate}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Skills → Attributes */}
        <div ref={el => { boxRefs.current['skills-attrs'] = el }} style={boxStyle('skills-attrs')}>
          <div onMouseDown={e => startDrag('skills-attrs', e)} style={dragHandleStyle()}>
            <div style={sectionHeading}>Skills → Attributes</div>
          </div>
          <div style={bodyStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
              {SKILLS_MAP.map(s => (
                <div key={s.skill} style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
                  <span style={{ ...cellStyle, color: '#d4cfc9', flex: 1 }}>{s.skill}</span>
                  <span style={{ ...cellStyle, color: '#7ab3d4', fontWeight: 700, minWidth: '30px' }}>{s.attr}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
