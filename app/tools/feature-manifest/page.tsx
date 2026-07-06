'use client'
import { useEffect, useRef, useState } from 'react'
import { getCachedAuth } from '../../../lib/auth-cache'
import { isThriverUser, loadFeatureChecklist, saveFeatureChecklist } from '../../../lib/data/feature-checklist'

// /tools/feature-manifest - Thriver-only verification checklist of every game
// feature, grouped by system. State persists per-user to
// feature_checklist_state (JSONB blob, one row per user, upserted on each tick)
// so a Thriver's progress follows them across browsers + devices. Superseded
// the standalone localStorage HTML (tasks/feature-manifest.html) - that one
// couldn't persist off the owner's device.

type Cell = { d?: boolean; f?: boolean }   // d = verified, f = flagged
type State = Record<string, Cell>

const DATA: { name: string; items: [string, string, string?][] }[] = [
  { name: 'Character', items: [
    ['char-create', 'Character creation - three paths', 'Random, Quick, and Full Backstory paradigms'],
    ['rapid', 'RAPID attributes', 'Reason, Acumen, Physicality, Influence, Dexterity'],
    ['secondary', 'Secondary stats', 'Wound + Resolve points, defenses, initiative, perception, encumbrance'],
    ['skills', '29 skills across the five attributes', ''],
    ['comp-motiv', 'Complications & Motivations', ''],
    ['insight', 'Insight Dice', ''],
    ['evolution', 'Character evolution / leveling', 'CDP progression + the Evolution modal'],
    ['apprentices', 'Apprentices', ''],
    ['pregens', 'Pregenerated characters', 'Library + one-click Use into a campaign'],
    ['char-sheet', 'Play-view character sheet', ''],
    ['portraits', 'Portraits & photos', ''],
  ] },
  { name: 'Core Play & Checks', items: [
    ['dice-check', 'The 2d6 dice-check engine', ''],
    ['attr-check', 'Attribute checks', ''],
    ['skill-check', 'Skill checks', ''],
    ['modifiers', 'Modifier stack', 'AMod / SMod / CMod'],
    ['first-imp', 'First Impressions', 'Stored per PC + per NPC, auto-applied to later social rolls'],
    ['insight-award', 'Insight spend & award', ''],
    ['group-check', 'Coordinated Effort / group checks', ''],
    ['negotiations', 'Negotiations & Making the Case', ''],
    ['gaps', 'Filling in the Gaps', ''],
  ] },
  { name: 'Combat', items: [
    ['initiative', 'Turn order & combat rounds', ''],
    ['attacks', 'Ranged & melee attacks', ''],
    ['damage', 'Damage to Wound / Resolve', ''],
    ['incap', 'Incapacitation & mortal wounds', ''],
    ['stress', 'Stress & stress checks', 'The 8 special-check narratives'],
    ['healing', 'Healing', ''],
    ['infection', 'Wound infection & sickness', ''],
    ['disarm', 'Disarm', ''],
    ['grapple', 'Grapple', ''],
    ['pistol-whip', 'Pistol-whip - improvised melee with a gun', ''],
    ['range', 'Range bands', ''],
    ['bestiary', 'Bestiary / NPC statblocks', ''],
    ['env-dmg', 'Environmental damage', ''],
  ] },
  { name: 'Equipment & Inventory', items: [
    ['inventory', 'Character inventory', ''],
    ['custom-items', 'Custom items', ''],
    ['encumbrance', 'Encumbrance (Resolve drain)', ''],
    ['weapons', 'Weapons catalog', ''],
    ['armor', 'Armor - worn, condition, upkeep', ''],
    ['item-cond', 'Item condition & traits', ''],
    ['weapon-repair', 'Weapon repair', ''],
    ['rations', 'Rations', 'Standard, Luxury, Military'],
    ['upkeep', 'Upkeep phase', ''],
    ['loot', 'Loot & search - containers and corpses', ''],
    ['npc-trade', 'Trade with NPCs', ''],
    ['stockpile', 'Stockpiles & vehicle cargo', ''],
    ['tokens', 'Token & object library', ''],
  ] },
  { name: 'The Table', items: [
    ['tac-map', 'Tactical map - grid, tokens, movement', ''],
    ['fog', 'Fog of war, vision & lighting', ''],
    ['walls', 'Walls & line of sight', ''],
    ['camp-map', 'Campaign map with pins', ''],
    ['pin-reveal', 'Reveal / hide pins to players', ''],
    ['pings', 'Pings, measure tool, route & view sharing', ''],
    ['table-npcs', 'NPCs on the table', 'Reveal + "Also Here" on pins'],
    ['init-track', 'Initiative tracker', ''],
    ['roll-feed', 'Live dice roll feed', ''],
    ['chat', 'Table chat + GM whispers', ''],
    ['notes', 'GM notes & handouts', 'Shared vs GM-only split'],
    ['vehicles', 'Vehicles - popout, seats, firing arcs, cargo', ''],
    ['realtime', 'Real-time multi-client sync', ''],
    ['recorder', 'Playtest recorder', ''],
  ] },
  { name: 'Campaigns & Content', items: [
    ['stories', 'Stories / campaigns', ''],
    ['members', 'Members & invite codes', ''],
    ['settings', 'Settings', 'District Zero, Kings Crossroads, Custom'],
    ['modules', 'Modules / Rumors', 'Publish, version, marketplace, import'],
    ['gm-kit', 'GM Kit import', ''],
    ['snapshots', 'Progression log & session snapshots', ''],
    ['clock', 'Campaign clock & in-world time', ''],
    ['world-map', 'World map (global pins)', ''],
  ] },
  { name: 'Communities', items: [
    ['comm-struct', 'Community creation & structure', ''],
    ['morale', 'Morale', ''],
    ['recruit', 'Recruitment', ''],
    ['activity', 'Activity blocks', ''],
    ['comm-stock', 'Community stockpile', ''],
    ['migrations', 'Migrations & events', ''],
    ['growth', 'Growth notifications', ''],
  ] },
  { name: 'Social & Meta', items: [
    ['campfire', 'Campfire hub', ''],
    ['forums', 'Forums', ''],
    ['war-stories', 'War Stories', ''],
    ['lfg', 'Looking for Group', ''],
    ['messages', 'Direct messages', ''],
    ['notifs', 'Notifications', ''],
    ['roles', 'Roles & moderation', 'Thriver / Survivor / Ghost'],
    ['onboarding', 'Onboarding & user guide', ''],
    ['rules-ref', 'In-app rules reference', 'The full compendium at /rules'],
  ] },
]

