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

// [id, label, explanation]. The explanation is hidden until the title is
// clicked (accordion), so the list stays scannable but the detail is a click away.
const DATA: { name: string; items: [string, string, string][] }[] = [
  { name: 'Character', items: [
    ['char-create', 'Character creation - three paths', "Build a character three ways: fully Random for instant play, a guided Quick build, or Full Backstory for players who want to shape every detail."],
    ['rapid', 'RAPID attributes', "The five core attributes every roll draws on - Reason, Acumen, Physicality, Influence, and Dexterity."],
    ['secondary', 'Secondary stats', "Stats derived from your attributes: Wound and Resolve points, melee and ranged defense, initiative, perception, encumbrance, and stress modifier."],
    ['skills', '29 skills across the five attributes', "Twenty-nine skills, each tied to an attribute, covering everything from Ranged Combat to Medicine to Barter."],
    ['comp-motiv', 'Complications & Motivations', "A Complication that haunts your character and a Motivation that drives them, shaping roleplay and some mechanics."],
    ['insight', 'Insight Dice', "A pool of Insight Dice you spend to boost a roll or bank for a bigger swing, earned back through dramatic moments."],
    ['evolution', 'Character evolution / leveling', "Spend earned CDP through the Evolution modal to raise attributes, skills, and traits as your character grows."],
    ['apprentices', 'Apprentices', "Take on an apprentice who learns from your character and can carry the torch if they fall."],
    ['pregens', 'Pregenerated characters', "A library of ready-made characters players can grab and drop into a game in one click."],
    ['char-sheet', 'Play-view character sheet', "The live in-play view of a character - stats, inventory, conditions, and actions in one place."],
    ['portraits', 'Portraits & photos', "Give each character a portrait or uploaded photo shown on their card and token."],
  ] },
  { name: 'Core Play & Checks', items: [
    ['dice-check', 'The 2d6 dice-check engine', "The heart of the system: roll 2d6, add your modifiers, and compare to a target to see how well you did."],
    ['attr-check', 'Attribute checks', "A raw test of a single attribute when no specific skill applies."],
    ['skill-check', 'Skill checks', "Roll an attribute plus a trained skill against a difficulty."],
    ['modifiers', 'Modifier stack', "Three stacking modifiers - Attribute (AMod), Skill (SMod), and Circumstance (CMod) - that add up to your roll bonus."],
    ['first-imp', 'First Impressions', "The first time a character meets an NPC they roll a First Impression; the result is stored and quietly colors every later interaction with that NPC."],
    ['insight-award', 'Insight spend & award', "Spend Insight Dice for a mechanical edge, and earn them back on standout successes and failures."],
    ['group-check', 'Coordinated Effort / group checks', "Several characters combine on one task, pooling their efforts into a single coordinated roll."],
    ['negotiations', 'Negotiations & Making the Case', "A structured back-and-forth for talking your way to what you want."],
    ['gaps', 'Filling in the Gaps', "Collaborative worldbuilding where players fill in details the GM leaves open."],
  ] },
  { name: 'Combat', items: [
    ['initiative', 'Turn order & combat rounds', "Turn-based rounds where order is set by initiative and each character acts on their turn."],
    ['attacks', 'Ranged & melee attacks', "Make ranged or melee attacks, rolling to hit against a target's defense."],
    ['damage', 'Damage to Wound / Resolve', "Hits deal damage to Wound Points (your body) or Resolve Points (your will to keep fighting)."],
    ['incap', 'Incapacitation & mortal wounds', "Drop to zero and you are incapacitated; push further and you face mortal wounds."],
    ['stress', 'Stress & stress checks', "Stress builds under pressure and is resolved with Stress Checks - eight kinds, each producing its own outcome line."],
    ['healing', 'Healing', "Recover Wound and Resolve over time or through medical care."],
    ['infection', 'Wound infection & sickness', "Untreated wounds can turn to infection and sickness, tracked over days with the GM's controls."],
    ['disarm', 'Disarm', "Knock a weapon out of an opponent's hands, dropping it to the ground to be grabbed."],
    ['grapple', 'Grapple', "Grab and control an opponent, with options to subdue or break free."],
    ['pistol-whip', 'Pistol-whip - improvised melee with a gun', "Out of ammo or up close? Strike with a gun as an improvised melee weapon."],
    ['range', 'Range bands', "Distance matters - a weapon works best within its range band and suffers outside it."],
    ['bestiary', 'Bestiary / NPC statblocks', "Ready-to-use statblocks for enemies and creatures the GM can drop into a fight."],
    ['env-dmg', 'Environmental damage', "Fire, falls, cold, and other hazards deal damage from the world itself."],
  ] },
  { name: 'Equipment & Inventory', items: [
    ['inventory', 'Character inventory', "Every character carries an inventory of gear, weapons, and supplies."],
    ['custom-items', 'Custom items', "Create your own items when the catalog does not have what you need."],
    ['encumbrance', 'Encumbrance (Resolve drain)', "Carry too much and your Resolve drains faster - weight has a cost."],
    ['weapons', 'Weapons catalog', "A full catalog of weapons with damage, range, and traits."],
    ['armor', 'Armor - worn, condition, upkeep', "Wear armor to soak damage; it degrades with use and needs upkeep to stay effective."],
    ['item-cond', 'Item condition & traits', "Gear has a condition that wears down and traits that change how it behaves."],
    ['weapon-repair', 'Weapon repair', "Fix damaged weapons before they fail you mid-fight."],
    ['rations', 'Rations', "Food comes in Standard, Luxury, and Military grades, each with different value."],
    ['upkeep', 'Upkeep phase', "A phase for maintaining gear - repairs, condition, and consumables."],
    ['loot', 'Loot & search - containers and corpses', "Search containers and bodies to take what is useful."],
    ['npc-trade', 'Trade with NPCs', "Barter and trade goods with NPCs."],
    ['stockpile', 'Stockpiles & vehicle cargo', "Pool supplies in a shared stockpile or a vehicle's cargo hold."],
    ['tokens', 'Token & object library', "A library of tokens and map objects to place on the tactical map."],
  ] },
  { name: 'The Table', items: [
    ['tac-map', 'Tactical map - grid, tokens, movement', "The grid battle map where you place tokens and move them cell by cell."],
    ['fog', 'Fog of war, vision & lighting', "Fog of war and lighting hide the map until characters can actually see it."],
    ['walls', 'Walls & line of sight', "Walls block movement and line of sight, so you cannot see or shoot through them."],
    ['camp-map', 'Campaign map with pins', "A real-world-style campaign map dotted with location pins."],
    ['pin-reveal', 'Reveal / hide pins to players', "Reveal or hide map pins so players only see the places they have discovered."],
    ['pings', 'Pings, measure tool, route & view sharing', "Ping a spot, measure distances, and share a route or your whole view with the table."],
    ['table-npcs', 'NPCs on the table', "Place NPCs on the map and reveal them; a pin shows who is 'Also Here'."],
    ['init-track', 'Initiative tracker', "A tracker showing whose turn it is and the full initiative order."],
    ['roll-feed', 'Live dice roll feed', "A live feed of every roll at the table as it happens."],
    ['chat', 'Table chat + GM whispers', "In-table chat, including private GM whispers to individual players."],
    ['notes', 'GM notes & handouts', "GM notes and player handouts, with a clear split between GM-only and shared."],
    ['vehicles', 'Vehicles - popout, seats, firing arcs, cargo', "Vehicles with a dedicated popout for crew seats, firing arcs, and cargo."],
    ['realtime', 'Real-time multi-client sync', "Everything syncs live across every player's screen in real time."],
    ['recorder', 'Playtest recorder', "A recorder that captures a session for playback and debugging."],
  ] },
  { name: 'Campaigns & Content', items: [
    ['stories', 'Stories / campaigns', "Create and run campaigns that hold your world, cast, and sessions."],
    ['members', 'Members & invite codes', "Invite players with a code and manage who is in the campaign."],
    ['settings', 'Settings', "Start from a built-in setting - District Zero or Kings Crossroads - or a blank Custom world."],
    ['modules', 'Modules / Rumors', "Package a campaign as a Rumor to publish, version, and share in a marketplace."],
    ['gm-kit', 'GM Kit import', "Import a prepared GM kit to seed a campaign fast."],
    ['snapshots', 'Progression log & session snapshots', "A progression log and session snapshots that record how the story unfolds."],
    ['clock', 'Campaign clock & in-world time', "An in-world clock that tracks the passage of time in your campaign."],
    ['world-map', 'World map (global pins)', "A global world map with pins spanning the whole setting."],
  ] },
  { name: 'Communities', items: [
    ['comm-struct', 'Community creation & structure', "Build and structure a survivor community with roles and buildings."],
    ['morale', 'Morale', "Community morale rises and falls and is tested with checks."],
    ['recruit', 'Recruitment', "Recruit new members into the community."],
    ['activity', 'Activity blocks', "Assign community activity blocks to get work done between sessions."],
    ['comm-stock', 'Community stockpile', "A shared community stockpile of pooled resources."],
    ['migrations', 'Migrations & events', "Communities grow, shrink, and weather events over time."],
    ['growth', 'Growth notifications', "Notifications when a community hits a growth milestone."],
  ] },
  { name: 'Social & Meta', items: [
    ['campfire', 'Campfire hub', "The Campfire hub tying together the game's community features."],
    ['forums', 'Forums', "Discussion forums for the community."],
    ['war-stories', 'War Stories', "Share memorable session tales as War Stories."],
    ['lfg', 'Looking for Group', "Looking-for-Group posts to find players and games."],
    ['messages', 'Direct messages', "Direct messages between users."],
    ['notifs', 'Notifications', "Notifications for invites, replies, and activity."],
    ['roles', 'Roles & moderation', "Account roles - Thriver, Survivor, Ghost - plus the moderation tools."],
    ['onboarding', 'Onboarding & user guide', "A guided onboarding flow and user guide for newcomers."],
    ['rules-ref', 'In-app rules reference', "The full rules compendium, browsable in-app at /rules."],
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
              {rows.map(([id, label, explain]) => {
                const c = state[id] || {}
                const isOpen = expanded.has(id)
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
                    <div style={{ flex: '1 1 auto' }}>
                      <div
                        onClick={() => toggleExpand(id)} role="button" tabIndex={0} aria-expanded={isOpen}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(id) } }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        title="Click for the explanation"
                      >
                        <span aria-hidden="true" style={{ flex: '0 0 auto', color: c.d ? C.faint : C.red, fontSize: '13px', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>{'▸'}</span>
                        <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: sans, color: c.d ? C.faint : C.ink, textDecoration: c.d ? 'line-through' : 'none' }}>
                          {label}{c.f && <span style={{ color: C.amber, fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}> - needs a look</span>}
                        </span>
                      </div>
                      {isOpen ? <div style={{ fontSize: '13.5px', fontFamily: sans, color: C.muted, margin: '5px 0 2px 18px', lineHeight: 1.5, maxWidth: '64ch' }}>{explain}</div> : null}
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
