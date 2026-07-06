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
// clicked (accordion). Sections mirror the beginners' guide chapters so the list
// reads as a complete click-through of the game. Feature ids are stable - reused
// across restructures so saved verified/flagged state survives.
const DATA: { name: string; items: [string, string, string][] }[] = [
  { name: 'Navigating the Site', items: [
    ['nav-sidebar', 'Left-sidebar navigation', "The always-present left sidebar is how you move around; the main area renders each page."],
    ['nav-online', 'Survivors-present counter', "A live count of who else is online shows at the top of the sidebar."],
    ['nav-userpanel', 'User panel & quick icons', "Your username with quick icons for notifications, messages, the Campfire, and bug reports."],
    ['nav-links', 'Sidebar destinations', "Jump to the World map, your Survivors, your Stories, Communities, the Campfire, Rumors, and the Rules."],
    ['join-story', 'Join a Story', "Paste a GM's invite code, or follow a link, to join their campaign."],
    ['onboarding', 'Welcome guide', "A guided 'Guide to the Tapestry' page that orients newcomers."],
    ['admin-tools', 'Admin Tools menu', "The Thriver-only tools group: Moderation, Logs, this Manifest, Character Photos, and more."],
    ['bug-report', 'Bug report form', "A form in the user panel that sends a bug straight to Xero."],
  ] },
  { name: 'Pins, Notifications & Roles', items: [
    ['pin-world', 'World-map pins', "Pins placed on the global map, visible to everyone once approved."],
    ['pin-reveal', 'Campaign pins & reveal', "GM-placed pins inside a Story, hidden until the GM reveals them to players."],
    ['pin-fields', 'Pin details', "Each pin carries a title, notes, a category, coordinates, and optional images."],
    ['pin-categories', 'Pin categories', "Sixteen category icons that change how a pin looks on the map."],
    ['pin-folders', 'Pin folders', "File your own pins privately; GMs share curated party folders with the table."],
    ['pin-moderation', 'World-pin moderation', "Player-submitted world pins wait as Rumors until a moderator approves them."],
    ['notifs', 'Notifications', "The bell collects invites, joins, reviews, and community events; some accept or decline inline."],
    ['roles', 'GM & player roles', "Your role is per-Story: a GM builds and runs the game, a player brings one character."],
  ] },
  { name: 'The World Map', items: [
    ['world-map', 'Interactive world map', "A real-world map of the Distemper setting you can pan, zoom, and search by place."],
    ['map-styles', 'Map styles', "Switch between satellite, topographic, street, and other map looks."],
    ['map-panel', 'Pins panel', "A side panel of public pins, your pins, revealed campaign pins, and a whisper wall."],
    ['whispers', 'Whispers wall', "Drop a short public note on the map for anyone to read."],
    ['camp-map', 'Campaign map', "Each Story's own map where the GM places, drags, and reveals location pins."],
    ['pin-scene-link', 'Pin-to-scene link', "Players double-click a pin to open its linked tactical scene."],
    ['pin-promote', 'Promote a pin to the world', "Send a campaign pin to global moderation for the shared world map."],
    ['measure', 'Measure tool', "Click points to measure straight-line distance; Esc clears it."],
    ['route', 'Route planner', "Plot a real road route with a distance and driving-time estimate."],
    ['share-route', 'Share a measurement or route', "Push your ruler or planned route to the other players."],
    ['vehicle-bubble', 'Vehicle bubble', "A floating bubble marks the party's position and opens the vehicle sheet."],
  ] },
  { name: 'Creating a Character', items: [
    ['char-create', 'Four creation paths', "Build a character four ways - Random, Quick, Paradigms, or full Backstory - same result, different depth."],
    ['backstory-wizard', 'Backstory life-path wizard', "A step-by-step life-pathing build that spends a CDP budget at each stage."],
    ['paradigms', 'Paradigms', "Pick from twelve archetype templates, then customize."],
    ['rapid', 'RAPID attributes', "The five core attributes - Reason, Acumen, Physicality, Influence, Dexterity - behind every roll."],
    ['skills', '29 skills', "Twenty-nine skills tied to attributes, from Ranged Combat to Medicine to Barter."],
    ['comp-motiv', 'Motivation & Complication', "A drive and a flaw, each pickable or rollable, with a freeform note."],
    ['secondary', 'Secondary stats', "Wound and Resolve points, defenses, initiative, perception, and encumbrance, all auto-calculated."],
    ['start-equip', 'Starting equipment', "Choose a primary and secondary weapon plus starting gear."],
    ['portraits', 'Portrait doubles as token', "Your portrait is also your map token; swap it and every active token updates."],
    ['portrait-bank', 'Portrait Bank', "Pick a portrait from the shared bank or upload your own."],
    ['char-cards', 'Survivor cards', "Each character card shows stats, weapons, and live trackers at a glance."],
    ['char-actions', 'Card actions', "Edit, Inventory, Apprentice, Rest, Travel, Env Damage, Evolution, Duplicate, Print, and Delete."],
    ['wp-rp-track', 'Wound & Resolve trackers', "Click the WP and RP circles to take or heal damage."],
    ['stress-track', 'Stress track', "A five-pip stress track; the fifth pip triggers a Stress check."],
    ['insight', 'Insight Dice', "Earned on double 1s or 6s and spent from the roll modal for an edge."],
    ['death-flow', 'Downed & death countdown', "Hitting zero knocks you out and adds stress; at 0 WP a death countdown starts, savable with Medicine or Insight."],
    ['evolution', 'Character evolution', "Spend earned CDP to advance attributes, skills, and traits."],
  ] },
  { name: 'The Rules', items: [
    ['rules-ref', 'In-app Rules compendium', "The full Xero Sum Engine SRD, browsable in-app."],
    ['rules-sections', 'Rules sections', "Overview, Core Mechanics, Character, Skills, Combat, Weapons & Equipment, and Communities."],
    ['rules-appendices', 'Quick-reference appendices', "Lookup tables for Motivations, skills, equipment, and the twelve Paradigms."],
    ['rules-xref', 'Cross-references', "Links jump between related rules sections."],
  ] },
  { name: 'Creating a Story', items: [
    ['stories', 'Create a Story', "Start a campaign with a name, description, and a starting map view."],
    ['settings', 'Pick a setting', "Start blank Custom, or preload District Zero or Kings Crossroads content."],
    ['story-from-rumor', 'Start from a Rumor', "Begin a Story from a published module instead of a setting."],
    ['members', 'Invite & roster', "Share an invite code, see the player roster, and manage who is in."],
    ['gm-notes-popout', 'GM Notes popout', "A separate window for story overview, scenes, NPC list, and plot beats."],
    ['publish-story', 'Publish as a Rumor', "Publish your Story's content to the Rumors marketplace."],
    ['gm-kit', 'GM Kit export', "Package pins, NPCs, scenes, tokens, and handouts into a downloadable zip."],
    ['delete-story', 'Delete a Story', "Permanently delete a Story after typing its name to confirm."],
    ['leave-story', 'Leave a Story', "Players can leave any Story from their My Stories page."],
  ] },
  { name: 'The Table & Sessions', items: [
    ['tac-camp-toggle', 'Table & map toggle', "Launch the Table full-screen and swap between the campaign and tactical maps."],
    ['sessions', 'Start & end a session', "The GM opens a session to unlock dice and combat, and closes it with a summary."],
    ['session-gating', 'Session gating', "No dice rolls or combat until a session is active."],
    ['roll-modal', 'Dice roll modal', "Click any attribute, skill, or weapon to open the roll modal."],
    ['dice-check', 'The 2d6 check engine', "Roll 2d6, add your modifiers, and compare to a target."],
    ['modifiers', 'Modifier stack', "Attribute, Skill, and Circumstance modifiers stack into your bonus."],
    ['outcome-ladder', 'Outcome ladder', "Every roll lands on a rung from Dire Failure through Wild Success, with Insight moments at the ends."],
    ['first-imp', 'First Impressions', "Meeting an NPC sets a stored relationship modifier that auto-applies to later rolls."],
    ['insight-award', 'Spend & earn Insight', "Spend Insight Dice on a roll and earn them back on Insight moments."],
    ['group-check', 'Group & opposed checks', "Combine several characters on one task, or roll opposed against another."],
    ['negotiations', 'Negotiations', "A structured social exchange for talking your way to what you want."],
    ['advantages', 'Advantages', "The GM grants a one-shot bonus that a player spends on a matching roll."],
    ['checks-menu', 'Checks menu', "Perception, Gut Instinct, First Impression, Group, Opposed, Recruit, and Stress checks in one dropdown."],
    ['stress', 'Stress checks', "Stress builds under pressure and resolves through eight kinds of check."],
    ['logs-feed', 'Logs feed', "A color-coded feed of every roll, action, and combat event."],
    ['table-chat', 'Table chat & whispers', "In-character chat with private GM whispers to individual players."],
    ['panel-tabs', 'Right-panel tabs', "Pins, NPCs, Assets, and Notes tabs, reordering when combat starts."],
    ['notes', 'GM notes & handouts', "Auto-saved GM notes, player notes, and shared handouts, split GM-only vs shared."],
    ['restore-all', 'Restore everyone', "The GM heals all characters at once."],
    ['gm-tools', 'GM Tools menu', "Snapshots, reload, the loot board, and other session utilities."],
    ['snapshots', 'Snapshots', "Capture and roll back to a full saved campaign state."],
    ['session-export', 'Session summary & export', "An end-of-session summary and cliffhanger, saved to history and exportable as HTML."],
    ['recorder', 'Session recorder', "A Thriver-only recorder that captures a session for playback and debugging."],
    ['realtime', 'Real-time sync', "Everything at the table syncs live across every player's screen."],
  ] },
  { name: 'Tactical Map & Fog of War', items: [
    ['tac-map', 'Tactical map', "A grid battle map with tokens you move cell by cell."],
    ['scene-setup', 'Scene setup', "Create and name scenes, set the grid, and switch scenes for the whole table."],
    ['map-background', 'Map background', "Upload a battle-map image, scale it, lock it, or reuse one from another scene."],
    ['grid-settings', 'Grid settings', "Toggle the grid and set its size, cell scale, color, and opacity."],
    ['tokens', 'PC, NPC & object tokens', "Round PC and NPC tokens plus square multi-cell object tokens."],
    ['walls', 'Walls, doors & windows', "Barriers that block movement and vision; doors toggle open and closed."],
    ['range-circles', 'Range circles', "Selecting a token shows its engaged, move, and weapon-range rings."],
    ['token-move', 'Token movement', "Free dragging outside combat; costs an action and is range-bounded during combat."],
    ['fog', 'Fog of war', "Players see fogged cells as solid black until a character can see them."],
    ['fog-tools', 'Fog tools', "Paint, rectangle, and erase fog, plus Fog All and Clear All."],
    ['sight', 'Per-token sight', "A sight radius clears fog as a PC moves, respecting walls and doors."],
    ['pings', 'Ping, Share Map & Share View', "Alt-click to ping a cell, and push the map or your exact view to players."],
    ['fit-lock', 'Fit & lock controls', "Fit-to-map, fit-to-screen, zoom, and locking the background in place."],
  ] },
  { name: 'Combat', items: [
    ['initiative', 'Start combat & initiative', "The GM starts combat, picks the NPCs, and everyone rolls initiative for turn order."],
    ['init-bar', 'Initiative bar & turns', "A turn-order bar with two actions each turn and GM controls to defer, grant, skip, or remove."],
    ['attacks', 'Attacks', "Roll an equipped weapon at a chosen target and apply damage on a hit."],
    ['combat-actions', 'Combat actions', "Aim, Charge, Coordinate, Defend, Move, Rapid Fire, Reposition, Sprint, and Take Cover."],
    ['ready-weapon', 'Ready Weapon', "Switch, reload, or unjam and repair a weapon mid-fight."],
    ['unarmed', 'Unarmed strike', "An always-available fist attack for 1d3 damage."],
    ['damage', 'Damage to Wound & Resolve', "Hits deplete Wound Points (body) or Resolve Points (will to fight)."],
    ['blast', 'Blast radius', "Grenades and Molotovs splash tiered damage by distance, sparing the thrower."],
    ['grapple', 'Grapple, subdue & break free', "Grab and hold a foe, choke for damage, or struggle free; a hit breaks the hold."],
    ['disarm', 'Disarm', "Knock a weapon to the ground for someone to grab."],
    ['pistol-whip', 'Pistol-whip', "Strike with a gun as an improvised melee weapon up close."],
    ['incap', 'Downed & mortal wounds', "At 0 WP a death countdown runs; stabilize with Medicine or trade Insight to survive at 1."],
    ['lasting-wounds', 'Lasting wounds', "Surviving a mortal wound can leave a permanent injury shown as a chip on the card."],
    ['infection', 'Wound infection & sickness', "Ending combat rolls infection for the wounded; environmental sickness follows the same ladder."],
    ['weapon-cond', 'Weapon malfunction', "A Low-Insight attack drops a weapon's condition until you unjam or repair it."],
    ['healing', 'Rest & recovery', "Heal Wound and Resolve over hours, days, or weeks; a long rest also drops stress."],
    ['env-dmg', 'Environmental damage', "Apply falling or drowning damage from the world itself."],
    ['travel-push', 'Travel push', "Traveling past eight free hours costs Resolve and advances the clock."],
    ['end-combat', 'End combat', "Clears initiative, releases grapples, and settles stress on the mortally wounded."],
  ] },
  { name: 'Equipment & Inventory', items: [
    ['inventory', 'Character inventory', "Every character carries an inventory of gear, weapons, and supplies."],
    ['custom-items', 'Custom items', "Create your own items beyond the catalog."],
    ['weapons', 'Weapons catalog', "A full catalog of weapons with damage, range, and traits."],
    ['armor', 'Armor', "Worn armor soaks damage, degrades with use, and needs upkeep."],
    ['item-cond', 'Item condition & traits', "Gear wears down and carries traits that change how it behaves."],
    ['weapon-repair', 'Repair & upkeep', "Repair damaged weapons and maintain gear in the upkeep phase."],
    ['rations', 'Rations', "Food in Standard, Luxury, and Military grades."],
    ['encumbrance', 'Encumbrance', "Carry too much and your Resolve drains faster."],
    ['loot', 'Loot & search', "Search containers and bodies to take what is useful."],
    ['npc-trade', 'Trade & stockpiles', "Barter with NPCs and pool gear in shared stockpiles."],
    ['range', 'Range bands', "A weapon works best within its range band and suffers outside it."],
    ['bestiary', 'Bestiary', "Ready-made enemy statblocks the GM can drop into a fight."],
  ] },
  { name: 'NPCs & Recruitment', items: [
    ['npc-create', 'Create an NPC', "Build an NPC with a type, attributes, skills, weapons, motivation, and portrait."],
    ['npc-generate', 'Generate & populate', "Roll a random NPC, or bulk-populate a scene with a balanced roster."],
    ['npc-cards', 'NPC cards & sheet', "Cards with status, show/hide, fight, and map controls; the sheet has clickable rolls and attacks."],
    ['npc-clone', 'Clone & organize', "Clone a card and drag NPCs into folders."],
    ['npc-visibility', 'Reveal & panic-hide', "Show or hide NPCs to players, with one-click panic-hide and auto-reveal on combat."],
    ['npc-restore', 'Restore an NPC', "Reset a dead or wounded NPC to full."],
    ['npc-publish', 'Publish to the World Library', "Share an NPC for other GMs to import into their Stories."],
    ['token-creator', 'Token Creator & Portrait Bank', "Upload and tag portraits and tokens for the shared bank."],
    ['recruit', 'Recruitment', "Roll to recruit an NPC via the Cohort, Conscript, or Convert approach."],
    ['recruit-approaches', 'Recruitment approaches', "Each approach has its own gating, morale rules, and success or failure banner."],
    ['apprentices', 'Apprentices', "A Moment of High Insight unlocks a single apprentice a PC can train and grow."],
  ] },
  { name: 'Vehicles', items: [
    ['vehicles', 'Vehicles & popout', "Vehicles listed in the header, opened as a full sheet in a popout window."],
    ['vehicle-seats', 'Crew seats', "Driver, navigator, brewer, passenger, and shooter slots, assigned by staging then confirming."],
    ['vehicle-embark', 'Embark & disembark', "Board within close range or eject to a free cell; moving passengers leave the grid."],
    ['vehicle-fuel', 'Fuel & drums', "A fuel bar plus installable 55-gallon drums you ferry, refill, or scavenge."],
    ['vehicle-brew', 'Brewing', "Gather materials and brew from the vehicle's still, with its own outcome banner."],
    ['stockpile', 'Shared cargo', "A shared cargo hold any member can load from a PC standing at the vehicle."],
    ['vehicle-combat', 'Vehicles in combat', "Multi-cell tokens that take damage, act as cover, and let the driver ram, swerve, and drive by."],
  ] },
  { name: 'Communities', items: [
    ['comm-struct', 'Found a community', "A group of thirteen or more members becomes a community with weekly checks."],
    ['comm-members', 'Members & roles', "Add or remove members and assign each NPC one of five community roles."],
    ['comm-balance', 'Role balancing', "Role bars show staffing against minimums, with an auto-rebalance button."],
    ['comm-leader', 'Leader & succession', "Set the leader who rolls morale, with step-down and successor picking."],
    ['morale', 'Weekly check', "Run the Fed, Clothed, and Morale rolls that decide the community's week."],
    ['comm-outcomes', 'Outcomes & dissolution', "Results drive departures; three failures dissolve the community unless a retention check saves it."],
    ['activity', 'Activity blocks', "Assign community activity blocks to get work done between sessions."],
    ['comm-stock', 'Community stockpile', "A shared pool of community resources."],
    ['comm-dashboard', 'Community dashboard', "A full per-community view of morale history, roles, and recruitment stats."],
    ['migrations', 'Migrations & events', "Members migrate between communities and weather events over time."],
    ['comm-feed', 'Community feed', "Each community has its own activity feed players and the GM post to."],
    ['growth', 'Growth milestones', "Notifications when a community hits a milestone."],
  ] },
  { name: 'The Campfire', items: [
    ['campfire', 'Campfire hub', "A portal of cards linking every community feature, with URL deep-links."],
    ['setting-hubs', 'Setting hubs', "District Zero and Kings Crossroads each have a feed hub with canon timeline pins and communities."],
    ['messages', 'Direct messages', "Private conversation threads with search and a New Message button."],
    ['lfg', 'Looking for Group', "Post to find players or a game, gather interested people, and invite or DM them."],
    ['lfg-share', 'Share an LFG post', "Push a post to Reddit, Twitter, Facebook, or copy a link."],
    ['war-stories', 'War Stories', "Post cross-Story tales with images or PDFs; edit, delete, and moderation apply."],
    ['timestamps', 'Timestamps tool', "Generate a Discord-compatible timestamp in several formats."],
  ] },
  { name: 'Rumors', items: [
    ['modules', 'Rumors marketplace', "Browse published modules with cards, sorting, search, and setting filters."],
    ['module-detail', 'Module detail & subscribe', "A full description, version history, reviews, and a Subscribe button."],
    ['module-use', 'Start a Story from a module', "Clone a module's NPCs, pins, scenes, and handouts into a new Story."],
    ['module-publish', 'Publish a Rumor', "Publish your Story as a v1.0.0 module with visibility and content options."],
    ['module-versions', 'Versions & updates', "Ship new semver versions; subscribers get an update prompt and a diff view."],
    ['module-reviews', 'Reviews & ratings', "Subscribers leave 1-5 star ratings and short reviews that surface on cards."],
    ['rumor-pins', 'World-map Rumor pins', "Player-submitted 'Rumor' pins show a question mark until a moderator reviews them."],
  ] },
]

const GAPS: [string, string][] = [
  ['Lv4 Skill Traits - auto-bonuses (Beacon of Hope, Insightful Counselor, etc.)', 'Ships together once the full trait list lands. The Evolution modal reaches Lv4 but has no trait picker yet.'],
  ['Weapon damage-balance pass', 'Revolver added; a consistency review across the whole catalog is a canon call on the numbers.'],
  ['Player-to-player item trade', 'Not a security hole, just not wired. A feature call: build it for beta or leave it off.'],
  ['Hidden-NPC fog occlusion', 'A revealed token showing only when a player can see the cell. Nice-to-have, rides on per-player vision.'],
  ['Encumbrance movement-halving', 'The Resolve-drain half is live; halving an overloaded token on the tactical map is not wired.'],
  ['Forums', 'Being redesigned and hidden until Xero sets a UI direction; the rest of the Campfire is live.'],
  ['Homebrew hub', 'A coming-soon Campfire card for custom rules, not yet open for posting.'],
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