const GAPS: [string, string][] = [
  ['Lv4 Skill Traits - auto-bonuses (Beacon of Hope, Insightful Counselor, etc.)', 'Ships together once the full trait list lands. The Evolution modal reaches Lv4 but has no trait picker yet.'],
  ['Weapon damage-balance pass', 'Revolver added; a consistency review across the whole catalog is a canon call on the numbers.'],
  ['Player-to-player item trade', 'Not a security hole, just not wired. A feature call: build it for beta or leave it off.'],
  ['Hidden-NPC fog occlusion', 'A revealed token showing only when a player can see the cell. Nice-to-have, rides on per-player vision.'],
  ['Encumbrance movement-halving', 'The Resolve-drain half is live; halving an overloaded token on the tactical map is not wired.'],
]

const TOTAL = DATA.reduce((n, s) => n + s.items.length, 0)

const C = {
  ink: '#f5f2ee', muted: '#cce0f5', faint: '#8a8178',
  red: '#c0392b', green: '#7fc458', amber: '#d99a2b',
  panel: '#1a1a1a', panel2: '#222', hair: '#2e2e2e', hair2: '#3a3a3a',
}
const sans = 'Carlito, sans-serif'

export default function FeatureManifestPage() {
  const [authChecked, setAuthChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [state, setState] = useState<State>({})
  const [filter, setFilter] = useState<'all' | 'todo' | 'flag'>('all')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) { setAuthChecked(true); return }
      const ok = await isThriverUser(user.id)
      setAllowed(ok); setUserId(user.id); setAuthChecked(true)
      if (ok) setState(await loadFeatureChecklist(user.id))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persist(next: State) {
    if (!userId) return
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const ok = await saveFeatureChecklist(userId, next)
      setSaveStatus(ok ? 'saved' : 'error')
      if (ok) setTimeout(() => setSaveStatus('idle'), 1600)
    }, 400)
  }

  function toggle(id: string, key: 'd' | 'f') {
    setState(prev => {
      const cell: Cell = { ...(prev[id] || {}) }
      cell[key] = !cell[key]
      const next: State = { ...prev }
      if (!cell.d && !cell.f) delete next[id]
      else next[id] = cell
      persist(next)
      return next
    })
  }

  const done = Object.values(state).filter(c => c.d).length
  const flagged = Object.values(state).filter(c => c.f).length
  const pct = TOTAL ? Math.round((done / TOTAL) * 100) : 0

  if (!authChecked) return <Shell><p style={{ color: C.muted, fontFamily: sans }}>Loading...</p></Shell>
  if (!userId) return <Shell><p style={{ color: C.muted, fontFamily: sans, fontSize: '15px' }}>Please sign in to use the Feature Manifest.</p></Shell>
  if (!allowed) return <Shell><p style={{ color: C.muted, fontFamily: sans, fontSize: '15px' }}>This tool is Thriver-only.</p></Shell>

  const saveLabel = saveStatus === 'saving' ? 'saving...' : saveStatus === 'saved' ? 'saved to your account' : saveStatus === 'error' ? 'save failed - retrying next tick' : ''
  const saveColor = saveStatus === 'error' ? C.amber : C.green

  return (
    <Shell>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
        <div style={{ fontFamily: 'Consolas, monospace', fontSize: '14px', color: C.muted, letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
          <b style={{ color: C.green, fontSize: '22px', fontWeight: 700 }}>{done}</b>
          <span style={{ color: C.faint }}> / {TOTAL} </span>verified
          {flagged > 0 && <span style={{ color: C.amber }}> &middot; {flagged} flagged</span>}
        </div>
        <div style={{ flex: '1 1 180px', height: '9px', background: C.panel2, border: `1px solid ${C.hair}`, borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.red}, ${C.amber} 55%, ${C.green})`, transition: 'width .35s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'todo', 'flag'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={filterBtn(filter === f)}>
              {f === 'all' ? 'All' : f === 'todo' ? 'To verify' : 'Flagged'}
            </button>
          ))}
        </div>
        <span aria-live="polite" style={{ fontFamily: 'Consolas, monospace', fontSize: '13px', letterSpacing: '.05em', color: saveColor, minWidth: '60px' }}>{saveLabel}</span>
      </div>

      {DATA.map((sec, si) => {
        const rows = sec.items.filter(([id]) => {
          const c = state[id] || {}
          if (filter === 'todo') return !c.d
          if (filter === 'flag') return !!c.f
          return true
        })
        if (rows.length === 0) return null
        const dn = sec.items.filter(([id]) => state[id]?.d).length
        return (
          <section key={si} style={{ marginTop: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', paddingBottom: '8px', borderBottom: `1px solid ${C.hair}` }}>
              <span style={{ fontFamily: 'Consolas, monospace', fontSize: '13px', color: C.red, letterSpacing: '.1em' }}>{String(si + 1).padStart(2, '0')}</span>
              <h2 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: C.ink, margin: 0 }}>{sec.name}</h2>
              <span style={{ marginLeft: 'auto', fontFamily: 'Consolas, monospace', fontSize: '13px', color: C.faint, letterSpacing: '.06em' }}>
                <b style={{ color: C.green }}>{String(dn).padStart(2, '0')}</b> / {String(sec.items.length).padStart(2, '0')}
              </span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {rows.map(([id, label, note]) => {
                const c = state[id] || {}
                return (
                  <li key={id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '11px 4px', borderBottom: `1px solid ${C.panel}`, background: c.f ? 'linear-gradient(90deg, rgba(217,154,43,.09), transparent 70%)' : 'transparent' }}>
                    <button
                      onClick={() => toggle(id, 'd')}
                      role="checkbox" aria-checked={!!c.d} aria-label={`Verified: ${label}`}
                      style={{
                        flex: '0 0 auto', width: '20px', height: '20px', marginTop: '1px', cursor: 'pointer',
                        borderRadius: '4px', border: `1.5px solid ${c.d ? C.green : C.hair2}`,
                        background: c.d ? C.green : C.panel, color: C.panel, fontSize: '14px', lineHeight: '17px', padding: 0,
                      }}
                    >{c.d ? '✓' : ''}</button>
                    <div onClick={() => toggle(id, 'd')} style={{ flex: '1 1 auto', cursor: 'pointer' }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, fontFamily: sans, color: c.d ? C.faint : C.ink, textDecoration: c.d ? 'line-through' : 'none' }}>
                        {label}{c.f && <span style={{ color: C.amber, fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}> - needs a look</span>}
                      </div>
                      {note ? <div style={{ fontSize: '13px', fontFamily: sans, color: c.d ? C.faint : C.muted, marginTop: '1px' }}>{note}</div> : null}
                    </div>
                    <button
                      onClick={() => toggle(id, 'f')} title="Flag - needs a look" aria-label={`Flag: ${label}`}
                      style={{ flex: '0 0 auto', width: '28px', height: '26px', border: 0, background: 'transparent', cursor: 'pointer', color: c.f ? C.amber : C.faint, fontSize: '15px', lineHeight: 1, borderRadius: '5px' }}
                    >{'⚑'}</button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <div style={{ marginTop: '40px', background: C.panel, border: `1px solid ${C.hair}`, borderRadius: '8px', padding: '18px 20px' }}>
        <h2 style={{ fontSize: '14px', letterSpacing: '.12em', textTransform: 'uppercase', color: C.amber, margin: '0 0 4px' }}>Not built yet &middot; deferred, off the pre-launch path</h2>
        <p style={{ color: C.muted, fontSize: '13.5px', fontFamily: sans, margin: '0 0 14px', maxWidth: '64ch' }}>Listed so the manifest tells the whole truth. None block go-live; the canon calls wait on you.</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '9px' }}>
          {GAPS.map(([t, n], i) => (
            <li key={i} style={{ display: 'flex', gap: '10px', fontFamily: sans, fontSize: '14px' }}>
              <span style={{ color: C.amber, flex: '0 0 auto' }}>{'-'}</span>
              <span style={{ color: C.ink }}>{t} <span style={{ color: C.faint, fontSize: '13px' }}>{n}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  )
}

function filterBtn(active: boolean): React.CSSProperties {
  return {
    fontFamily: 'Consolas, monospace', fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase',
    background: active ? C.panel2 : C.panel, color: active ? C.ink : C.muted,
    border: `1px solid ${active ? C.red : C.hair}`, borderRadius: '5px', padding: '6px 11px', cursor: 'pointer',
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: '940px', margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ fontFamily: 'Consolas, monospace', fontSize: '13px', letterSpacing: '.24em', textTransform: 'uppercase', color: C.red, marginBottom: '6px' }}>Supply Manifest &middot; District Zero</div>
      <h1 style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '30px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: C.ink, margin: '0 0 6px', borderBottom: `1px solid ${C.red}`, paddingBottom: '12px' }}>Feature Manifest</h1>
      <p style={{ color: C.muted, fontFamily: sans, fontSize: '14.5px', maxWidth: '62ch', margin: '0 0 8px' }}>Every feature the engine ships, crate by crate. Walk the table, confirm each on live, and tick it off. Flag anything that limps. Saved to your account - it follows you to any browser you log in from.</p>
      {children}
    </div>
  )
}
